import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { formatLKR, formatMarginPct } from "@/lib/money";
import PageShell from "@/components/PageShell";

export const dynamic = "force-dynamic";

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const items = await prisma.item.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            { itemCode: { contains: q } },
            { barcode: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { itemCode: "asc" },
    include: {
      // Units on the shelf. Quotations do not hold stock, so this is also
      // the number available to sell - only an invoice takes a unit away.
      _count: {
        select: {
          serialUnits: { where: { status: "in_stock" } },
        },
      },
    },
  });


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

        <form method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name, item code or barcode"
            autoComplete="off"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            className="whitespace-nowrap rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Search
          </button>
          {q && (
            <Link href="/items" className="flex items-center px-2 text-sm text-slate-500 underline">
              Clear
            </Link>
          )}
        </form>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
            <p className="text-slate-500">
              {q ? `No item matches "${q}".` : "No items yet."}
            </p>
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
                  <th className="px-4 py-3 text-right font-medium">Buying</th>
                  <th className="px-4 py-3 text-right font-medium">Selling</th>
                  <th className="px-4 py-3 text-right font-medium">Margin</th>
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
                    <td className="px-4 py-3">
                      {item.name}
                      {item.description && (
                        <span className="block whitespace-pre-line text-xs text-slate-500">
                          {item.description}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-slate-500">
                      {item.barcode ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-slate-500">
                      {item.costPrice ? formatLKR(item.costPrice) : "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                      {formatLKR(item.unitPrice)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono">
                      {(() => {
                        // Margin is buying vs selling as entered on the item.
                        if (!item.costPrice) return <span className="text-slate-400">-</span>;
                        const m = item.unitPrice - item.costPrice;
                        const pct =
                          item.unitPrice === 0
                            ? null
                            : Math.round((m / item.unitPrice) * 1000) / 10;
                        return (
                          <span
                            className={
                              m < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-emerald-700 dark:text-emerald-400"
                            }
                          >
                            {formatLKR(m)}
                            <span className="block text-xs">{formatMarginPct(pct)}</span>
                          </span>
                        );
                      })()}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      {item.tracksSerials ? (
                        <Link
                          href={`/stock?itemId=${item.id}`}
                          className="font-mono font-medium underline decoration-dotted"
                          title="Units in stock and available to sell"
                        >
                          {item._count.serialUnits}
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
                        Edit prices
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
