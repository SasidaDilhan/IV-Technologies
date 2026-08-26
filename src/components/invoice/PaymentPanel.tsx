"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { logPayment, removePayment } from "@/app/invoices/actions";
import { formatLKR, parseDiscountInput } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/invoices";

export interface PaymentRow {
  id: number;
  amount: number;
  method: string;
  paidAt: string;
  reference: string | null;
  note: string | null;
}

interface Props {
  invoiceId: number;
  payments: PaymentRow[];
  balanceDue: number;
  today: string;
}

const field =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-slate-400 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

const methodLabel = (value: string) =>
  PAYMENT_METHODS.find((m) => m.value === value)?.label ?? value;

export default function PaymentPanel({
  invoiceId,
  payments,
  balanceDue,
  today,
}: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [paidAt, setPaidAt] = useState(today);
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    setError(null);
    const parsed = parseDiscountInput("fixed", amount);
    if (parsed === null || parsed.value <= 0) {
      return setError("Enter a valid amount.");
    }

    start(async () => {
      const result = await logPayment({
        invoiceId,
        amount: parsed.value,
        method,
        paidAt,
        reference,
      });
      if (!result.ok) {
        setError(result.error ?? "Could not log the payment.");
        return;
      }
      setAmount("");
      setReference("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Payments received
        </h2>
        {payments.length === 0 ? (
          <p className="mt-2 rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500 dark:border-slate-700">
            Nothing received yet.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-slate-200 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {payments.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
              >
                <span className="min-w-0">
                  <span className="block font-mono font-medium">
                    {formatLKR(p.amount)}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {p.paidAt} &middot; {methodLabel(p.method)}
                    {p.reference && ` · ${p.reference}`}
                    {p.note && ` · ${p.note}`}
                  </span>
                </span>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const result = await removePayment(p.id, invoiceId);
                      if (!result.ok) setError(result.error ?? "Could not remove.");
                      else router.refresh();
                    })
                  }
                  className="shrink-0 text-xs text-slate-500 underline hover:text-red-600 disabled:opacity-50"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {balanceDue > 0 ? (
        <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
          <h3 className="text-sm font-medium">Log a payment</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr]">
            <label className="text-xs text-slate-500">
              Amount (LKR)
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={String((balanceDue / 100).toFixed(2))}
                inputMode="decimal"
                className={`${field} mt-1 w-full text-right font-mono`}
              />
            </label>
            <label className="text-xs text-slate-500">
              Method
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className={`${field} mt-1 w-full`}
              >
                {PAYMENT_METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-slate-500">
              Date
              <input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                className={`${field} mt-1 w-full`}
              />
            </label>
            <label className="text-xs text-slate-500">
              Reference
              <input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Cheque / transfer no."
                className={`${field} mt-1 w-full`}
              />
            </label>
          </div>

          {error && (
            <p className="mt-2 rounded-md bg-red-100 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={pending}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
            >
              {pending ? "Saving..." : "Add payment"}
            </button>
            <button
              type="button"
              onClick={() => setAmount((balanceDue / 100).toFixed(2))}
              className="text-xs text-slate-500 underline"
            >
              Settle in full
            </button>
          </div>
        </div>
      ) : (
        <p className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          This invoice is settled in full.
        </p>
      )}

      {error && balanceDue <= 0 && (
        <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
