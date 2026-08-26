import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import QuotationBuilder from "@/components/quotation/QuotationBuilder";
import { prisma } from "@/lib/prisma";
import { formatDiscountInput, toRupees } from "@/lib/money";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

function isoDate(d: Date): string {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

/** Reopen a quotation in the till, pre-filled and fully editable. */
export default async function EditQuotationPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: true,
      invoice: true,
      lines: {
        orderBy: { sortOrder: "asc" },
        include: { item: true, serialUnits: { orderBy: { serialNumber: "asc" } } },
      },
    },
  });
  if (!quotation) notFound();

  // An invoiced quotation is a historical record; editing it would contradict
  // a bill the customer already holds.
  if (quotation.invoice) redirect(`/quotations/${quotation.id}`);

  const settings = await getSettings();

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
        <Link
          href={`/quotations/${quotation.id}`}
          className="text-xs text-slate-500 hover:underline"
        >
          &larr; Back to quotation
        </Link>
        <p className="text-sm font-medium">
          Editing quotation <span className="font-mono">{quotation.quoteNo}</span>
          <span className="ml-2 text-xs font-normal text-slate-500">
            saves over the same record
          </span>
        </p>
      </div>

      <div className="min-h-0 flex-1">
        <QuotationBuilder
          defaultTerms={settings.defaultTerms}
          today={isoDate(new Date())}
          validUntil={isoDate(new Date())}
          initial={{
            id: quotation.id,
            quoteNo: quotation.quoteNo,
            customer: {
              id: quotation.customer.id,
              name: quotation.customer.name,
              phone: quotation.customer.phone,
              address: quotation.customer.address,
            },
            issueDate: isoDate(quotation.issueDate),
            validUntil: isoDate(quotation.validUntil),
            billDiscountType:
              quotation.billDiscountType === "percent" ? "percent" : "fixed",
            billDiscountValue: formatDiscountInput(
              quotation.billDiscountType,
              quotation.billDiscountValue,
            ),
            terms: quotation.termsText ?? settings.defaultTerms,
            lines: quotation.lines.map((line) => ({
              key: `line-${line.id}`,
              itemId: line.itemId,
              itemCode: line.item.itemCode,
              name: line.item.name,
              tracksSerials: line.item.tracksSerials,
              unitPrice: toRupees(line.unitPrice).toFixed(2),
              quantity: line.quantity,
              serials: line.serialUnits.map((s) => ({
                id: s.id,
                serialNumber: s.serialNumber,
              })),
              discountType:
                line.lineDiscountType === "percent" ? "percent" : "fixed",
              discountValue: formatDiscountInput(
                line.lineDiscountType,
                line.lineDiscountValue,
              ),
              note: line.note ?? "",
            })),
          }}
        />
      </div>
    </div>
  );
}
