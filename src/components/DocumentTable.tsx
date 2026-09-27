import Link from "next/link";

import type { DocumentRow } from "@/lib/documents";
import { formatLKR } from "@/lib/money";
import { statusLabel, statusTone } from "@/lib/status";

/** Estimates and invoices in one table, each linking to its own page. */
export default function DocumentTable({
  rows,
  empty,
}: {
  rows: DocumentRow[];
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
        <p className="text-slate-500">{empty}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left dark:bg-slate-900">
          <tr>
            <th className="px-4 py-3 font-medium">No.</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Customer</th>
            <th className="px-4 py-3 font-medium">Issued</th>
            <th className="px-4 py-3 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
          {rows.map((row) => {
            const faded = row.kind === "invoice" && row.status === "superseded";
            return (
              <tr
                key={`${row.kind}-${row.id}`}
                className={`hover:bg-slate-50 dark:hover:bg-slate-900 ${faded ? "opacity-60" : ""}`}
              >
                <td className="px-4 py-3 font-mono">
                  <Link
                    href={
                      row.kind === "quotation"
                        ? `/quotations/${row.id}`
                        : `/invoices/${row.id}`
                    }
                    className="underline"
                  >
                    {row.number}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${statusTone(row.kind, row.status)}`}
                  >
                    {statusLabel(row.kind, row.status)}
                  </span>
                  {row.invoiceNo && (
                    <span className="ml-1 font-mono text-xs text-slate-500">
                      &rarr; {row.invoiceNo}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/customers/${row.customer.id}`} className="hover:underline">
                    {row.customer.name}
                  </Link>
                  <span className="block font-mono text-xs text-slate-500">
                    {row.customer.phone}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {row.issueDate.toLocaleDateString("en-GB")}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                  {formatLKR(row.total)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
