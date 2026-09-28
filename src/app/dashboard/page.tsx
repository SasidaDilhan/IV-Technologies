import Link from "next/link";

import PageShell from "@/components/PageShell";
import SalesChart from "@/components/dashboard/SalesChart";
import { LOW_STOCK, isoDay, loadDashboard, resolvePeriod, type Preset } from "@/lib/dashboard";
import { formatLKR, formatMarginPct, marginPctOf } from "@/lib/money";

export const dynamic = "force-dynamic";

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "mtd", label: "This month" },
  { key: "last7", label: "Last 7 days" },
  { key: "last30", label: "Last 30 days" },
  { key: "lastmonth", label: "Last month" },
  { key: "ytd", label: "This year" },
];

/** Margin on cost, as everywhere in the app. */
const pct = (profit: number, cost: number) => marginPctOf(profit, cost);

function Tile({
  label,
  value,
  sub,
  tone = "plain",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "plain" | "good" | "bad" | "warn";
}) {
  const valueTone =
    tone === "good"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "bad"
        ? "text-red-600 dark:text-red-400"
        : tone === "warn"
          ? "text-amber-700 dark:text-amber-400"
          : "";
  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-semibold tabular-nums ${valueTone}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

const th = "px-3 py-2 font-medium";
const thR = `${th} text-right`;
const td = "px-3 py-2";
const tdR = `${td} whitespace-nowrap text-right font-mono`;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { p?: string; from?: string; to?: string };
}) {
  const period = resolvePeriod(searchParams);
  const d = await loadDashboard(period);
  const t = d.totals;

  return (
    <PageShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard</h1>
            <p className="text-sm text-slate-500">{period.label}</p>
          </div>
          <span className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-500 dark:border-slate-700">
            Internal - cost and profit are never printed on customer documents
          </span>
        </div>

        {/* ---- period ------------------------------------------------------ */}
        <div className="flex flex-wrap items-end gap-2">
          {PRESETS.map((p) => (
            <Link
              key={p.key}
              href={p.key === "mtd" ? "/dashboard" : `/dashboard?p=${p.key}`}
              className={`rounded-full px-3 py-1.5 text-sm ${
                period.preset === p.key
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              }`}
            >
              {p.label}
            </Link>
          ))}
          <form method="get" className="ml-auto flex flex-wrap items-end gap-2">
            <input type="hidden" name="p" value="custom" />
            <label className="text-xs text-slate-500">
              From
              <input
                type="date"
                name="from"
                defaultValue={isoDay(period.from)}
                className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="text-xs text-slate-500">
              To
              <input
                type="date"
                name="to"
                defaultValue={isoDay(period.to)}
                className="mt-1 block rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <button
              type="submit"
              className={`rounded-md px-3 py-1.5 text-sm ${
                period.preset === "custom"
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "border border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
              }`}
            >
              Show
            </button>
          </form>
        </div>

        {/* ---- headline numbers ------------------------------------------- */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile label="Sales" value={formatLKR(t.revenue)} sub={`${t.invoices} invoice${t.invoices === 1 ? "" : "s"}`} />
          <Tile label="Cost" value={formatLKR(t.cost)} sub="buying price of what was sold" />
          <Tile
            label="Profit"
            value={formatLKR(t.profit)}
            sub={`margin ${formatMarginPct(t.marginPct)}`}
            tone={t.profit < 0 ? "bad" : t.profit > 0 ? "good" : "plain"}
          />
          <Tile label="Units sold" value={String(t.units)} sub={`${d.byItem.length} different item${d.byItem.length === 1 ? "" : "s"}`} />
          <Tile label="Cash received" value={formatLKR(t.received)} sub="payments taken in this period" />
          <Tile
            label="Owed to you"
            value={formatLKR(t.outstanding)}
            sub="unpaid balance, all invoices"
            tone={t.outstanding > 0 ? "warn" : "plain"}
          />
          <Tile
            label="Open estimates"
            value={String(t.openEstimates)}
            sub={`worth ${formatLKR(t.openEstimateValue)} if confirmed`}
          />
          <Tile
            label="Out of stock"
            value={String(d.outOfStock.length)}
            sub={`${d.lowStock.length} more running low (${LOW_STOCK} or fewer)`}
            tone={d.outOfStock.length > 0 ? "bad" : "plain"}
          />
        </div>

        {t.uncostedRevenue > 0 && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <strong>{formatLKR(t.uncostedRevenue)}</strong> of these sales were items with no buying
            price, so they count as zero cost and <strong>profit is shown higher than it really is</strong>.
            Labour is expected to have none; for goods, add the buying price under{" "}
            <Link href="/items" className="underline">Items</Link> (it applies to new bills).
          </p>
        )}

        {/* ---- sales over time ------------------------------------------- */}
        <section className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-sm font-medium">
            Sales per {d.bucketUnit}{" "}
            <span className="font-normal text-slate-500">- hover a bar for the figures</span>
          </h2>
          <div className="mt-3">
            {t.invoices === 0 ? (
              <p className="py-12 text-center text-sm text-slate-500">No invoices in this period.</p>
            ) : (
              <SalesChart buckets={d.buckets} unit={d.bucketUnit} />
            )}
          </div>
        </section>

        {/* ---- stock alerts ---------------------------------------------- */}
        <section className="grid gap-4 lg:grid-cols-2">
          {[
            { title: "Out of stock", rows: d.outOfStock, empty: "Nothing is out of stock.", bad: true },
            { title: `Running low (${LOW_STOCK} or fewer left)`, rows: d.lowStock, empty: "Nothing is running low.", bad: false },
          ].map((block) => (
            <div key={block.title} className="rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
                <h2 className="text-sm font-medium">{block.title}</h2>
                <Link href="/stock" className="text-xs text-slate-500 underline">Stock intake</Link>
              </div>
              {block.rows.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-500">{block.empty}</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500">
                    <tr>
                      <th className={th}>Item</th>
                      <th className={thR}>In stock</th>
                      <th className={thR}>Sold this period</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {block.rows.map((s) => (
                      <tr key={s.itemId}>
                        <td className={td}>
                          <Link href={`/stock?itemId=${s.itemId}`} className="hover:underline">{s.name}</Link>
                          <span className="block font-mono text-xs text-slate-500">{s.itemCode}</span>
                        </td>
                        <td className={`${tdR} ${block.bad ? "font-semibold text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"}`}>
                          {s.inStock}
                        </td>
                        <td className={tdR}>{s.soldInPeriod}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ))}
        </section>
        <p className="-mt-2 text-xs text-slate-500">
          Stock is counted for serial-tracked items only. Other items are not stock-counted and never
          block a sale.
        </p>

        {/* ---- item-wise --------------------------------------------------- */}
        <section className="rounded-lg border border-slate-200 dark:border-slate-800">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-medium dark:border-slate-800">
            Sales by item <span className="font-normal text-slate-500">- highest sales first</span>
          </h2>
          {d.byItem.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Nothing sold in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className={th}>Item</th>
                    <th className={thR}>Units sold</th>
                    <th className={thR}>Sales</th>
                    <th className={thR}>Cost</th>
                    <th className={thR}>Profit</th>
                    <th className={thR}>Margin</th>
                    <th className={thR}>In stock</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {d.byItem.map((r) => (
                    <tr key={r.itemId}>
                      <td className={td}>
                        {r.name}
                        <span className="block font-mono text-xs text-slate-500">
                          {r.itemCode}
                          {r.uncosted && <span className="ml-1 text-amber-600">· no buying price</span>}
                        </span>
                      </td>
                      <td className={tdR}>{r.units}</td>
                      <td className={tdR}>{formatLKR(r.revenue)}</td>
                      <td className={`${tdR} text-slate-500`}>{formatLKR(r.cost)}</td>
                      <td className={`${tdR} ${r.profit < 0 ? "text-red-600 dark:text-red-400" : ""}`}>{formatLKR(r.profit)}</td>
                      <td className={tdR}>{formatMarginPct(pct(r.profit, r.cost))}</td>
                      <td className={`${tdR} ${r.inStock === 0 ? "font-semibold text-red-600 dark:text-red-400" : ""}`}>
                        {r.inStock === null ? <span className="text-slate-400">-</span> : r.inStock}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 font-medium dark:border-slate-700">
                  <tr>
                    <td className={td}>Total</td>
                    <td className={tdR}>{t.units}</td>
                    <td className={tdR}>{formatLKR(t.revenue)}</td>
                    <td className={tdR}>{formatLKR(t.cost)}</td>
                    <td className={tdR}>{formatLKR(t.profit)}</td>
                    <td className={tdR}>{formatMarginPct(t.marginPct)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* ---- invoice-wise ------------------------------------------------ */}
        <section className="rounded-lg border border-slate-200 dark:border-slate-800">
          <h2 className="border-b border-slate-200 px-4 py-3 text-sm font-medium dark:border-slate-800">
            Sales by invoice <span className="font-normal text-slate-500">- newest first</span>
          </h2>
          {d.byInvoice.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">No invoices in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className={th}>Invoice</th>
                    <th className={th}>Date</th>
                    <th className={th}>Customer</th>
                    <th className={thR}>Units</th>
                    <th className={thR}>Sales</th>
                    <th className={thR}>Cost</th>
                    <th className={thR}>Profit</th>
                    <th className={thR}>Margin</th>
                    <th className={thR}>Still owed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {d.byInvoice.map((r) => (
                    <tr key={r.id}>
                      <td className={`${td} font-mono`}>
                        <Link href={`/invoices/${r.id}`} className="underline">{r.invoiceNo}</Link>
                        {r.uncosted && <span className="block font-sans text-xs text-amber-600">some lines have no buying price</span>}
                      </td>
                      <td className={`${td} whitespace-nowrap`}>{r.issueDate.toLocaleDateString("en-GB")}</td>
                      <td className={td}>{r.customer}</td>
                      <td className={tdR}>{r.units}</td>
                      <td className={tdR}>{formatLKR(r.revenue)}</td>
                      <td className={`${tdR} text-slate-500`}>{formatLKR(r.cost)}</td>
                      <td className={`${tdR} ${r.profit < 0 ? "text-red-600 dark:text-red-400" : ""}`}>{formatLKR(r.profit)}</td>
                      <td className={tdR}>{formatMarginPct(pct(r.profit, r.cost))}</td>
                      <td className={`${tdR} ${r.balance > 0 ? "text-amber-700 dark:text-amber-400" : "text-slate-400"}`}>
                        {r.balance > 0 ? formatLKR(r.balance) : "paid"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-200 font-medium dark:border-slate-700">
                  <tr>
                    <td className={td} colSpan={3}>Total ({t.invoices})</td>
                    <td className={tdR}>{t.units}</td>
                    <td className={tdR}>{formatLKR(t.revenue)}</td>
                    <td className={tdR}>{formatLKR(t.cost)}</td>
                    <td className={tdR}>{formatLKR(t.profit)}</td>
                    <td className={tdR}>{formatMarginPct(t.marginPct)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
