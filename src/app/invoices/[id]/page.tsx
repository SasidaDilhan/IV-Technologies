import Link from "next/link";
import { notFound } from "next/navigation";

import PageShell from "@/components/PageShell";
import PaymentPanel from "@/components/invoice/PaymentPanel";
import MarginPanel from "@/components/MarginPanel";
import { prisma } from "@/lib/prisma";
import { billTotals, formatLKR, lineTotal } from "@/lib/money";
import { settlementOf } from "@/lib/invoices";

export const dynamic = "force-dynamic";

function isoDate(d: Date): string {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

export default async function InvoiceDetailPage({
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
      quotation: true,
      payments: { orderBy: { paidAt: "asc" } },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: { item: true, serialUnits: { orderBy: { serialNumber: "asc" } } },
      },
    },
  });
  if (!invoice) notFound();

  const totals = billTotals({
    lines: invoice.lines,
    billDiscountType: invoice.billDiscountType,
    billDiscountValue: invoice.billDiscountValue,
    advanceAmount: invoice.advanceAmount,
    payments: invoice.payments,
  });
  const state = settlementOf(totals.balanceDue, totals.paid);

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/invoices" className="text-sm text-slate-500 hover:underline">
              &larr; Invoices
            </Link>
            <h1 className="mt-1 text-2xl font-semibold">
              Invoice {invoice.invoiceNo}
            </h1>
            <p className="text-sm text-slate-500">
              <Link href={`/customers/${invoice.customerId}`} className="underline">
                {invoice.customer.name}
              </Link>{" "}
              &middot; <span className="font-mono">{invoice.customer.phone}</span>
            </p>
            {invoice.quotation && (
              <p className="text-xs text-slate-500">
                From quotation{" "}
                <Link
                  href={`/quotations/${invoice.quotation.id}`}
                  className="font-mono underline"
                >
                  {invoice.quotation.quoteNo}
                </Link>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                state.settled
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              {state.label}
            </span>
            <a
              href={`/invoices/${invoice.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
            >
              Open PDF
            </a>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800">
            <p className="text-xs text-slate-500">Issue date</p>
            <p>{fmt(invoice.issueDate)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800">
            <p className="text-xs text-slate-500">Due date</p>
            <p>{invoice.dueDate ? fmt(invoice.dueDate) : "-"}</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left dark:bg-slate-900">
              <tr>
                <th className="px-4 py-2 font-medium">Item</th>
                <th className="px-4 py-2 text-right font-medium">Qty</th>
                <th className="px-4 py-2 text-right font-medium">Unit price</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {invoice.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-2">
                    <span className="block">{line.item.name}</span>
                    <span className="block font-mono text-xs text-slate-500">
                      {line.item.itemCode}
                    </span>
                    {line.serialUnits.length > 0 && (
                      <span className="block font-mono text-xs text-slate-500">
                        S/N: {line.serialUnits.map((s) => s.serialNumber).join(", ")}
                      </span>
                    )}
                    {line.note && (
                      <span className="block text-xs text-slate-500">{line.note}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">{line.quantity}</td>
                  <td className="px-4 py-2 text-right font-mono">
                    {formatLKR(line.unitPrice)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono">
                    {formatLKR(lineTotal(line))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
          <MarginPanel
            lines={invoice.lines}
            billDiscountType={invoice.billDiscountType}
            billDiscountValue={invoice.billDiscountValue}
          />
          <PaymentPanel
            invoiceId={invoice.id}
            balanceDue={Math.max(totals.balanceDue, 0)}
            today={isoDate(new Date())}
            payments={invoice.payments.map((p) => ({
              id: p.id,
              amount: p.amount,
              method: p.method,
              paidAt: p.paidAt.toLocaleDateString("en-GB"),
              reference: p.reference,
              note: p.note,
            }))}
          />
          </div>

          <div className="h-fit rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800">
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-mono">{formatLKR(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Discount</span>
              <span className="font-mono">- {formatLKR(totals.billDiscount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 py-2 font-medium dark:border-slate-800">
              <span>Total</span>
              <span className="font-mono">{formatLKR(totals.total)}</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Received</span>
              <span className="font-mono">- {formatLKR(totals.paid)}</span>
            </div>
            <div className="mt-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Balance due
              </p>
              <p className="font-mono text-3xl font-semibold tabular-nums">
                {formatLKR(Math.max(totals.balanceDue, 0))}
              </p>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
