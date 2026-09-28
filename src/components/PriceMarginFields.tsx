"use client";

import { useState } from "react";

import {
  formatLKR,
  marginPctOf,
  parseDiscountInput,
  sellingPriceForMargin,
} from "@/lib/money";

interface Props {
  sell: string;
  setSell: (v: string) => void;
  cost: string;
  setCost: (v: string) => void;
  /** Form field names, so the values submit with the surrounding form. */
  sellName?: string;
  costName?: string;
  sellError?: string;
  costError?: string;
  inputClass: string;
  labelClass: string;
}

const cents = (text: string) => parseDiscountInput("fixed", text)?.value ?? null;

function marginOf(sellText: string, costText: string): string {
  const s = cents(sellText);
  const c = cents(costText);
  if (s === null || !c) return "";
  return String(marginPctOf(s - c, c));
}

/**
 * Buying price, margin %, selling price - edit any of them.
 *
 *   type a selling price -> the margin % is worked out
 *   type a margin %      -> the selling price is set from the buying price
 *   change buying price  -> the margin % is worked out again
 *
 * Margin is profit as a percentage of the buying price, the same as
 * everywhere else in the app: buy 2,000 at 40% -> sell 2,800.
 */
export default function PriceMarginFields({
  sell,
  setSell,
  cost,
  setCost,
  sellName = "unitPrice",
  costName = "costPrice",
  sellError,
  costError,
  inputClass,
  labelClass,
}: Props) {
  const [margin, setMargin] = useState(() => marginOf(sell, cost));
  const [marginError, setMarginError] = useState<string | null>(null);

  function onSell(v: string) {
    setSell(v);
    setMargin(marginOf(v, cost));
    setMarginError(null);
  }
  function onCost(v: string) {
    setCost(v);
    setMargin(marginOf(sell, v));
    setMarginError(null);
  }
  function onMargin(v: string) {
    setMargin(v);
    const pct = Number(v);
    const c = cents(cost);
    if (v.trim() === "") return setMarginError(null);
    if (!Number.isFinite(pct)) return setMarginError("Enter a number, e.g. 25");
    if (!c) return setMarginError("Enter the buying price first.");
    const price = sellingPriceForMargin(c, pct);
    if (price === null) return setMarginError("Enter a margin of -100% or more.");
    setMarginError(null);
    setSell((price / 100).toFixed(2));
  }

  const s = cents(sell);
  const c = cents(cost);
  const profit = s !== null && c ? s - c : null;

  return (
    <div className="space-y-2">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className={labelClass}>
          Buying price (LKR)
          <input
            name={costName}
            value={cost}
            onChange={(e) => onCost(e.target.value)}
            inputMode="decimal"
            placeholder="optional"
            autoComplete="off"
            className={`${inputClass} mt-1 text-right font-mono`}
          />
          <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
            internal, never printed
          </span>
          {costError && <span className="block text-xs text-red-600">{costError}</span>}
        </label>

        <label className={labelClass}>
          Margin %
          <input
            value={margin}
            onChange={(e) => onMargin(e.target.value)}
            inputMode="decimal"
            placeholder="e.g. 25"
            autoComplete="off"
            className={`${inputClass} mt-1 text-right font-mono`}
          />
          <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
            type one to set the selling price
          </span>
          {marginError && <span className="block text-xs text-red-600">{marginError}</span>}
        </label>

        <label className={labelClass}>
          Selling price (LKR)
          <input
            name={sellName}
            value={sell}
            onChange={(e) => onSell(e.target.value)}
            inputMode="decimal"
            placeholder="0.00"
            autoComplete="off"
            className={`${inputClass} mt-1 text-right font-mono`}
          />
          <span className="mt-0.5 block text-[11px] font-normal text-slate-400">
            default; each bill can change it
          </span>
          {sellError && <span className="block text-xs text-red-600">{sellError}</span>}
        </label>
      </div>

      {profit !== null && (
        <p
          className={`rounded-md px-3 py-2 text-sm ${
            profit < 0
              ? "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300"
              : "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300"
          }`}
        >
          Profit per unit:{" "}
          <span className="font-mono font-medium">{formatLKR(profit)}</span>
          {margin && ` · margin ${margin}% on the buying price`}
          {profit < 0 && " - selling below cost"}
        </p>
      )}
    </div>
  );
}
