import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { formatLKR } from "@/lib/money";
import PageShell from "@/components/PageShell";

export const dynamic = "force-dynamic";

export default async function ItemsPage() {
  const items = await prisma.item.findMany({
    orderBy: { itemCode: "asc" },
    include: {
      // Two different counts, because they answer two different questions:
      //   inStock - units physically on the shelf (a quote is not a sale)
      //   free    - units not already promised on an open quotation
      // Showing only the first is how the same camera gets quoted twice.
      _count: {
        select: {
          serialUnits: { where: { status: "in_stock" } },
        },
      },
    },
  });

  const freeCounts = new Map(
    (
      await prisma.serialUnit.groupBy({
        by: ["itemId"],
        where: { status: "in_stock", quoteLineId: null, invoiceLineId: null },
        _count: { _all: true },
      })
    ).map((row) => [row.itemId, row._count._all]),
  );

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Items</h1>
            <p className="text-sm text-slate-500">
              The catalog of everything IV Technology sells.
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/stock"
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Stock intake
            </Link>
            <Link
              href="/items/new"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Add item
            </Link>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
            <p className="text-slate-500">No items yet.</p>
            <Link
              href="/items/new"
              className="mt-2 inline-block text-sm font-medium underline"
            >
              Add the first one
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 font-medium">Code</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Barcode</th>
                  <th className="px-4 py-3 text-right font-medium">Price</th>
                  <th className="px-4 py-3 text-right font-medium">In stock</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-900">
                    <td className="whitespace-nowrap px-4 py-3 font-mono">
                      {item.itemCode}
                    </td>
                    <td className="px-4 py-3">{item.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-500">
                      {item.barcode ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                      {formatLKR(item.unitPrice)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {item.tracksSerials ? (
                        <Link
                          href={`/stock?itemId=${item.id}`}
                          className="font-mono font-medium underline decoration-dotted"
                          title="Units in stock (units not reserved on a quotation)"
                        >
                          {item._count.serialUnits}
                          {(() => {
                            const free = freeCounts.get(item.id) ?? 0;
                            return free === item._count.serialUnits ? null : (
                              <span className="ml-1 font-normal text-slate-500">
                                ({free} free)
                              </span>
                            );
                          })()}
                        </Link>
                      ) : (
                        <span className="text-slate-400" title="Not serial tracked">
                          not tracked
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <Link
                        href={`/items/${item.id}/edit`}
                        className="text-sm underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
