import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { formatLKR, formatMarginPct, marginPctOf } from "@/lib/money";
import PageShell from "@/components/PageShell";

export const dynamic = "force-dynamic";

type DateBy = "either" | "created" | "stock";

/**
 * A yyyy-mm-dd from a date input, as the start or end of that day in the
 * shop's local time. The server runs on the shop machine, so local time is
 * the shop's calendar.
 */
function dayBound(value: string | undefined, end: boolean): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00"}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default async function ItemsPage({
  searchParams,
}: {
  searchParams: { q?: string; from?: string; to?: string; by?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const from = dayBound(searchParams.from, false);
  const to = dayBound(searchParams.to, true);
  const by: DateBy =
    searchParams.by === "created" || searchParams.by === "stock"
      ? searchParams.by
      : "either";
  const hasRange = from !== null || to !== null;
  const range = {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };

  const textFilter = q
    ? {
        OR: [
          { name: { contains: q } },
          { itemCode: { contains: q } },
          { barcode: { contains: q } },
        ],
      }
    : {};

  // "Stock added" means serial numbers logged at stock intake in the range.
  // Items without serial tracking have no intake record, so they can only
  // match on their created date.
  const createdInRange = { createdAt: range };
  const stockInRange = { serialUnits: { some: { createdAt: range } } };
  const dateFilter = !hasRange
    ? {}
    : by === "created"
      ? createdInRange
      : by === "stock"
        ? stockInRange
        : { OR: [createdInRange, stockInRange] };

  const items = await prisma.item.findMany({
    where: { AND: [textFilter, dateFilter] },
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

  // How many units were logged in the range, per item - shown beside each row
  // so it is clear WHY an item matched.
  const addedInRange = hasRange
    ? new Map(
        (
          await prisma.serialUnit.groupBy({
            by: ["itemId"],
            where: { createdAt: range, itemId: { in: items.map((i) => i.id) } },
            _count: { _all: true },
          })
        ).map((r) => [r.itemId, r._count._all]),
      )
    : new Map<number, number>();

  const filtered = q !== "" || hasRange;
  const fieldClass =
    "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
    "focus:outline-none focus:ring-2 focus:ring-slate-400 " +
    "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";


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

        <form method="get" className="space-y-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name, item code or barcode"
            autoComplete="off"
            className={`${fieldClass} w-full`}
          />
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-500">
              From
              <input
                type="date"
                name="from"
                defaultValue={searchParams.from ?? ""}
                className={`${fieldClass} mt-1 block`}
              />
            </label>
            <label className="text-xs text-slate-500">
              To
              <input
                type="date"
                name="to"
                defaultValue={searchParams.to ?? ""}
                className={`${fieldClass} mt-1 block`}
              />
            </label>
            <label className="text-xs text-slate-500">
              Match by
              <select name="by" defaultValue={by} className={`${fieldClass} mt-1 block`}>
                <option value="either">Created or stock added</option>
                <option value="created">Created date only</option>
                <option value="stock">Stock added date only</option>
              </select>
            </label>
            <button
              type="submit"
              className="whitespace-nowrap rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Search
            </button>
            {filtered && (
              <Link href="/items" className="px-2 py-2 text-sm text-slate-500 underline">
                Clear
              </Link>
            )}
          </div>
          {hasRange && (
            <p className="text-xs text-slate-500">
              {items.length} item{items.length === 1 ? "" : "s"}
              {by === "created"
                ? " created"
                : by === "stock"
                  ? " with stock added"
                  : " created or with stock added"}
              {from ? ` from ${from.toLocaleDateString("en-GB")}` : ""}
              {to ? ` to ${to.toLocaleDateString("en-GB")}` : ""}. Stock added
              dates come from serial numbers logged at Stock intake.
            </p>
          )}
        </form>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
            <p className="text-slate-500">
              {filtered ? "No items match these filters." : "No items yet."}
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
                  <th className="px-4 py-3 font-medium">Created</th>
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
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                      {item.createdAt.toLocaleDateString("en-GB")}
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
                        const pct = marginPctOf(m, item.costPrice);
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
                        <>
                          <Link
                            href={`/stock?itemId=${item.id}`}
                            className="font-mono font-medium underline decoration-dotted"
                            title="Units in stock and available to sell"
                          >
                            {item._count.serialUnits}
                          </Link>
                          {(addedInRange.get(item.id) ?? 0) > 0 && (
                            <span className="block text-xs text-emerald-700 dark:text-emerald-400">
                              +{addedInRange.get(item.id)} added in range
                            </span>
                          )}
                        </>
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
