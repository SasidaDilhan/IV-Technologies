"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { confirmQuotation } from "@/app/invoices/actions";
import { formatLKR, parseDiscountInput } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/invoices";

interface Props {
  quotationId: number;
  quoteNo: string;
  total: number;
  today: string;
}

const field =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-slate-400 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

/**
 * "Convert to invoice": captures the advance and its method, then commits the
 * sale. Shown as a dialog so confirming is a deliberate act - it marks stock
 * as sold and cannot be undone from the UI.
 */
export default function ConfirmDialog({
  quotationId,
  quoteNo,
  total,
  today,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [advance, setAdvance] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [issueDate, setIssueDate] = useState(today);
  const [dueDays, setDueDays] = useState("30");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const parsed = parseDiscountInput("fixed", advance);
  const advanceCents = parsed?.value ?? 0;
  const invalid = parsed === null || advanceCents > total;
  const balance = total - advanceCents;

  function submit() {
    setError(null);
    if (parsed === null) return setError("Advance is not a valid amount.");
    if (advanceCents > total) return setError("Advance is more than the total.");

    start(async () => {
      const result = await confirmQuotation({
        quotationId,
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
        onClick={() => setOpen(true)}
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
      <div className="relative w-full max-w-md rounded-lg border border-slate-200 bg-white p-5 shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <h2 className="font-semibold">Confirm quotation {quoteNo}</h2>
        <p className="mt-1 text-xs text-slate-500">
          This raises the invoice and marks the serial numbers on it as sold.
        </p>

        <div className="mt-4 space-y-3">
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

          {error && (
            <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={pending}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={pending || invalid}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
          >
            {pending ? "Confirming..." : "Confirm & raise invoice"}
          </button>
        </div>
      </div>
    </div>
  );
}
