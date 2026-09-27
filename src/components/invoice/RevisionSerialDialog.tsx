"use client";

import { useEffect, useRef, useState } from "react";

import { normaliseSerial } from "@/lib/validation";

export interface TrackedDraftLine {
  key: string;
  itemId: number;
  itemCode: string;
  name: string;
  quantity: number;
}

export interface UnitOption {
  id: number;
  serialNumber: string;
  itemId: number;
}

interface Props {
  lines: TrackedDraftLine[];
  /** Units on the revision being replaced. They are offered and pre-ticked. */
  previousUnits: UnitOption[];
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (picked: Record<string, number[]>) => void;
}

const field =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-slate-400 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

/**
 * Choose the serial numbers for a revised invoice.
 *
 * The units already on the invoice are ticked to start with, so an edit that
 * only changes a price is one click. Anything else in stock is offered too,
 * for when the quantity went up or a unit is being swapped.
 */
export default function RevisionSerialDialog({
  lines,
  previousUnits,
  pending,
  error,
  onCancel,
  onConfirm,
}: Props) {
  const [options, setOptions] = useState<Record<string, UnitOption[]>>({});
  const [picked, setPicked] = useState<Record<string, number[]>>({});
  const [loading, setLoading] = useState(true);
  const [scan, setScan] = useState("");
  const [flash, setFlash] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const inStock: Record<number, UnitOption[]> = {};
      for (const itemId of Array.from(new Set(lines.map((l) => l.itemId)))) {
        try {
          const res = await fetch(`/api/items/${itemId}/serials`);
          const data = await res.json();
          inStock[itemId] = (data.serials ?? []).map(
            (s: { id: number; serialNumber: string }) => ({ ...s, itemId }),
          );
        } catch {
          inStock[itemId] = [];
        }
      }

      const nextOptions: Record<string, UnitOption[]> = {};
      const nextPicked: Record<string, number[]> = {};
      // Hand out the previous units per item, in line order, up to each
      // line's quantity.
      const pool = new Map<number, UnitOption[]>();
      for (const u of previousUnits) {
        pool.set(u.itemId, [...(pool.get(u.itemId) ?? []), u]);
      }

      for (const line of lines) {
        const prev = previousUnits.filter((u) => u.itemId === line.itemId);
        const merged = [...prev, ...(inStock[line.itemId] ?? [])];
        const seen = new Set<number>();
        nextOptions[line.key] = merged
          .filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true)))
          .sort((a, b) => a.serialNumber.localeCompare(b.serialNumber));

        const available = pool.get(line.itemId) ?? [];
        const take = available.slice(0, line.quantity);
        pool.set(line.itemId, available.slice(take.length));
        nextPicked[line.key] = take.map((u) => u.id);
      }

      if (!cancelled) {
        setOptions(nextOptions);
        setPicked(nextPicked);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lines, previousUnits]);

  useEffect(() => {
    if (!loading) scanRef.current?.focus();
  }, [loading]);

  const pickedAnywhere = new Set(Object.values(picked).flat());

  function toggle(line: TrackedDraftLine, unitId: number) {
    setPicked((prev) => {
      const current = prev[line.key] ?? [];
      if (current.includes(unitId)) {
        return { ...prev, [line.key]: current.filter((id) => id !== unitId) };
      }
      if (current.length >= line.quantity) return prev;
      return { ...prev, [line.key]: [...current, unitId] };
    });
  }

  function handleScan(raw: string) {
    const serial = normaliseSerial(raw);
    if (!serial) return;
    for (const line of lines) {
      const unit = (options[line.key] ?? []).find((u) => u.serialNumber === serial);
      if (!unit) continue;
      if (pickedAnywhere.has(unit.id)) {
        setFlash({ kind: "err", text: `${serial} is already picked.` });
        return;
      }
      if ((picked[line.key] ?? []).length >= line.quantity) continue;
      toggle(line, unit.id);
      setFlash({ kind: "ok", text: `${serial} added to ${line.itemCode}.` });
      return;
    }
    setFlash({
      kind: "err",
      text: `${serial} is not available for anything on this invoice, or that line is full.`,
    });
  }

  const complete = lines.every((l) => (picked[l.key] ?? []).length === l.quantity);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" onClick={() => !pending && onCancel()} />
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="shrink-0 border-b border-slate-200 p-5 dark:border-slate-800">
          <h2 className="font-semibold">Serial numbers for the revised invoice</h2>
          <p className="mt-1 text-xs text-slate-500">
            The units already on this invoice are ticked. Untick one to put it
            back in stock; tick or scan another to swap it in.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className="text-sm text-slate-500">Loading units...</p>
          ) : (
            <div className="space-y-5">
              <div>
                <input
                  ref={scanRef}
                  value={scan}
                  onChange={(e) => {
                    setScan(e.target.value);
                    setFlash(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    handleScan(scan);
                    setScan("");
                  }}
                  placeholder="Scan a serial number, or tap the units below"
                  autoComplete="off"
                  spellCheck={false}
                  className={`${field} h-12 font-mono`}
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
              </div>

              {lines.map((line) => {
                const chosen = picked[line.key] ?? [];
                const done = chosen.length === line.quantity;
                return (
                  <div key={line.key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{line.name}</p>
                        <p className="font-mono text-xs text-slate-500">{line.itemCode}</p>
                      </div>
                      <span
                        className={`whitespace-nowrap text-sm ${
                          done ? "text-emerald-700 dark:text-emerald-400" : "text-amber-600"
                        }`}
                      >
                        {chosen.length} of {line.quantity} picked
                      </span>
                    </div>
                    {(options[line.key] ?? []).length === 0 ? (
                      <p className="mt-2 rounded-md border border-dashed border-slate-300 p-3 text-center text-sm text-slate-500 dark:border-slate-700">
                        No units of this item are available.
                      </p>
                    ) : (
                      <ul className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
                        {(options[line.key] ?? []).map((u) => {
                          const on = chosen.includes(u.id);
                          const elsewhere = !on && pickedAnywhere.has(u.id);
                          return (
                            <li key={`${line.key}-${u.id}`}>
                              <button
                                type="button"
                                disabled={elsewhere || (!on && done)}
                                onClick={() => toggle(line, u.id)}
                                className={`w-full truncate rounded-md border px-2 py-1.5 text-left font-mono text-xs disabled:opacity-30 ${
                                  on
                                    ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                                    : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                                }`}
                              >
                                {u.serialNumber}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {error && (
            <p className="mt-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => onConfirm(picked)}
            disabled={pending || loading || !complete}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
          >
            {pending ? "Saving..." : "Save revision"}
          </button>
        </div>
      </div>
    </div>
  );
}
