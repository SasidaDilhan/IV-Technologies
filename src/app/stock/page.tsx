import Link from "next/link";

import RemoveSerialButton from "@/components/RemoveSerialButton";
import SerialIntake from "@/components/SerialIntake";
import { prisma } from "@/lib/prisma";
import { addSerial } from "./actions";
import PageShell from "@/components/PageShell";

export const dynamic = "force-dynamic";

export default async function StockPage({
  searchParams,
}: {
  searchParams: { itemId?: string };
}) {
  const trackedItems = await prisma.item.findMany({
    where: { tracksSerials: true },
    orderBy: { itemCode: "asc" },
    include: {
      _count: { select: { serialUnits: { where: { status: "in_stock" } } } },
    },
  });

  const requestedId = Number(searchParams.itemId);
  const selected =
    Number.isInteger(requestedId) && requestedId > 0
      ? (trackedItems.find((i) => i.id === requestedId) ?? null)
      : null;

  const units = selected
    ? await prisma.serialUnit.findMany({
        where: { itemId: selected.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : [];

  return (
    <PageShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Stock intake</h1>
          <p className="text-sm text-slate-500">
            Log each physical unit as it arrives. Every serial becomes one
            <span className="mx-1 font-mono">in_stock</span>row.
          </p>
        </div>

        {trackedItems.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
            <p className="text-slate-500">
              No serial-tracked items yet. Turn on &ldquo;Track serial
              numbers&rdquo; on an item first.
            </p>
            <Link href="/items" className="mt-2 inline-block text-sm underline">
              Go to items
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-[260px_1fr]">
            {/* Item picker */}
            <aside className="space-y-1">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Serial-tracked items
              </h2>
              {trackedItems.map((item) => {
                const active = selected?.id === item.id;
                return (
                  <Link
                    key={item.id}
                    href={`/stock?itemId=${item.id}`}
                    className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${
                      active
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="truncate font-mono">{item.itemCode}</span>
                    <span
                      className={
                        active ? "font-mono text-xs" : "font-mono text-xs text-slate-500"
                      }
                    >
                      {item._count.serialUnits}
                    </span>
                  </Link>
                );
              })}
            </aside>

            <section className="space-y-5">
              {!selected ? (
                <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-slate-500 dark:border-slate-700">
                  Pick an item code on the left to start scanning.
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                    <p className="font-mono text-sm font-medium">{selected.itemCode}</p>
                    <p className="mb-4 text-sm text-slate-500">{selected.name}</p>
                    <SerialIntake
                      action={addSerial.bind(null, selected.id)}
                      itemCode={selected.itemCode}
                    />
                  </div>

                  <div>
                    <h2 className="mb-2 text-sm font-medium">
                      Units for this item{" "}
                      <span className="text-slate-500">
                        ({selected._count.serialUnits} in stock
                        {units.length > selected._count.serialUnits &&
                          `, ${units.length - selected._count.serialUnits} sold`}
                        )
                      </span>
                    </h2>

                    {units.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700">
                        Nothing logged yet.
                      </p>
                    ) : (
                      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
                        {units.map((unit) => (
                          <li
                            key={unit.id}
                            className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                          >
                            <span className="font-mono">{unit.serialNumber}</span>
                            <span className="flex items-center gap-3">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs ${
                                  unit.status === "in_stock"
                                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                    : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                                }`}
                              >
                                {unit.status}
                              </span>
                              {unit.status === "in_stock" &&
                                !unit.invoiceLineId &&
                                !unit.quoteLineId && <RemoveSerialButton id={unit.id} />}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {units.length === 100 && (
                      <p className="mt-2 text-xs text-slate-500">
                        Showing the 100 most recent units.
                      </p>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </PageShell>
  );
}
