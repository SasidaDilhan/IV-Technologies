"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { quickCreateItem, type QuickItemResult } from "@/app/items/actions";
import { formatLKR, formatMarginPct, parseDiscountInput } from "@/lib/money";

type NewItem = NonNullable<QuickItemResult["item"]>;

interface Props {
  /** What the operator had typed or scanned when they chose to create. */
  seed: string;
  onCancel: () => void;
  onCreated: (item: NewItem) => void;
}

const field =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-slate-400 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

/**
 * Guess which field the search text belongs in:
 *   a long run of digits  -> a scanned barcode
 *   one word with a digit or dash, e.g. DS-2CE10 -> an item code
 *   anything else          -> the item's name
 */
function splitSeed(seed: string) {
  const s = seed.trim();
  if (/^\d{8,}$/.test(s)) return { barcode: s, itemCode: "", name: "" };
  if (/^\S+$/.test(s) && /[\d-]/.test(s)) return { barcode: "", itemCode: s.toUpperCase(), name: "" };
  return { barcode: "", itemCode: "", name: s };
}

/**
 * Create a catalogue item without leaving the bill.
 *
 * A dialog rather than a trip to the Items page: navigating away would throw
 * away a half-built bill, which is the whole reason this exists.
 */
export default function QuickItemDialog({ seed, onCancel, onCreated }: Props) {
  const initial = splitSeed(seed);
  const [itemCode, setItemCode] = useState(initial.itemCode);
  const [name, setName] = useState(initial.name);
  const [barcode, setBarcode] = useState(initial.barcode);
  const [sell, setSell] = useState("");
  const [cost, setCost] = useState("");
  const [description, setDescription] = useState("");
  const [tracksSerials, setTracksSerials] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const codeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  // Put the cursor in the first field that still needs filling.
  useEffect(() => {
    if (!initial.itemCode) codeRef.current?.focus();
    else if (!initial.name) nameRef.current?.focus();
    else priceRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // Focus once, when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sellCents = parseDiscountInput("fixed", sell)?.value ?? null;
  const costCents = parseDiscountInput("fixed", cost)?.value ?? null;
  const margin =
    sellCents && costCents
      ? {
          value: sellCents - costCents,
          pct: Math.round(((sellCents - costCents) / sellCents) * 1000) / 10,
        }
      : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const form = new FormData();
    form.set("itemCode", itemCode);
    form.set("name", name);
    form.set("barcode", barcode);
    form.set("unitPrice", sell);
    form.set("costPrice", cost);
    form.set("description", description);
    if (tracksSerials) form.set("tracksSerials", "on");

    start(async () => {
      const result = await quickCreateItem(form);
      if (!result.ok || !result.item) {
        setErrors(result.errors);
        return;
      }
      onCreated(result.item);
    });
  }

  const err = (k: string) =>
    errors[k] ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors[k]}</p> : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={() => !pending && onCancel()} />
      <form
        onSubmit={submit}
        className="relative w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      >
        <h2 className="font-semibold">New item</h2>
        <p className="mt-1 text-xs text-slate-500">
          Saved to the catalogue and added to this bill. Your bill is kept as it is.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-500">
            Item code
            <input ref={codeRef} value={itemCode} onChange={(e) => setItemCode(e.target.value)} className={`${field} mt-1 font-mono`} autoComplete="off" />
            {err("itemCode")}
          </label>
          <label className="text-xs text-slate-500">
            Barcode <span className="text-slate-400">(optional)</span>
            <input value={barcode} onChange={(e) => setBarcode(e.target.value)} className={`${field} mt-1 font-mono`} autoComplete="off" />
            {err("barcode")}
          </label>
          <label className="text-xs text-slate-500 sm:col-span-2">
            Name
            <input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} className={`${field} mt-1`} autoComplete="off" />
            {err("name")}
          </label>
          <label className="text-xs text-slate-500">
            Selling price (LKR)
            <input ref={priceRef} value={sell} onChange={(e) => setSell(e.target.value)} inputMode="decimal" placeholder="0.00" className={`${field} mt-1 text-right font-mono`} autoComplete="off" />
            {err("unitPrice")}
          </label>
          <label className="text-xs text-slate-500">
            Buying price (LKR) <span className="text-slate-400">- not printed</span>
            <input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" placeholder="optional" className={`${field} mt-1 text-right font-mono`} autoComplete="off" />
            {err("costPrice")}
          </label>
          {margin && (
            <p className={`text-xs sm:col-span-2 ${margin.value < 0 ? "text-red-600 dark:text-red-400" : "text-slate-500"}`}>
              Margin per unit: {formatLKR(margin.value)} ({formatMarginPct(margin.pct)})
              {margin.value < 0 && " - selling below cost"}
            </p>
          )}
          <label className="text-xs text-slate-500 sm:col-span-2">
            Description <span className="text-slate-400">(optional, printed under the name)</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="3 Months Warranty" className={`${field} mt-1`} autoComplete="off" />
          </label>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={tracksSerials} onChange={(e) => setTracksSerials(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>
              Track serial numbers
              <span className="block text-xs text-slate-500">
                For cameras, DVRs, hard disks. Units must be logged at Stock intake
                before this item can go on an invoice.
              </span>
            </span>
          </label>
        </div>

        {errors._form && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{errors._form}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={pending} className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">
            Cancel
          </button>
          <button type="submit" disabled={pending} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900">
            {pending ? "Saving..." : "Create & add to bill"}
          </button>
        </div>
      </form>
    </div>
  );
}
