import Link from "next/link";
import { notFound } from "next/navigation";

import PageShell from "@/components/PageShell";
import PaymentPanel from "@/components/invoice/PaymentPanel";
import MarginPanel from "@/components/MarginPanel";
import { prisma } from "@/lib/prisma";
import { billTotals, formatLKR, lineTotal } from "@/lib/money";
import { revisionNumber, settlementOf } from "@/lib/invoices";

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
  const superseded = invoice.supersededAt !== null;

  // Every invoice in this revision chain, oldest first.
  const rootId = invoice.rootInvoiceId ?? invoice.id;
  const chain = await prisma.invoice.findMany({
    where: { OR: [{ id: rootId }, { rootInvoiceId: rootId }] },
    orderBy: { id: "asc" },
    select: { id: true, invoiceNo: true, revisionNo: true, supersededAt: true, issueDate: true },
  });
  const live = chain.find((c) => c.supersededAt === null);
  const root = chain.find((c) => c.id === rootId);
  const nextNo = root
    ? revisionNumber(
        root.invoiceNo,
        chain.reduce((max, c) => Math.max(max, c.revisionNo ?? 0), 0) + 1,
      )
    : null;

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <PageShell>
      <div className="space-y-6">
        {superseded && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <strong>Superseded.</strong> This invoice was revised
            {invoice.supersededAt ? ` on ${invoice.supersededAt.toLocaleDateString("en-GB")}` : ""}{" "}
            and is kept as a record, exactly as it was issued.
            {live && (
              <>
                {" "}The current invoice is{" "}
                <Link href={`/invoices/${live.id}`} className="font-mono font-semibold underline">
                  {live.invoiceNo}
                </Link>
                , and payments are recorded there.
              </>
            )}
          </div>
        )}

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
            {superseded ? (
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                superseded
              </span>
            ) : (
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  state.settled
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                {state.label}
              </span>
            )}
            {!superseded && (
              <Link
                href={`/invoices/${invoice.id}/edit`}
                title={nextNo ? `Saving creates ${nextNo}; this invoice is kept` : undefined}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Edit{nextNo ? ` (creates ${nextNo})` : ""}
              </Link>
            )}
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

        {chain.length > 1 && (
          <div className="rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Revisions
            </p>
            <ol className="mt-2 space-y-1">
              {chain.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2">
                  {c.id === invoice.id ? (
                    <span className="font-mono font-semibold">{c.invoiceNo}</span>
                  ) : (
                    <Link href={`/invoices/${c.id}`} className="font-mono underline">
                      {c.invoiceNo}
                    </Link>
                  )}
                  <span className="text-xs text-slate-500">
                    {c.issueDate.toLocaleDateString("en-GB")}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      c.supersededAt
                        ? "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    }`}
                  >
                    {c.supersededAt ? "superseded" : "current"}
                  </span>
                  {c.id === invoice.id && <span className="text-xs text-slate-500">(this page)</span>}
                </li>
              ))}
            </ol>
          </div>
        )}

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
                    {line.serialUnits.length > 0 ? (
                      <span className="block font-mono text-xs text-slate-500">
                        S/N: {line.serialUnits.map((s) => s.serialNumber).join(", ")}
                      </span>
                    ) : (
                      line.serialSnapshot && (
                        <span
                          className="block font-mono text-xs text-slate-500"
                          title="The units listed when this invoice was issued. They now belong to the current revision."
                        >
                          S/N (as issued): {line.serialSnapshot}
                        </span>
                      )
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
          {superseded ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
              Payments for this job are recorded on the current revision
              {live ? (
                <>
                  ,{" "}
                  <Link href={`/invoices/${live.id}`} className="font-mono underline">
                    {live.invoiceNo}
                  </Link>
                </>
              ) : null}
              .
            </p>
          ) : (
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
          )}
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
              {totals.balanceDue < 0 && (
                <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-400">
                  Overpaid by {formatLKR(-totals.balanceDue)} - the customer is owed a refund
                  or credit.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
