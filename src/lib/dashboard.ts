import { prisma } from "@/lib/prisma";
import { billTotals, lineTotal } from "@/lib/money";

/**
 * Figures for the owner's dashboard.
 *
 * Definitions, kept in one place because every number on the page depends on
 * them:
 *  - A SALE is a live invoice issued in the period. Superseded revisions are
 *    left out, so an edited job is counted once. Estimates are not sales.
 *  - REVENUE is what the customer is charged: after line and bill discounts.
 *  - COST is the buying price snapshotted on each invoice line x quantity.
 *  - PROFIT is revenue - cost.
 *  - Item-wise revenue shares each invoice's bill discount across its lines in
 *    proportion to their value, with the rounding remainder put on the last
 *    line, so item totals add up exactly to invoice totals.
 */

export type Preset = "today" | "mtd" | "last7" | "last30" | "lastmonth" | "ytd" | "custom";

export interface Period {
  preset: Preset;
  from: Date;
  to: Date;
  label: string;
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

function parseDay(s: string | undefined): Date | null {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const fmt = (d: Date) =>
  d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Resolve the period from the page's query string. Month-to-date by default. */
export function resolvePeriod(q: { p?: string; from?: string; to?: string }, now = new Date()): Period {
  const today = startOfDay(now);
  const preset = (q.p as Preset) ?? "mtd";

  switch (preset) {
    case "today":
      return { preset, from: today, to: endOfDay(now), label: `Today, ${fmt(today)}` };
    case "last7": {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { preset, from, to: endOfDay(now), label: `Last 7 days (${fmt(from)} - ${fmt(today)})` };
    }
    case "last30": {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { preset, from, to: endOfDay(now), label: `Last 30 days (${fmt(from)} - ${fmt(today)})` };
    }
    case "lastmonth": {
      const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
      return {
        preset, from, to,
        label: `Last month (${from.toLocaleDateString("en-GB", { month: "long", year: "numeric" })})`,
      };
    }
    case "ytd": {
      const from = new Date(now.getFullYear(), 0, 1);
      return { preset, from, to: endOfDay(now), label: `Year to date (${now.getFullYear()})` };
    }
    case "custom": {
      const f = parseDay(q.from);
      const t = parseDay(q.to);
      if (f && t) {
        const [a, b] = f <= t ? [f, t] : [t, f];
        return { preset, from: a, to: endOfDay(b), label: `${fmt(a)} - ${fmt(b)}` };
      }
      break; // incomplete custom range falls back to month-to-date
    }
  }
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    preset: "mtd",
    from,
    to: endOfDay(now),
    label: `Month to date (${fmt(from)} - ${fmt(today)})`,
  };
}

export interface ItemRow {
  itemId: number;
  itemCode: string;
  name: string;
  units: number;
  revenue: number;
  cost: number;
  profit: number;
  /** True if any sold line had no buying price - profit is overstated. */
  uncosted: boolean;
  inStock: number | null;
}

export interface InvoiceRow {
  id: number;
  invoiceNo: string;
  issueDate: Date;
  customer: string;
  units: number;
  revenue: number;
  cost: number;
  profit: number;
  paid: number;
  balance: number;
  uncosted: boolean;
}

export interface Bucket {
  key: string;
  label: string;
  revenue: number;
  profit: number;
  invoices: number;
}

export interface StockRow {
  itemId: number;
  itemCode: string;
  name: string;
  inStock: number;
  soldInPeriod: number;
}

export interface Dashboard {
  period: Period;
  totals: {
    revenue: number;
    cost: number;
    profit: number;
    marginPct: number | null;
    invoices: number;
    units: number;
    received: number;
    outstanding: number;
    openEstimates: number;
    openEstimateValue: number;
    uncostedRevenue: number;
  };
  byItem: ItemRow[];
  byInvoice: InvoiceRow[];
  buckets: Bucket[];
  bucketUnit: "day" | "month";
  outOfStock: StockRow[];
  lowStock: StockRow[];
}

export const LOW_STOCK = 2;

export async function loadDashboard(period: Period): Promise<Dashboard> {
  const { from, to } = period;

  const [invoices, received, liveInvoices, openEstimates, trackedItems] = await Promise.all([
    prisma.invoice.findMany({
      where: { supersededAt: null, issueDate: { gte: from, lte: to } },
      orderBy: [{ issueDate: "desc" }, { id: "desc" }],
      include: {
        customer: { select: { name: true } },
        payments: { select: { amount: true } },
        lines: { include: { item: { select: { itemCode: true, name: true } } } },
      },
    }),
    prisma.payment.aggregate({
      where: { paidAt: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
    // Outstanding is "what customers owe right now", whenever it was billed.
    prisma.invoice.findMany({
      where: { supersededAt: null },
      include: { lines: true, payments: { select: { amount: true } } },
    }),
    prisma.quotation.findMany({ where: { invoice: null }, include: { lines: true } }),
    prisma.item.findMany({
      where: { tracksSerials: true },
      select: {
        id: true, itemCode: true, name: true,
        _count: { select: { serialUnits: { where: { status: "in_stock", invoiceLineId: null } } } },
      },
    }),
  ]);

  const stockOf = new Map(trackedItems.map((i) => [i.id, i._count.serialUnits]));
  const items = new Map<number, ItemRow>();
  const byInvoice: InvoiceRow[] = [];

  let revenue = 0, cost = 0, units = 0, uncostedRevenue = 0;

  for (const inv of invoices) {
    const t = billTotals({
      lines: inv.lines,
      billDiscountType: inv.billDiscountType,
      billDiscountValue: inv.billDiscountValue,
      payments: inv.payments,
    });

    // Share the bill discount across lines, remainder on the last line.
    const nets = inv.lines.map((l) => lineTotal(l));
    let allocated = 0;
    const shares = nets.map((net, i) => {
      if (i === nets.length - 1) return t.billDiscount - allocated;
      const s = t.subtotal > 0 ? Math.round((t.billDiscount * net) / t.subtotal) : 0;
      allocated += s;
      return s;
    });

    let invCost = 0, invUnits = 0, invUncosted = false;
    inv.lines.forEach((line, i) => {
      const lineRevenue = nets[i] - shares[i];
      const lineCost = line.costPrice * line.quantity;
      invCost += lineCost;
      invUnits += line.quantity;
      if (line.costPrice === 0) {
        invUncosted = true;
        uncostedRevenue += lineRevenue;
      }
      const row = items.get(line.itemId) ?? {
        itemId: line.itemId, itemCode: line.item.itemCode, name: line.item.name,
        units: 0, revenue: 0, cost: 0, profit: 0, uncosted: false,
        inStock: stockOf.has(line.itemId) ? stockOf.get(line.itemId)! : null,
      };
      row.units += line.quantity;
      row.revenue += lineRevenue;
      row.cost += lineCost;
      row.profit = row.revenue - row.cost;
      row.uncosted ||= line.costPrice === 0;
      items.set(line.itemId, row);
    });

    revenue += t.total;
    cost += invCost;
    units += invUnits;
    byInvoice.push({
      id: inv.id, invoiceNo: inv.invoiceNo, issueDate: inv.issueDate,
      customer: inv.customer.name, units: invUnits,
      revenue: t.total, cost: invCost, profit: t.total - invCost,
      paid: t.paid, balance: t.balanceDue, uncosted: invUncosted,
    });
  }

  // Sales over time: by day for up to ~2 months, by month beyond that.
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const bucketUnit: "day" | "month" = days > 62 ? "month" : "day";
  const buckets = new Map<string, Bucket>();
  const cursor = new Date(from);
  while (cursor <= to) {
    const key = bucketUnit === "day" ? isoDay(cursor) : isoDay(cursor).slice(0, 7);
    if (!buckets.has(key)) {
      buckets.set(key, {
        key,
        label:
          bucketUnit === "day"
            ? cursor.toLocaleDateString("en-GB", { day: "numeric", month: "short" })
            : cursor.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
        revenue: 0, profit: 0, invoices: 0,
      });
    }
    if (bucketUnit === "day") cursor.setDate(cursor.getDate() + 1);
    else cursor.setMonth(cursor.getMonth() + 1, 1);
  }
  for (const r of byInvoice) {
    const key = bucketUnit === "day" ? isoDay(r.issueDate) : isoDay(r.issueDate).slice(0, 7);
    const b = buckets.get(key);
    if (b) {
      b.revenue += r.revenue;
      b.profit += r.profit;
      b.invoices += 1;
    }
  }

  const outstanding = liveInvoices.reduce((sum, inv) => {
    const t = billTotals({
      lines: inv.lines,
      billDiscountType: inv.billDiscountType,
      billDiscountValue: inv.billDiscountValue,
      payments: inv.payments,
    });
    return sum + Math.max(t.balanceDue, 0);
  }, 0);

  const openEstimateValue = openEstimates.reduce(
    (sum, q) =>
      sum +
      billTotals({
        lines: q.lines,
        billDiscountType: q.billDiscountType,
        billDiscountValue: q.billDiscountValue,
      }).total,
    0,
  );

  const soldIn = (id: number) => items.get(id)?.units ?? 0;
  const stockRows: StockRow[] = trackedItems.map((i) => ({
    itemId: i.id, itemCode: i.itemCode, name: i.name,
    inStock: i._count.serialUnits, soldInPeriod: soldIn(i.id),
  }));
  // Best sellers first - running out of those matters most.
  const bySales = (a: StockRow, b: StockRow) =>
    b.soldInPeriod - a.soldInPeriod || a.itemCode.localeCompare(b.itemCode);

  const profit = revenue - cost;
  return {
    period,
    totals: {
      revenue, cost, profit,
      marginPct: revenue === 0 ? null : Math.round((profit / revenue) * 1000) / 10,
      invoices: invoices.length,
      units,
      received: received._sum.amount ?? 0,
      outstanding,
      openEstimates: openEstimates.length,
      openEstimateValue,
      uncostedRevenue,
    },
    byItem: Array.from(items.values()).sort((a, b) => b.revenue - a.revenue),
    byInvoice,
    buckets: Array.from(buckets.values()),
    bucketUnit,
    outOfStock: stockRows.filter((s) => s.inStock === 0).sort(bySales),
    lowStock: stockRows.filter((s) => s.inStock > 0 && s.inStock <= LOW_STOCK).sort(bySales),
  };
}
