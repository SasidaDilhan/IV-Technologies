import { billMargin, formatLKR, formatMarginPct, marginPctOf, type MarginLineLike } from "@/lib/money";

interface Props {
  lines: MarginLineLike[];
  billDiscountType: string;
  billDiscountValue: number;
  /**
   * Invoices with returns: credit given back, and the cost of goods that went
   * back on the shelf (a faulty return's cost stays, as a loss).
   */
  returned?: { credit: number; restockedCost: number };
}

/**
 * Buying cost, selling total and margin for a bill.
 *
 * Screen only. The PDF routes never render this component and the document
 * props carry no cost field, so these figures cannot reach a customer copy.
 */
export default function MarginPanel({ lines, billDiscountType, billDiscountValue, returned }: Props) {
  const gross = billMargin({ lines, billDiscountType, billDiscountValue });
  const cost = gross.cost - (returned?.restockedCost ?? 0);
  const revenue = gross.revenue - (returned?.credit ?? 0);
  const m = { cost, revenue, margin: revenue - cost, marginPct: marginPctOf(revenue - cost, cost) };
  const uncosted = lines.filter((l) => l.costPrice === 0).length;

  return (
    <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm dark:border-slate-700">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Internal - not printed
      </p>
      <div className="mt-2 space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-500">Buying cost</span>
          <span className="font-mono">{formatLKR(m.cost)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">
            Selling total{returned && returned.credit > 0 ? " after returns" : ""}
          </span>
          <span className="font-mono">{formatLKR(m.revenue)}</span>
        </div>
        <div
          className={`flex justify-between border-t border-slate-200 pt-1 font-semibold dark:border-slate-800 ${
            m.margin < 0
              ? "text-red-600 dark:text-red-400"
              : "text-emerald-700 dark:text-emerald-400"
          }`}
        >
          <span>Margin</span>
          <span className="font-mono">
            {formatLKR(m.margin)} {formatMarginPct(m.marginPct)}
          </span>
        </div>
      </div>
      {uncosted > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          {uncosted} line{uncosted === 1 ? " has" : "s have"} no buying price and
          count as zero cost.
        </p>
      )}
    </div>
  );
}
