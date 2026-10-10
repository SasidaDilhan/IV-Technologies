import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import PageShell from "@/components/PageShell";
import ReturnForm from "@/components/invoice/ReturnForm";
import { billTotals, lineShares } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { orderLines, returnedByLine } from "@/lib/returns";

export const dynamic = "force-dynamic";

function isoDate(d: Date): string {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

export default async function ReturnPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      payments: true,
      returns: true,
      lines: {
        include: {
          item: true,
          returnLines: true,
          serialUnits: { orderBy: { serialNumber: "asc" }, select: { id: true, serialNumber: true } },
        },
      },
    },
  });
  if (!invoice) notFound();
  // Returns go on the live bill, never on a superseded revision.
  if (invoice.supersededAt) redirect(`/invoices/${invoice.id}`);

  const lines = orderLines(invoice.lines);
  const shares = lineShares(lines, invoice.billDiscountType, invoice.billDiscountValue);
  const already = returnedByLine(lines);
  const totals = billTotals({
    lines,
    billDiscountType: invoice.billDiscountType,
    billDiscountValue: invoice.billDiscountValue,
    advanceAmount: invoice.advanceAmount,
    payments: invoice.payments,
    returns: invoice.returns,
  });

  return (
    <PageShell>
      <div className="space-y-6">
        <div>
          <Link href={`/invoices/${invoice.id}`} className="text-sm text-slate-500 hover:underline">
            &larr; Invoice {invoice.invoiceNo}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Return items</h1>
          <p className="text-sm text-slate-500">
            {invoice.customer.name} &middot;{" "}
            <span className="font-mono">{invoice.customer.phone}</span> &middot; issued{" "}
            {invoice.issueDate.toLocaleDateString("en-GB")}
          </p>
        </div>

        <ReturnForm
          invoiceId={invoice.id}
          invoiceNo={invoice.invoiceNo}
          balanceDue={totals.balanceDue}
          today={isoDate(new Date())}
          lines={lines.map((l, i) => ({
            id: l.id,
            name: l.item.name,
            itemCode: l.item.itemCode,
            quantity: l.quantity,
            returned: already.get(l.id) ?? 0,
            share: shares[i],
            unitPrice: l.unitPrice,
            tracksSerials: l.item.tracksSerials,
            serials: l.serialUnits,
          }))}
        />
      </div>
    </PageShell>
  );
}
