import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { billTotals, formatLKR, lineTotal } from "@/lib/money";
import PageShell from "@/components/PageShell";
import { statusLabel } from "@/lib/status";
import MarginPanel from "@/components/MarginPanel";
import ConfirmDialog from "@/components/invoice/ConfirmDialog";

export const dynamic = "force-dynamic";

export default async function QuotationDetailPage({
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
        include: { item: true },
      },
    },
  });
  if (!quotation) notFound();

  const totals = billTotals({
    lines: quotation.lines,
    billDiscountType: quotation.billDiscountType,
    billDiscountValue: quotation.billDiscountValue,
  });

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  const now = new Date();
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/quotations" className="text-sm text-slate-500 hover:underline">
              &larr; Quotations
            </Link>
            <h1 className="mt-1 text-2xl font-semibold">
              Quotation {quotation.quoteNo}
            </h1>
            <p className="text-sm text-slate-500">
              {quotation.customer.name} &middot;{" "}
              <span className="font-mono">{quotation.customer.phone}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium dark:bg-slate-800">
              {statusLabel("quotation", quotation.status)}
            </span>
            <a
              href={`/quotations/${quotation.id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Open PDF
            </a>
            {quotation.invoice ? (
              <Link
                href={`/invoices/${quotation.invoice.id}`}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
              >
                Invoice {quotation.invoice.invoiceNo}
              </Link>
            ) : (
              <>
                <Link
                  href={`/quotations/${quotation.id}/edit`}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Reopen &amp; edit
                </Link>
                <ConfirmDialog
                  quotationId={quotation.id}
                  quoteNo={quotation.quoteNo}
                  total={totals.total}
                  today={today}
                  trackedLines={quotation.lines
                    .filter((l) => l.item.tracksSerials)
                    .map((l) => ({
                      quoteLineId: l.id,
                      itemId: l.itemId,
                      itemCode: l.item.itemCode,
                      name: l.item.name,
                      quantity: l.quantity,
                    }))}
                />
              </>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800">
            <p className="text-xs text-slate-500">Issue date</p>
            <p>{fmt(quotation.issueDate)}</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800">
            <p className="text-xs text-slate-500">Valid until</p>
            <p>{fmt(quotation.validUntil)}</p>
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
              {quotation.lines.map((line) => (
                <tr key={line.id}>
                  <td className="px-4 py-2">
                    <span className="block">{line.item.name}</span>
                    <span className="block font-mono text-xs text-slate-500">
                      {line.item.itemCode}
                    </span>
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

        <div className="flex flex-wrap items-start justify-end gap-4">
          <div className="w-full max-w-xs">
            <MarginPanel
              lines={quotation.lines}
              billDiscountType={quotation.billDiscountType}
              billDiscountValue={quotation.billDiscountValue}
            />
          </div>
          <div className="w-full max-w-sm space-y-2 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-mono">{formatLKR(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Discount</span>
              <span className="font-mono">- {formatLKR(totals.billDiscount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold dark:border-slate-800">
              <span>Grand total</span>
              <span className="font-mono">{formatLKR(totals.total)}</span>
            </div>
          </div>
        </div>

        {quotation.extraTerms && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Terms for this bill
            </h2>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-300 p-4 font-sans text-sm leading-relaxed dark:border-slate-700">
              {quotation.extraTerms}
            </pre>
          </div>
        )}

        {quotation.termsText && (
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Standard terms
            </h2>
            <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-slate-200 p-4 font-sans text-xs leading-relaxed dark:border-slate-800">
              {quotation.termsText}
            </pre>
          </div>
        )}
      </div>
    </PageShell>
  );
}
