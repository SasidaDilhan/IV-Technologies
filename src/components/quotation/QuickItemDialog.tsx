"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { quickCreateItem, type QuickItemResult } from "@/app/items/actions";
import PriceMarginFields from "@/components/PriceMarginFields";
import { normaliseSerial } from "@/lib/validation";

type NewItem = NonNullable<QuickItemResult["item"]>;

interface Props {
  /** What the operator had typed or scanned when they chose to create. */
  seed: string;
  onCancel: () => void;
  /** quantity: how many go on the bill being built. */
  onCreated: (item: NewItem, quantity: number) => void;
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
  const [serialText, setSerialText] = useState("");
  const [qty, setQty] = useState("1");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, start] = useTransition();

  const codeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Put the cursor in the first field that still needs filling.
  useEffect(() => {
    if (!initial.itemCode) codeRef.current?.focus();
    else if (!initial.name) nameRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // Focus once, when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // The units being logged, as the server will read them: one per line,
  // normalised, duplicates in the list collapsed.
  const serialLines = serialText
    .split(/[\r\n,]+/)
    .map(normaliseSerial)
    .filter((s) => s.length > 0);
  const serials = Array.from(new Set(serialLines));
  const repeated = serialLines.length - serials.length;
  const quantity = Math.max(1, Math.floor(Number(qty)) || 1);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const form = new FormData();
    form.set("itemCode", itemCode);
    form.set("name", name);
    form.set("barcode", barcode);
    form.set("unitPrice", sell);
    form.set("costPrice", cost);
    form.set("description", description);
    if (tracksSerials) {
      form.set("tracksSerials", "on");
      form.set("serials", serials.join("\n"));
    }

    start(async () => {
      const result = await quickCreateItem(form);
      if (!result.ok || !result.item) {
        setErrors(result.errors);
        return;
      }
      onCreated(result.item, quantity);
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
          <div className="sm:col-span-2">
            <PriceMarginFields
              sell={sell}
              setSell={setSell}
              cost={cost}
              setCost={setCost}
              sellError={errors.unitPrice}
              costError={errors.costPrice}
              inputClass={field}
              labelClass="block text-xs text-slate-500"
            />
          </div>
          <label className="text-xs text-slate-500 sm:col-span-2">
            Description <span className="text-slate-400">(optional, printed under the name)</span>
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="3 Months Warranty" className={`${field} mt-1`} autoComplete="off" />
          </label>
          <label className="flex items-start gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={tracksSerials} onChange={(e) => setTracksSerials(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <span>
              Track serial numbers
              <span className="block text-xs text-slate-500">
                For cameras, DVRs, hard disks. Leave off for cable, connectors and
                labour - those can be billed without any stock.
              </span>
            </span>
          </label>

          {tracksSerials && (
            <label className="text-xs text-slate-500 sm:col-span-2">
              Serial numbers in stock now{" "}
              <span className="text-slate-400">- scan each box, one per line</span>
              <textarea
                value={serialText}
                onChange={(e) => setSerialText(e.target.value)}
                rows={4}
                spellCheck={false}
                placeholder={"SN-0001\nSN-0002"}
                className={`${field} mt-1 resize-y font-mono`}
              />
              <span className="mt-1 block">
                {serials.length === 0
                  ? "None yet. Without stock this item can go on an estimate, but not on an invoice."
                  : `${serials.length} unit${serials.length === 1 ? "" : "s"} will be added to stock.`}
                {repeated > 0 && (
                  <span className="text-amber-600">
                    {" "}
                    {repeated} repeated line{repeated === 1 ? "" : "s"} ignored.
                  </span>
                )}
              </span>
              {err("serials")}
            </label>
          )}

          <label className="text-xs text-slate-500">
            Quantity on this bill
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="numeric"
              className={`${field} mt-1 text-right font-mono`}
            />
          </label>
          {tracksSerials && quantity > serials.length && (
            <p className="self-end text-xs text-amber-600 dark:text-amber-500">
              Only {serials.length} in stock - fine for an estimate, but an invoice
              needs {quantity} units.
            </p>
          )}
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
