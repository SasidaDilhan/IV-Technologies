"use client";

import { useEffect, useRef, useState } from "react";

import { formatLKR } from "@/lib/money";

export interface ItemHit {
  id: number;
  itemCode: string;
  name: string;
  barcode: string | null;
  unitPrice: number;
  tracksSerials: boolean;
  available: number;
}

export interface SerialOption {
  id: number;
  serialNumber: string;
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
  serials: SerialOption[];
}

interface Props {
  onAdd: (line: AddedLine) => void;
  /** Serial ids already used by lines on this bill. */
  usedSerialIds: number[];
  /**
   * Set when editing an existing quotation, so its own reserved units stay
   * selectable rather than reading as "reserved on another quotation".
   */
  quotationId?: number;
}

const field =
  "w-full rounded-lg border bg-white px-4 text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-slate-400 " +
  "dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 border-slate-300";

/**
 * The till's entry point: one always-focused box that accepts a scanned serial,
 * a scanned barcode, or a typed name / item code. Results overlay the line list
 * rather than pushing it down, so the layout never moves under the operator.
 */
export default function ScanBar({ onAdd, usedSerialIds, quotationId }: Props) {
  const scope = quotationId ? `&forQuotation=${quotationId}` : "";
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ItemHit[]>([]);
  const [serialExact, setSerialExact] = useState<SerialHit | null>(null);
  const [serialHits, setSerialHits] = useState<SerialHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const exactRef = useRef<SerialHit | null>(null);
  exactRef.current = serialExact;

  const [picker, setPicker] = useState<ItemHit | null>(null);
  const [serials, setSerials] = useState<SerialOption[]>([]);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [loadingSerials, setLoadingSerials] = useState(false);

  const [qtyFor, setQtyFor] = useState<ItemHit | null>(null);
  const [qty, setQty] = useState("1");

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      setSerialExact(null);
      setSerialHits([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/items/search?q=${encodeURIComponent(query.trim())}${scope}`,
          {
            signal: controller.signal,
          },
        );
        const data = await res.json();
        setHits(data.items ?? []);
        setSerialExact(data.serial ?? null);
        setSerialHits(data.serialHits ?? []);
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
  }, [query, scope]);

  function reset() {
    setQuery("");
    setHits([]);
    setSerialExact(null);
    setSerialHits([]);
    inputRef.current?.focus();
  }

  function addSerialUnit(hit: SerialHit) {
    if (usedSerialIds.includes(hit.id)) {
      setFlash({ kind: "err", text: `${hit.serialNumber} is already on this bill.` });
      reset();
      return;
    }
    if (!hit.available) {
      setFlash({
        kind: "err",
        text: `${hit.serialNumber} is ${hit.reason ?? "not available"}.`,
      });
      reset();
      return;
    }
    onAdd({
      item: hit.item,
      quantity: 1,
      serials: [{ id: hit.id, serialNumber: hit.serialNumber }],
    });
    setFlash({ kind: "ok", text: `Added ${hit.serialNumber} - ${hit.item.name}` });
    reset();
  }

  async function openPicker(item: ItemHit) {
    setPicker(item);
    setChecked(new Set());
    setLoadingSerials(true);
    try {
      const res = await fetch(
        `/api/items/${item.id}/serials${quotationId ? `?forQuotation=${quotationId}` : ""}`,
      );
      const data = await res.json();
      setSerials(data.serials ?? []);
    } finally {
      setLoadingSerials(false);
    }
  }

  function choose(item: ItemHit) {
    if (item.tracksSerials) void openPicker(item);
    else {
      setQtyFor(item);
      setQty("1");
    }
  }

  function confirmSerials() {
    if (!picker) return;
    const picked = serials.filter((s) => checked.has(s.id));
    if (picked.length === 0) return;
    onAdd({ item: picker, quantity: picked.length, serials: picked });
    setFlash({ kind: "ok", text: `Added ${picked.length} x ${picker.name}` });
    setPicker(null);
    setSerials([]);
    setChecked(new Set());
    reset();
  }

  function confirmQuantity() {
    if (!qtyFor) return;
    const n = Number(qty);
    if (!Number.isInteger(n) || n < 1) return;
    onAdd({ item: qtyFor, quantity: n, serials: [] });
    setFlash({ kind: "ok", text: `Added ${n} x ${qtyFor.name}` });
    setQtyFor(null);
    reset();
  }

  const selectable = serials.filter((s) => !usedSerialIds.includes(s.id));
  const hasResults = serialExact || serialHits.length > 0 || hits.length > 0;
  const showDropdown = !picker && !qtyFor && hasResults;

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
            setPicker(null);
            setQtyFor(null);
            return;
          }
          if (e.key !== "Enter") return;
          e.preventDefault();
          // A scanner types the code then presses Enter.
          const exact = exactRef.current;
          if (exact) addSerialUnit(exact);
        }}
        placeholder="Scan serial or barcode, or type item name / code"
        autoComplete="off"
        spellCheck={false}
        className={`${field} h-14 text-base`}
      />

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
              onClick={() => addSerialUnit(serialExact)}
              disabled={!serialExact.available || usedSerialIds.includes(serialExact.id)}
              className="flex w-full items-center justify-between gap-3 border-b-2 border-slate-900 px-4 py-3 text-left disabled:opacity-50 dark:border-slate-100"
            >
              <span className="min-w-0">
                <span className="block font-mono font-semibold">
                  {serialExact.serialNumber}
                </span>
                <span className="block truncate text-xs text-slate-500">
                  {serialExact.item.name}
                </span>
              </span>
              <span className="whitespace-nowrap text-xs font-medium">
                {usedSerialIds.includes(serialExact.id)
                  ? "already on bill"
                  : serialExact.available
                    ? "Enter to add"
                    : serialExact.reason}
              </span>
            </button>
          )}

          {/* Serial rows and item rows are siblings here, and the two tables
              have overlapping primary keys - a bare id would give React
              duplicate keys and corrupt its view of the DOM. */}
          {serialHits.map((s) => (
            <button
              key={`serial-${s.id}`}
              type="button"
              onClick={() => addSerialUnit(s)}
              disabled={!s.available || usedSerialIds.includes(s.id)}
              className="flex w-full items-center justify-between gap-3 border-b border-slate-200 px-4 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <span className="min-w-0">
                <span className="block font-mono">{s.serialNumber}</span>
                <span className="block truncate text-xs text-slate-500">
                  {s.item.name}
                </span>
              </span>
              <span className="whitespace-nowrap text-xs text-slate-500">
                {usedSerialIds.includes(s.id) ? "on bill" : (s.reason ?? "in stock")}
              </span>
            </button>
          ))}

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
                  {hit.tracksSerials && ` - ${hit.available} available`}
                </span>
              </span>
              <span className="whitespace-nowrap font-mono">
                {formatLKR(hit.unitPrice)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Serial picker */}
      {picker && (
        <div className="absolute inset-x-0 top-16 z-30 rounded-lg border border-slate-300 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{picker.name}</p>
              <p className="font-mono text-xs text-slate-500">{picker.itemCode}</p>
            </div>
            <button
              type="button"
              onClick={() => setPicker(null)}
              className="text-sm text-slate-500 underline"
            >
              Cancel
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Tick the units going on this bill - the count becomes the quantity.
          </p>

          {loadingSerials ? (
            <p className="mt-3 text-sm text-slate-500">Loading...</p>
          ) : selectable.length === 0 ? (
            <p className="mt-3 rounded-md border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
              No units available in stock.
            </p>
          ) : (
            <ul className="mt-3 grid max-h-56 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">
              {selectable.map((s) => {
                const on = checked.has(s.id);
                return (
                  <li key={s.id}>
                    <label
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-sm ${
                        on
                          ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                          : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => {
                          const next = new Set(checked);
                          if (e.target.checked) next.add(s.id);
                          else next.delete(s.id);
                          setChecked(next);
                        }}
                        className="sr-only"
                      />
                      <span className="truncate font-mono text-xs">{s.serialNumber}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          <button
            type="button"
            onClick={confirmSerials}
            disabled={checked.size === 0}
            className="mt-3 w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
          >
            Add {checked.size} unit{checked.size === 1 ? "" : "s"}
          </button>
        </div>
      )}

      {/* Quantity prompt for untracked items */}
      {qtyFor && (
        <div className="absolute inset-x-0 top-16 z-30 rounded-lg border border-slate-300 bg-white p-4 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{qtyFor.name}</p>
              <p className="font-mono text-xs text-slate-500">{qtyFor.itemCode}</p>
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
        </div>
      )}
    </div>
  );
}
