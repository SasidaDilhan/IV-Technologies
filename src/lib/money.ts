/**
 * Money handling for the billing system.
 *
 * Every monetary value in the database is an integer number of CENTS.
 * Nothing in this codebase should do arithmetic on a floating-point rupee
 * value - convert at the edges (form input, printed output) and keep the
 * middle in integers.
 */

export type DiscountType = "fixed" | "percent";

/** Rupees (as typed by a human) -> cents. `1250.50` -> `125050`. */
export function toCents(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Cents -> rupees as a number. Use only for display. */
export function toRupees(cents: number): number {
  return cents / 100;
}

/**
 * Cents -> "LKR Rs18,500.00".
 *
 * This is the format IV Technology's existing estimates use (code + symbol),
 * kept so a bill from this system is visually identical to their old paper.
 * Change the prefix here to change it everywhere.
 *
 * Intl would separate the code with a non-breaking space (U+00A0), which is
 * harmless in HTML but depends on font glyph coverage in a PDF, so the number
 * is formatted on its own and the prefix added with plain spaces.
 */
export function formatLKR(cents: number): string {
  const negative = cents < 0;
  const number = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(toRupees(cents)));
  return `${negative ? "-" : ""}LKR Rs${number}`;
}

/**
 * Resolve a (type, value) discount pair against a base amount, in cents.
 *
 * "fixed"   -> value is cents off
 * "percent" -> value is basis points (1000 = 10.00%)
 *
 * Never returns more than `base`, so a mis-keyed discount cannot make a
 * line or a bill go negative.
 */
export function discountAmount(
  base: number,
  type: string,
  value: number,
): number {
  if (value <= 0) return 0;
  const raw = type === "percent" ? Math.round((base * value) / 10000) : value;
  return Math.min(raw, Math.max(base, 0));
}

export interface BillLineLike {
  unitPrice: number;
  quantity: number;
  lineDiscountType: string;
  lineDiscountValue: number;
}

/** Net total for one line, after its own discount. */
export function lineTotal(line: BillLineLike): number {
  const gross = line.unitPrice * line.quantity;
  return gross - discountAmount(gross, line.lineDiscountType, line.lineDiscountValue);
}

export interface BillTotalsInput {
  lines: BillLineLike[];
  billDiscountType: string;
  billDiscountValue: number;
  /** Invoices only. */
  advanceAmount?: number;
  /** Invoices only. */
  payments?: { amount: number }[];
}

export interface BillTotals {
  subtotal: number;
  billDiscount: number;
  /** What the customer owes in total for the job. */
  total: number;
  advance: number;
  paid: number;
  /** total - advance - paid. The number printed as "Balance Due". */
  balanceDue: number;
}

/**
 * The single place bill arithmetic happens. `balanceDue` is derived here
 * rather than stored, so it cannot fall out of step with the lines or the
 * payment history.
 */
export function billTotals(input: BillTotalsInput): BillTotals {
  const subtotal = input.lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const billDiscount = discountAmount(
    subtotal,
    input.billDiscountType,
    input.billDiscountValue,
  );
  const total = subtotal - billDiscount;
  const advance = input.advanceAmount ?? 0;
  const paid = (input.payments ?? []).reduce((sum, p) => sum + p.amount, 0);

  return {
    subtotal,
    billDiscount,
    total,
    advance,
    paid,
    balanceDue: total - advance - paid,
  };
}

/**
 * Convert a discount as typed by a human into the (type, value) pair the
 * database stores. Shared by the client preview and the server save so the
 * two can never compute a different number.
 *
 * "fixed"   "2500"  -> { type: "fixed",   value: 250000 }  (cents)
 * "percent" "7.5"   -> { type: "percent", value: 750 }     (basis points)
 *
 * Returns null when the text is not a valid amount, so callers can report it.
 */
export function parseDiscountInput(
  type: string,
  text: string,
): { type: string; value: number } | null {
  const trimmed = text.trim();
  if (!trimmed) return { type: type === "percent" ? "percent" : "fixed", value: 0 };

  const cleaned = trimmed.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;

  const n = Number(cleaned);
  if (type === "percent") {
    if (n > 100) return null;
    return { type: "percent", value: Math.round(n * 100) };
  }
  return { type: "fixed", value: Math.round(n * 100) };
}

/** Inverse of parseDiscountInput, for loading a saved bill back into a form. */
export function formatDiscountInput(type: string, value: number): string {
  if (!value) return "";
  return type === "percent" ? String(value / 100) : String(value / 100);
}

// ---------------------------------------------------------------------------
// Margin
//
// Internal figures only. They are shown while a bill is being built and on the
// bill's own screen, and never appear on a customer-facing document.
// ---------------------------------------------------------------------------

export interface MarginLineLike extends BillLineLike {
  /** Buying price per unit, in cents, as snapshotted on the line. */
  costPrice: number;
}

export interface Margin {
  /** What the goods cost, in cents. */
  cost: number;
  /** What the customer is charged, after discounts, in cents. */
  revenue: number;
  /** revenue - cost. Negative means the bill loses money. */
  margin: number;
  /**
   * Margin as a percentage of revenue, to one decimal place, or null when
   * there is no revenue to divide by - a free line has no meaningful
   * percentage, and dividing by zero would print Infinity on the till.
   */
  marginPct: number | null;
}

function shape(cost: number, revenue: number): Margin {
  const margin = revenue - cost;
  return {
    cost,
    revenue,
    margin,
    marginPct: revenue === 0 ? null : Math.round((margin / revenue) * 1000) / 10,
  };
}

/** Margin on a single bill line, after that line's own discount. */
export function lineMargin(line: MarginLineLike): Margin {
  return shape(line.costPrice * line.quantity, lineTotal(line));
}

/**
 * Margin across a whole bill.
 *
 * The bill-level discount comes off the revenue but never off the cost - the
 * shop still paid for the goods - so discounting a job eats directly into the
 * margin. That is exactly the number the person pricing the job needs to see.
 */
export function billMargin(input: {
  lines: MarginLineLike[];
  billDiscountType: string;
  billDiscountValue: number;
}): Margin {
  const cost = input.lines.reduce((sum, l) => sum + l.costPrice * l.quantity, 0);
  const totals = billTotals({
    lines: input.lines,
    billDiscountType: input.billDiscountType,
    billDiscountValue: input.billDiscountValue,
  });
  return shape(cost, totals.total);
}

/** "+27.4%" / "-3.1%" / "-" when there is no revenue to measure against. */
export function formatMarginPct(pct: number | null): string {
  if (pct === null) return "-";
  return `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/**
 * Selling price that gives a margin of `marginPct` on the SELLING price - the
 * same way margin is shown everywhere else in the app - rounded UP to the
 * whole rupee so the margin is never below what was asked for.
 *
 *   cost 6,000 at 25% margin -> 8,000   (8,000 - 6,000 = 2,000 = 25% of 8,000)
 *
 * Returns null for a margin of 100% or more, which no price can reach.
 */
export function sellingPriceForMargin(costCents: number, marginPct: number): number | null {
  if (!(marginPct < 100) || costCents <= 0) return null;
  const exact = costCents / (1 - marginPct / 100);
  return Math.ceil(exact / 100) * 100;
}

/** Markup: profit as a percentage of COST. 6,000 -> 8,000 is a 33.3% markup. */
export function markupPct(sellCents: number, costCents: number): number | null {
  if (costCents <= 0) return null;
  return Math.round(((sellCents - costCents) / costCents) * 1000) / 10;
}
