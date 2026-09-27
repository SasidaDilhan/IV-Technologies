import Link from "next/link";

import DocumentTable from "@/components/DocumentTable";
import PageShell from "@/components/PageShell";
import { loadDocuments } from "@/lib/documents";

export const dynamic = "force-dynamic";

/**
 * Estimates still waiting on the customer: every quotation saved from the
 * billing screen that has not yet been converted to an invoice. Once it is
 * converted it leaves this list and appears under Invoices.
 */
export default async function EstimatesPage() {
  const rows = await loadDocuments({ kind: "quotation", estimatesOnly: true });

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Estimates</h1>
            <p className="text-sm text-slate-500">
              Saved from the billing screen and not yet invoiced. Open one to edit
              it or convert it to an invoice.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
          >
            New estimate
          </Link>
        </div>

        <DocumentTable rows={rows} empty="No open estimates. Every estimate has been invoiced." />
      </div>
    </PageShell>
  );
}
