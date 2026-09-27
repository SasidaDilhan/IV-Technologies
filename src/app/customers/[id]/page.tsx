import Link from "next/link";
import { notFound } from "next/navigation";

import PageShell from "@/components/PageShell";
import { statusLabel } from "@/lib/status";
import { prisma } from "@/lib/prisma";
import { billTotals, formatLKR } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * One customer and everything they have ever been billed, oldest to newest -
 * the "show me everything this customer bought" lookup.
 */
export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      quotations: {
        orderBy: { issueDate: "asc" },
        include: {
          lines: {
            include: { item: true, serialUnits: { orderBy: { serialNumber: "asc" } } },
          },
        },
      },
      invoices: {
        orderBy: { issueDate: "asc" },
        include: {
          payments: true,
          lines: {
            include: { item: true, serialUnits: { orderBy: { serialNumber: "asc" } } },
          },
        },
      },
    },
  });
  if (!customer) notFound();

  type Row = {
    kind: "quotation" | "invoice";
    id: number;
    number: string;
    date: Date;
    status: string;
    total: number;
    lines: {
      name: string;
      itemCode: string;
      quantity: number;
      serialNumbers: string[];
    }[];
  };

  const rows: Row[] = [
    ...customer.quotations.map((q) => ({
      kind: "quotation" as const,
      id: q.id,
      number: q.quoteNo,
      date: q.issueDate,
      status: q.status,
      total: billTotals({
        lines: q.lines,
        billDiscountType: q.billDiscountType,
        billDiscountValue: q.billDiscountValue,
      }).total,
      lines: q.lines.map((l) => ({
        name: l.item.name,
        itemCode: l.item.itemCode,
        quantity: l.quantity,
        serialNumbers: l.serialUnits.map((s) => s.serialNumber),
      })),
    })),
    ...customer.invoices.map((inv) => ({
      kind: "invoice" as const,
      id: inv.id,
      number: inv.invoiceNo,
      date: inv.issueDate,
      status: inv.status,
      total: billTotals({
        lines: inv.lines,
        billDiscountType: inv.billDiscountType,
        billDiscountValue: inv.billDiscountValue,
        advanceAmount: inv.advanceAmount,
        payments: inv.payments,
      }).total,
      lines: inv.lines.map((l) => ({
        name: l.item.name,
        itemCode: l.item.itemCode,
        quantity: l.quantity,
        serialNumbers: l.serialUnits.map((s) => s.serialNumber),
      })),
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Every serial-tracked unit this customer has ever been given.
  const units = rows.flatMap((row) =>
    row.lines.flatMap((line) =>
      line.serialNumbers.map((serial) => ({
        serial,
        item: line.name,
        on: row.number,
      })),
    ),
  );

  // A superseded invoice was replaced by a revision of the same job, so only
  // the live revision counts - otherwise an edited job is counted twice.
  const invoicedTotal = rows
    .filter((r) => r.kind === "invoice" && r.status !== "superseded")
    .reduce((sum, r) => sum + r.total, 0);

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/customers" className="text-sm text-slate-500 hover:underline">
              &larr; Customers
            </Link>
            <h1 className="mt-1 text-2xl font-semibold">{customer.name}</h1>
            <p className="font-mono text-sm text-slate-600 dark:text-slate-400">
              {customer.phone}
            </p>
            {customer.address && (
              <p className="text-sm text-slate-500">{customer.address}</p>
            )}
          </div>
          <Link
            href={`/customers/${customer.id}/edit`}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Edit details
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Quotations", value: String(customer.quotations.length) },
            { label: "Invoices", value: String(customer.invoices.length) },
            { label: "Invoiced total", value: formatLKR(invoicedTotal) },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
            >
              <p className="font-mono text-xl font-semibold">{stat.value}</p>
              <p className="text-sm text-slate-500">{stat.label}</p>
            </div>
          ))}
        </div>

        <div>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            History (oldest first)
          </h2>
          {rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
              Nothing billed to this customer yet.
            </p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <div
                  key={`${row.kind}-${row.id}`}
                  className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-wide text-slate-500">
                        {row.kind === "quotation" ? "Quotation" : "Invoice"}
                      </span>
                      {row.kind === "quotation" ? (
                        <Link
                          href={`/quotations/${row.id}`}
                          className="font-mono font-medium underline"
                        >
                          {row.number}
                        </Link>
                      ) : (
                        <span className="font-mono font-medium">{row.number}</span>
                      )}
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-800">
                        {statusLabel(row.kind, row.status)}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">
                        {row.date.toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                      <p className="font-mono font-medium">{formatLKR(row.total)}</p>
                    </div>
                  </div>
                  <ul className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-sm dark:border-slate-800">
                    {row.lines.map((line, i) => (
                      <li key={i} className="flex justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block truncate">{line.name}</span>
                          {line.serialNumbers.length > 0 && (
                            <span className="block font-mono text-xs text-slate-500">
                              S/N: {line.serialNumbers.join(", ")}
                            </span>
                          )}
                        </span>
                        <span className="whitespace-nowrap font-mono text-xs text-slate-500">
                          &times; {line.quantity}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        {units.length > 0 && (
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Units held by this customer
            </h2>
            <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-2 font-medium">Serial</th>
                    <th className="px-4 py-2 font-medium">Item</th>
                    <th className="px-4 py-2 font-medium">Document</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {units.map((unit, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 font-mono">{unit.serial}</td>
                      <td className="px-4 py-2">{unit.item}</td>
                      <td className="px-4 py-2 font-mono text-slate-500">{unit.on}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
