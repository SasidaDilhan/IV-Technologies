"use client";

import { useEffect, useRef, useState } from "react";

import { formatLKR } from "@/lib/money";
import QuickItemDialog from "./QuickItemDialog";

export interface ItemHit {
  id: number;
  itemCode: string;
  name: string;
  description: string | null;
  barcode: string | null;
  unitPrice: number;
  costPrice: number;
  tracksSerials: boolean;
  available: number;
}

export interface SerialHit {
  id: number;
  serialNumber: string;
  available: boolean;
  reason: string | null;
  item: ItemHit;
}

export interface AddedLine {
  item: ItemHit;
  quantity: number;
}

interface Props {
  onAdd: (line: AddedLine) => void;
}

const field =
  "w-full rounded-lg border bg-white px-4 text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-slate-400 " +
  "dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 border-slate-300";

/**
 * The till's entry point: one always-focused box that accepts a typed name or
 * item code, a scanned shelf barcode, or a scanned serial number.
 *
 * A quotation prices a model, not a specific unit, so scanning a serial here
 * resolves to its ITEM and adds one of that model - it does not reserve the
 * unit. Which physical units go out is decided at invoice time.
 */
export default function ScanBar({ onAdd }: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ItemHit[]>([]);
  const [serialExact, setSerialExact] = useState<SerialHit | null>(null);
  const [searching, setSearching] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const exactRef = useRef<SerialHit | null>(null);
  exactRef.current = serialExact;

  const [qtyFor, setQtyFor] = useState<ItemHit | null>(null);
  const [qty, setQty] = useState("1");

  // Which query the current results belong to, so "nothing found" is only
  // claimed once the search for THIS text has actually come back.
  const [searchedFor, setSearchedFor] = useState("");
  // Text to pre-fill the new-item dialog with; null when it is closed.
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      setSerialExact(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/items/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        setHits(data.items ?? []);
        setSerialExact(data.serial ?? null);
        setSearchedFor(query.trim());
      } catch {
        // Superseded keystroke or offline.
      } finally {
        setSearching(false);
      }
    }, 200);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  function reset() {
    setQuery("");
    setHits([]);
    setSerialExact(null);
    inputRef.current?.focus();
  }

  /** Add one of a model straight away - used when a serial is scanned. */
  function addOne(item: ItemHit, via?: string) {
    onAdd({ item, quantity: 1 });
    setFlash({
      kind: "ok",
      text: via ? `Added ${item.name} (scanned ${via})` : `Added ${item.name}`,
    });
    reset();
  }

  function choose(item: ItemHit) {
    setQtyFor(item);
    setQty("1");
  }

  function confirmQuantity() {
    if (!qtyFor) return;
    const n = Number(qty);
    if (!Number.isInteger(n) || n < 1) return;
    onAdd({ item: qtyFor, quantity: n });
    setFlash({ kind: "ok", text: `Added ${n} x ${qtyFor.name}` });
    setQtyFor(null);
    reset();
  }

  const showDropdown = !qtyFor && (serialExact !== null || hits.length > 0);
  const nothingFound =
    !qtyFor &&
    !searching &&
    query.trim().length >= 2 &&
    searchedFor === query.trim() &&
    serialExact === null &&
    hits.length === 0;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={query}
        autoFocus
        onChange={(e) => {
          setQuery(e.target.value);
          setFlash(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            reset();
            setQtyFor(null);
            return;
          }
          if (e.key !== "Enter") return;
          e.preventDefault();
          // A scanner types the code then presses Enter. A serial identifies
          // the model; the unit itself is chosen at invoice time.
          const exact = exactRef.current;
          if (exact) addOne(exact.item, exact.serialNumber);
          else if (hits.length === 1) choose(hits[0]);
          // A scan that matches nothing opens "new item" with it filled in.
          else if (nothingFound) setCreating(query.trim());
        }}
        placeholder="Scan barcode or serial, or type item name / code"
        autoComplete="off"
        spellCheck={false}
        className={`${field} h-14 pr-32 text-base`}
      />
      <button
        type="button"
        onClick={() => setCreating(query.trim())}
        title="Create a new catalogue item without leaving this bill"
        className="absolute right-2 top-2 h-10 rounded-md border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      >
        + New item
      </button>

      {nothingFound && (
        <div className="absolute inset-x-0 top-16 z-30 rounded-lg border border-slate-300 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <p className="text-sm">
            No item matches <span className="font-mono font-medium">{query.trim()}</span>.
          </p>
          <button
            type="button"
            onClick={() => setCreating(query.trim())}
            className="mt-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
          >
            Create it and add to this bill
          </button>
          <span className="ml-2 text-xs text-slate-500">or press Enter</span>
        </div>
      )}

      {creating !== null && (
        <QuickItemDialog
          seed={creating}
          onCancel={() => {
            setCreating(null);
            inputRef.current?.focus();
          }}
          onCreated={(item) => {
            setCreating(null);
            onAdd({ item, quantity: 1 });
            setFlash({
              kind: "ok",
              text:
                `Created ${item.itemCode} and added it to this bill.` +
                (item.tracksSerials
                  ? " Log its serial numbers at Stock intake before invoicing."
                  : ""),
            });
            reset();
          }}
        />
      )}

      {flash && (
        <p
          className={`mt-2 rounded-md px-3 py-1.5 text-sm ${
            flash.kind === "ok"
              ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
              : "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {flash.text}
        </p>
      )}
      {searching && !flash && (
        <p className="mt-2 px-1 text-xs text-slate-500">Searching...</p>
      )}

      {/* Results overlay the content below instead of shifting it. */}
      {showDropdown && (
        <div className="absolute inset-x-0 top-16 z-30 max-h-[22rem] overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {serialExact && (
            <button
              type="button"
              onClick={() => addOne(serialExact.item, serialExact.serialNumber)}
              className="flex w-full items-center justify-between gap-3 border-b-2 border-slate-900 px-4 py-3 text-left dark:border-slate-100"
            >
              <span className="min-w-0">
                <span className="block font-mono font-semibold">
                  {serialExact.serialNumber}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {serialExact.item.name} - adds one of this model
                </span>
              </span>
              <span className="whitespace-nowrap text-xs font-medium">
                Enter to add
              </span>
            </button>
          )}

          {hits.map((hit) => (
            <button
              key={`item-${hit.id}`}
              type="button"
              onClick={() => choose(hit)}
              className="flex w-full items-center justify-between gap-3 border-b border-slate-200 px-4 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <span className="min-w-0">
                <span className="block truncate font-medium">{hit.name}</span>
                <span className="block font-mono text-xs text-slate-500">
                  {hit.itemCode}
                  {hit.tracksSerials && ` - ${hit.available} in stock`}
                </span>
              </span>
              <span className="whitespace-nowrap font-mono">
                {formatLKR(hit.unitPrice)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Quantity prompt - the same for every item now. */}
      {qtyFor && (
        <div className="absolute inset-x-0 top-16 z-30 rounded-lg border border-slate-300 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{qtyFor.name}</p>
              <p className="font-mono text-xs text-slate-500">
                {qtyFor.itemCode}
                {qtyFor.tracksSerials && ` - ${qtyFor.available} in stock`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setQtyFor(null)}
              className="text-sm text-slate-500 underline"
            >
              Cancel
            </button>
          </div>
          <div className="mt-3 flex items-end gap-2">
            <label className="text-sm">
              <span className="block text-xs text-slate-500">Quantity</span>
              <input
                type="number"
                min={1}
                value={qty}
                autoFocus
                onChange={(e) => setQty(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    confirmQuantity();
                  }
                }}
                className={`${field} mt-1 h-10 w-28 text-right font-mono`}
              />
            </label>
            <button
              type="button"
              onClick={confirmQuantity}
              className="h-10 rounded-md bg-slate-900 px-4 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-900"
            >
              Add
            </button>
          </div>
          {qtyFor.tracksSerials && (
            <p className="mt-2 text-xs text-slate-500">
              Serial numbers for this model are chosen when the quotation is
              confirmed into an invoice.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
