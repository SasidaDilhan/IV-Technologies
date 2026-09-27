import { billMargin, formatLKR, formatMarginPct, type MarginLineLike } from "@/lib/money";

interface Props {
  lines: MarginLineLike[];
  billDiscountType: string;
  billDiscountValue: number;
}

/**
 * Buying cost, selling total and margin for a bill.
 *
 * Screen only. The PDF routes never render this component and the document
 * props carry no cost field, so these figures cannot reach a customer copy.
 */
export default function MarginPanel({ lines, billDiscountType, billDiscountValue }: Props) {
  const m = billMargin({ lines, billDiscountType, billDiscountValue });
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
          <span className="text-slate-500">Selling total</span>
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
