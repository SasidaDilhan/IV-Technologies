import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import QuotationBuilder from "@/components/quotation/QuotationBuilder";
import { prisma } from "@/lib/prisma";
import { formatDiscountInput, toRupees } from "@/lib/money";
import { getSettings } from "@/lib/settings";
import { latestRevisionId, revisionNumber } from "@/lib/invoices";

export const dynamic = "force-dynamic";

function isoDate(d: Date): string {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * Edit an issued invoice. Nothing here overwrites it: saving creates a new
 * revision with the next -N number, and the invoice being edited is kept and
 * marked superseded.
 */
export default async function EditInvoicePage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      lines: {
        orderBy: { sortOrder: "asc" },
        include: { item: true, serialUnits: { orderBy: { serialNumber: "asc" } } },
      },
    },
  });
  if (!invoice) notFound();

  // Only the live revision can be edited; an old link goes to the current one.
  if (invoice.supersededAt) {
    redirect(`/invoices/${await latestRevisionId(invoice.id)}/edit`);
  }

  const rootId = invoice.rootInvoiceId ?? invoice.id;
  const root =
    rootId === invoice.id
      ? invoice
      : await prisma.invoice.findUniqueOrThrow({ where: { id: rootId } });
  const chain = await prisma.invoice.findMany({
    where: { OR: [{ id: rootId }, { rootInvoiceId: rootId }] },
    select: { revisionNo: true },
  });
  const nextNo = revisionNumber(
    root.invoiceNo,
    chain.reduce((max, c) => Math.max(max, c.revisionNo ?? 0), 0) + 1,
  );

  const settings = await getSettings();

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-amber-300 bg-amber-50 px-4 py-2 dark:border-amber-800 dark:bg-amber-950">
        <Link href={`/invoices/${invoice.id}`} className="text-xs text-slate-500 hover:underline">
          &larr; Back to invoice
        </Link>
        <p className="text-sm font-medium">
          Editing invoice <span className="font-mono">{invoice.invoiceNo}</span>
          <span className="ml-2 text-xs font-normal text-slate-600 dark:text-slate-400">
            saving creates <span className="font-mono font-medium">{nextNo}</span>.{" "}
            {invoice.invoiceNo} is kept unchanged and marked superseded; its payments
            carry over.
          </span>
        </p>
      </div>

      <div className="min-h-0 flex-1">
        <QuotationBuilder
          defaultTerms={settings.defaultTerms}
          today={isoDate(new Date())}
          validUntil={isoDate(new Date())}
          invoiceRevision={{
            invoiceId: invoice.id,
            invoiceNo: invoice.invoiceNo,
            previousUnits: invoice.lines.flatMap((line) =>
              line.serialUnits.map((s) => ({
                id: s.id,
                serialNumber: s.serialNumber,
                itemId: line.itemId,
              })),
            ),
          }}
          initial={{
            id: invoice.id,
            quoteNo: invoice.invoiceNo,
            customer: {
              id: invoice.customer.id,
              name: invoice.customer.name,
              phone: invoice.customer.phone,
              address: invoice.customer.address,
            },
            issueDate: isoDate(new Date()),
            validUntil: isoDate(new Date()),
            billDiscountType: invoice.billDiscountType === "percent" ? "percent" : "fixed",
            billDiscountValue: formatDiscountInput(
              invoice.billDiscountType,
              invoice.billDiscountValue,
            ),
            terms: invoice.termsText ?? settings.defaultTerms,
            extraTerms: invoice.extraTerms ?? "",
            lines: invoice.lines.map((line) => ({
              key: `line-${line.id}`,
              itemId: line.itemId,
              itemCode: line.item.itemCode,
              name: line.item.name,
              tracksSerials: line.item.tracksSerials,
              unitPrice: toRupees(line.unitPrice).toFixed(2),
              costPrice: line.costPrice,
              quantity: line.quantity,
              discountType: line.lineDiscountType === "percent" ? "percent" : "fixed",
              discountValue: formatDiscountInput(line.lineDiscountType, line.lineDiscountValue),
              note: line.note ?? "",
            })),
          }}
        />
      </div>
    </div>
  );
}
