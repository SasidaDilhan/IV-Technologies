import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { billTotals, formatLKR } from "@/lib/money";
import { searchHistory } from "@/lib/history";
import HistoryResults from "@/components/quotation/HistoryResults";
import PageShell from "@/components/PageShell";

export const dynamic = "force-dynamic";

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const result = q.length >= 2 ? await searchHistory(q) : null;

  const quotations = result
    ? []
    : await prisma.quotation.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { customer: true, lines: true },
      });

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Quotations</h1>
            <p className="text-sm text-slate-500">
              Estimates issued to customers, and the history behind them.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
          >
            New quotation
          </Link>
        </div>

        {/* Plain GET form: the search is shareable and survives a refresh. */}
        <form method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Scan a serial number, or search item code, customer, phone, document no."
            autoComplete="off"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            className="whitespace-nowrap rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Search
          </button>
          {q && (
            <Link
              href="/quotations"
              className="flex items-center whitespace-nowrap px-2 text-sm text-slate-500 underline"
            >
              Clear
            </Link>
          )}
        </form>

        {result ? (
          <HistoryResults result={result} />
        ) : quotations.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
            <p className="text-slate-500">No quotations yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 font-medium">No.</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Issued</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {quotations.map((quote) => {
                  const totals = billTotals({
                    lines: quote.lines,
                    billDiscountType: quote.billDiscountType,
                    billDiscountValue: quote.billDiscountValue,
                  });
                  return (
                    <tr
                      key={quote.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-900"
                    >
                      <td className="px-4 py-3 font-mono">
                        <Link href={`/quotations/${quote.id}`} className="underline">
                          {quote.quoteNo}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {quote.customer.name}
                        <span className="block font-mono text-xs text-slate-500">
                          {quote.customer.phone}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {quote.issueDate.toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-800">
                          {quote.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                        {formatLKR(totals.total)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
