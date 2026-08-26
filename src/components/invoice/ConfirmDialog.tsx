"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { confirmQuotation } from "@/app/invoices/actions";
import { formatLKR, parseDiscountInput } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/invoices";
import { normaliseSerial } from "@/lib/validation";

/** A quotation line that needs physical units picked before invoicing. */
export interface TrackedLine {
  quoteLineId: number;
  itemId: number;
  itemCode: string;
  name: string;
  quantity: number;
}

interface Props {
  quotationId: number;
  quoteNo: string;
  total: number;
  today: string;
  trackedLines: TrackedLine[];
}

interface SerialOption {
  id: number;
  serialNumber: string;
}

const field =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-slate-400 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

/**
 * Confirm a quotation into an invoice.
 *
 * Two steps, because two different things are being decided: which physical
 * units leave the shop, and how much money came in. The quotation only agreed
 * a model and a quantity, so the serials are chosen here.
 */
export default function ConfirmDialog({
  quotationId,
  quoteNo,
  total,
  today,
  trackedLines,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"serials" | "payment">(
    trackedLines.length > 0 ? "serials" : "payment",
  );

  const [stock, setStock] = useState<Record<number, SerialOption[]>>({});
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Record<number, number[]>>({});

  const [advance, setAdvance] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [dueDays, setDueDays] = useState("30");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const scanRef = useRef<HTMLInputElement>(null);
  const [scan, setScan] = useState("");
  const [scanFlash, setScanFlash] = useState<
    { kind: "ok" | "err"; text: string } | null
  >(null);

  // Load available units for every tracked line when the dialog opens.
  useEffect(() => {
    if (!open || trackedLines.length === 0) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const next: Record<number, SerialOption[]> = {};
      for (const line of trackedLines) {
        try {
          const res = await fetch(`/api/items/${line.itemId}/serials`);
          const data = await res.json();
          next[line.quoteLineId] = data.serials ?? [];
        } catch {
          next[line.quoteLineId] = [];
        }
      }
      if (!cancelled) {
        setStock(next);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, trackedLines]);

  const parsed = parseDiscountInput("fixed", advance);
  const advanceCents = parsed?.value ?? 0;
  const balance = total - advanceCents;

  function toggle(quoteLineId: number, serialId: number, limit: number) {
    setPicked((prev) => {
      const current = prev[quoteLineId] ?? [];
      if (current.includes(serialId)) {
        return { ...prev, [quoteLineId]: current.filter((id) => id !== serialId) };
      }
      if (current.length >= limit) return prev; // never exceed the quantity sold
      return { ...prev, [quoteLineId]: [...current, serialId] };
    });
  }

  /**
   * Pick a unit by scanning the sticker on its box.
   *
   * Faster and far less error-prone than finding the number by eye once there
   * are more than a handful in stock, and it is the same physical action the
   * operator already does at stock intake.
   */
  function handleScan(raw: string) {
    const serial = normaliseSerial(raw);
    if (!serial) return;

    for (const line of trackedLines) {
      const options = stock[line.quoteLineId] ?? [];
      const match = options.find((s) => s.serialNumber === serial);
      if (!match) continue;

      const chosen = picked[line.quoteLineId] ?? [];
      if (chosen.includes(match.id)) {
        setScanFlash({ kind: "err", text: `${serial} is already picked.` });
        return;
      }
      if (chosen.length >= line.quantity) {
        setScanFlash({
          kind: "err",
          text:
            `${line.itemCode} already has all ${line.quantity} picked. ` +
            `Unpick one first.`,
        });
        return;
      }

      toggle(line.quoteLineId, match.id, line.quantity);
      setScanFlash({ kind: "ok", text: `${serial} added to ${line.itemCode}.` });
      return;
    }

    setScanFlash({
      kind: "err",
      text: `${serial} is not in stock for anything on this bill.`,
    });
  }

  // The scanner types into whatever has focus, so step 1 keeps the scan box
  // focused unless the operator has deliberately clicked elsewhere.
  useEffect(() => {
    if (open && step === "serials" && !loading) scanRef.current?.focus();
  }, [open, step, loading]);

  const serialsComplete = trackedLines.every(
    (line) => (picked[line.quoteLineId] ?? []).length === line.quantity,
  );

  function submit() {
    setError(null);
    if (parsed === null) return setError("Advance is not a valid amount.");
    if (advanceCents > total) return setError("Advance is more than the total.");
    if (!serialsComplete) return setError("Pick the serial numbers first.");

    start(async () => {
      const result = await confirmQuotation({
        quotationId,
        serials: trackedLines.map((line) => ({
          quoteLineId: line.quoteLineId,
          serialIds: picked[line.quoteLineId] ?? [],
        })),
        advanceAmount: advanceCents,
        advanceMethod: method,
        advanceReference: reference,
        issueDate,
        dueDays: Number(dueDays) || 0,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not confirm.");
        return;
      }
      setOpen(false);
      router.push(`/invoices/${result.invoiceId}`);
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setStep(trackedLines.length > 0 ? "serials" : "payment");
        }}
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900"
      >
        Convert to invoice
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => !pending && setOpen(false)}
        aria-hidden="true"
      />
      <div className="relative flex max-h-[88vh] w-full max-w-2xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="shrink-0 border-b border-slate-200 p-5 dark:border-slate-800">
          <h2 className="font-semibold">Confirm quotation {quoteNo}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {step === "serials"
              ? "Choose the exact units leaving the shop. These are marked sold."
              : "Record the advance received, if any."}
          </p>
          {trackedLines.length > 0 && (
            <div className="mt-3 flex gap-2 text-xs">
              <span
                className={`rounded-full px-2 py-0.5 ${
                  step === "serials"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                1. Serial numbers
              </span>
              <span
                className={`rounded-full px-2 py-0.5 ${
                  step === "payment"
                    ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                    : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                }`}
              >
                2. Advance
              </span>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {step === "serials" ? (
            loading ? (
              <p className="text-sm text-slate-500">Loading stock...</p>
            ) : (
              <div className="space-y-5">
                <div>
                  <input
                    ref={scanRef}
                    value={scan}
                    onChange={(e) => {
                      setScan(e.target.value);
                      setScanFlash(null);
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
                  {scanFlash && (
                    <p
                      className={`mt-2 rounded-md px-3 py-1.5 text-sm ${
                        scanFlash.kind === "ok"
                          ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-300"
                      }`}
                    >
                      {scanFlash.text}
                    </p>
                  )}
                </div>

                {trackedLines.map((line) => {
                  const options = stock[line.quoteLineId] ?? [];
                  const chosen = picked[line.quoteLineId] ?? [];
                  const short = options.length < line.quantity;
                  return (
                    <div key={line.quoteLineId}>
                      <div className="flex items-baseline justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{line.name}</p>
                          <p className="font-mono text-xs text-slate-500">
                            {line.itemCode}
                          </p>
                        </div>
                        <p
                          className={`text-xs font-medium ${
                            chosen.length === line.quantity
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          {chosen.length} of {line.quantity} picked
                        </p>
                      </div>

                      {short ? (
                        <p className="mt-2 rounded-md bg-red-100 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-300">
                          Only {options.length} in stock, but this line sells{" "}
                          {line.quantity}. Add stock before invoicing.
                        </p>
                      ) : (
                        <ul className="mt-2 grid grid-cols-2 gap-1 sm:grid-cols-3">
                          {options.map((s) => {
                            const on = chosen.includes(s.id);
                            const full = chosen.length >= line.quantity && !on;
                            return (
                              <li key={s.id}>
                                <button
                                  type="button"
                                  disabled={full}
                                  onClick={() =>
                                    toggle(line.quoteLineId, s.id, line.quantity)
                                  }
                                  className={`w-full truncate rounded-md border px-2 py-1.5 text-left font-mono text-xs disabled:opacity-30 ${
                                    on
                                      ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                                      : "border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                                  }`}
                                >
                                  {s.serialNumber}
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
            )
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-900">
                <span className="text-slate-500">Bill total</span>
                <span className="font-mono font-medium">{formatLKR(total)}</span>
              </div>

              <label className="block text-sm">
                <span className="text-slate-500">Advance received (LKR)</span>
                <input
                  value={advance}
                  onChange={(e) => setAdvance(e.target.value)}
                  placeholder="0.00"
                  inputMode="decimal"
                  autoFocus
                  className={`${field} mt-1 text-right font-mono`}
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm">
                  <span className="text-slate-500">Method</span>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className={`${field} mt-1`}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">Reference</span>
                  <input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Cheque no."
                    className={`${field} mt-1`}
                  />
                </label>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block text-sm">
                  <span className="text-slate-500">Invoice date</span>
                  <input
                    type="date"
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className={`${field} mt-1`}
                  />
                </label>
                <label className="block text-sm">
                  <span className="text-slate-500">Due in (days)</span>
                  <input
                    type="number"
                    min={0}
                    value={dueDays}
                    onChange={(e) => setDueDays(e.target.value)}
                    className={`${field} mt-1 text-right font-mono`}
                  />
                </label>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
                <span className="text-slate-500">Balance after advance</span>
                <span className="font-mono text-lg font-semibold">
                  {formatLKR(Math.max(balance, 0))}
                </span>
              </div>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-md bg-red-100 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="flex shrink-0 justify-between gap-2 border-t border-slate-200 p-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Cancel
          </button>

          {step === "serials" ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep("payment");
              }}
              disabled={!serialsComplete}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
            >
              Next: advance
            </button>
          ) : (
            <div className="flex gap-2">
              {trackedLines.length > 0 && (
                <button
                  type="button"
                  onClick={() => setStep("serials")}
                  disabled={pending}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={submit}
                disabled={pending || !serialsComplete}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
              >
                {pending ? "Confirming..." : "Confirm & raise invoice"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
