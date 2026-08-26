import Link from "next/link";

import PageShell from "@/components/PageShell";
import { prisma } from "@/lib/prisma";
import { billTotals, formatLKR } from "@/lib/money";
import { settlementOf } from "@/lib/invoices";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    orderBy: { issueDate: "desc" },
    take: 100,
    include: { customer: true, lines: true, payments: true },
  });

  const outstanding = invoices.reduce((sum, inv) => {
    const t = billTotals({
      lines: inv.lines,
      billDiscountType: inv.billDiscountType,
      billDiscountValue: inv.billDiscountValue,
      advanceAmount: inv.advanceAmount,
      payments: inv.payments,
    });
    return sum + Math.max(t.balanceDue, 0);
  }, 0);

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Invoices</h1>
            <p className="text-sm text-slate-500">
              Confirmed jobs. Raised by confirming a quotation.
            </p>
          </div>
          {invoices.length > 0 && (
            <div className="text-right">
              <p className="font-mono text-xl font-semibold">
                {formatLKR(outstanding)}
              </p>
              <p className="text-xs text-slate-500">Total outstanding</p>
            </div>
          )}
        </div>

        {invoices.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
            <p className="text-slate-500">No invoices yet.</p>
            <Link href="/quotations" className="mt-2 inline-block text-sm underline">
              Confirm a quotation to raise one
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 font-medium">No.</th>
                  <th className="px-4 py-3 font-medium">Customer</th>
                  <th className="px-4 py-3 font-medium">Issued</th>
                  <th className="px-4 py-3 font-medium">Settlement</th>
                  <th className="px-4 py-3 text-right font-medium">Total</th>
                  <th className="px-4 py-3 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {invoices.map((inv) => {
                  const t = billTotals({
                    lines: inv.lines,
                    billDiscountType: inv.billDiscountType,
                    billDiscountValue: inv.billDiscountValue,
                    advanceAmount: inv.advanceAmount,
                    payments: inv.payments,
                  });
                  const state = settlementOf(t.balanceDue, t.paid);
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td className="px-4 py-3 font-mono">
                        <Link href={`/invoices/${inv.id}`} className="underline">
                          {inv.invoiceNo}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {inv.customer.name}
                        <span className="block font-mono text-xs text-slate-500">
                          {inv.customer.phone}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {inv.issueDate.toLocaleDateString("en-GB")}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
                            state.settled
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {state.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                        {formatLKR(t.total)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                        {formatLKR(Math.max(t.balanceDue, 0))}
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
