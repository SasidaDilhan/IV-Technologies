import Link from "next/link";

import DocumentTable from "@/components/DocumentTable";
import HistoryResults from "@/components/quotation/HistoryResults";
import PageShell from "@/components/PageShell";
import { loadDocuments } from "@/lib/documents";
import { searchHistory } from "@/lib/history";

export const dynamic = "force-dynamic";

const TABS = [
  { key: "all", label: "All" },
  { key: "estimates", label: "Estimates" },
  { key: "invoices", label: "Invoices" },
] as const;

/**
 * History: every estimate and every invoice, newest first.
 *
 * Searching (serial, item code, customer, phone, document number) swaps the
 * list for the detailed search results, as before.
 */
export default async function HistoryPage({
  searchParams,
}: {
  searchParams: { q?: string; type?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const type =
    searchParams.type === "estimates" || searchParams.type === "invoices"
      ? searchParams.type
      : "all";

  const result = q.length >= 2 ? await searchHistory(q) : null;
  const rows = result
    ? []
    : await loadDocuments({
        kind:
          type === "estimates" ? "quotation" : type === "invoices" ? "invoice" : undefined,
      });

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">History</h1>
            <p className="text-sm text-slate-500">
              Every estimate and invoice, newest first.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
          >
            New estimate
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
        ) : (
          <>
            <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
              {TABS.map((tab) => (
                <Link
                  key={tab.key}
                  href={tab.key === "all" ? "/quotations" : `/quotations?type=${tab.key}`}
                  className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                    type === tab.key
                      ? "border-slate-900 font-medium dark:border-slate-100"
                      : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
            <DocumentTable
              rows={rows}
              empty={
                type === "estimates"
                  ? "No estimates yet."
                  : type === "invoices"
                    ? "No invoices yet."
                    : "Nothing issued yet."
              }
            />
          </>
        )}
      </div>
    </PageShell>
  );
}
