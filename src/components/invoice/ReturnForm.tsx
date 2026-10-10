"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { createReturnAction } from "@/app/invoices/actions";
import { formatLKR, parseDiscountInput, returnCredit } from "@/lib/money";
import { PAYMENT_METHODS } from "@/lib/payment-methods";

export interface ReturnableLine {
  id: number;
  name: string;
  itemCode: string;
  /** Sold on the invoice. */
  quantity: number;
  /** Already returned before. */
  returned: number;
  /** This line's share of the invoice total, in cents. */
  share: number;
  unitPrice: number;
  tracksSerials: boolean;
  /** Units still on this line (not yet returned). */
  serials: { id: number; serialNumber: string }[];
}

interface Props {
  invoiceId: number;
  invoiceNo: string;
  lines: ReturnableLine[];
  /** Current balance, cents. Negative: the customer is already owed money. */
  balanceDue: number;
  today: string;
}

interface Choice {
  qty: number;
  restock: boolean;
  serialIds: number[];
}

const field =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-slate-400 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

/**
 * Pick what is coming back. Credit is worked out live with the same function
 * the server uses, so the figure shown is the figure saved.
 */
export default function ReturnForm({ invoiceId, invoiceNo, lines, balanceDue, today }: Props) {
  const router = useRouter();
  const [choices, setChoices] = useState<Record<number, Choice>>(() =>
    Object.fromEntries(lines.map((l) => [l.id, { qty: 0, restock: true, serialIds: [] }])),
  );
  const [returnDate, setReturnDate] = useState(today);
  const [reason, setReason] = useState("");
  const [refundText, setRefundText] = useState<string | null>(null); // null = follow the suggestion
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const set = (id: number, patch: Partial<Choice>) =>
    setChoices((c) => ({ ...c, [id]: { ...c[id], ...patch } }));

  const credit = useMemo(
    () =>
      lines.reduce(
        (sum, l) => sum + returnCredit(l.share, l.quantity, l.returned, choices[l.id]?.qty ?? 0),
        0,
      ),
    [lines, choices],
  );
  const balanceAfter = balanceDue - credit;
  const maxRefund = Math.max(0, -balanceAfter);
  const refundCents =
    refundText === null ? maxRefund : (parseDiscountInput("fixed", refundText)?.value ?? NaN);

  function returnEverything() {
    setChoices(
      Object.fromEntries(
        lines.map((l) => [
          l.id,
          {
            qty: l.quantity - l.returned,
            restock: choices[l.id]?.restock ?? true,
            serialIds: l.serials.map((s) => s.id),
          },
        ]),
      ),
    );
  }

  function toggleSerial(line: ReturnableLine, id: number) {
    const current = choices[line.id].serialIds;
    const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    set(line.id, { serialIds: next, qty: next.length });
  }

  function submit() {
    setError(null);
    if (credit <= 0) return setError("Choose at least one item to return.");
    if (!Number.isFinite(refundCents) || refundCents < 0) return setError("Enter a valid refund amount.");
    if (refundCents > maxRefund) return setError(`The refund can be at most ${formatLKR(maxRefund)}.`);

    start(async () => {
      const result = await createReturnAction({
        invoiceId,
        returnDate,
        reason,
        refundAmount: refundCents,
        refundMethod: method,
        refundReference: reference,
        lines: lines
          .filter((l) => (choices[l.id]?.qty ?? 0) > 0)
          .map((l) => ({
            invoiceLineId: l.id,
            quantity: choices[l.id].qty,
            restock: choices[l.id].restock,
            serialIds: choices[l.id].serialIds,
          })),
      });
      if (!result.ok) return setError(result.error ?? "Could not save the return.");
      router.push(`/invoices/${invoiceId}?returned=${result.returnId}`);
      router.refresh();
    });
  }

  const anythingLeft = lines.some((l) => l.quantity - l.returned > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Tick or count what the customer brought back. The invoice itself is not changed.
        </p>
        {anythingLeft && (
          <button
            type="button"
            onClick={returnEverything}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Return the whole invoice
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left dark:bg-slate-900">
            <tr>
              <th className="px-4 py-2 font-medium">Item</th>
              <th className="px-4 py-2 text-right font-medium">Sold</th>
              <th className="px-4 py-2 text-right font-medium">Returning</th>
              <th className="px-4 py-2 font-medium">Goes back</th>
              <th className="px-4 py-2 text-right font-medium">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 align-top dark:divide-slate-800">
            {lines.map((l) => {
              const left = l.quantity - l.returned;
              const c = choices[l.id];
              const lineCredit = returnCredit(l.share, l.quantity, l.returned, c.qty);
              return (
                <tr key={l.id} className={left === 0 ? "opacity-50" : ""}>
                  <td className="px-4 py-3">
                    <span className="block">{l.name}</span>
                    <span className="block font-mono text-xs text-slate-500">{l.itemCode}</span>
                    {l.returned > 0 && (
                      <span className="block text-xs text-amber-700 dark:text-amber-500">
                        {l.returned} already returned
                      </span>
                    )}
                    {l.tracksSerials && left > 0 && (
                      <p className="mt-2 text-xs text-slate-500">Tap each unit coming back:</p>
                    )}
                    {l.tracksSerials && left > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {l.serials.map((s) => {
                          const on = c.serialIds.includes(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => toggleSerial(l, s.id)}
                              className={`rounded border px-2 py-0.5 font-mono text-xs ${
                                on
                                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                                  : "border-slate-300 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                              }`}
                            >
                              {on ? "✓ " : ""}
                              {s.serialNumber}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{l.quantity}</td>
                  <td className="px-4 py-3 text-right">
                    {left === 0 ? (
                      <span className="text-xs text-slate-500">all returned</span>
                    ) : l.tracksSerials ? (
                      <span className="font-mono">{c.qty}</span>
                    ) : (
                      <input
                        value={c.qty === 0 ? "" : String(c.qty)}
                        onChange={(e) => {
                          const n = Math.floor(Number(e.target.value));
                          set(l.id, { qty: Number.isFinite(n) ? Math.min(Math.max(n, 0), left) : 0 });
                        }}
                        inputMode="numeric"
                        placeholder="0"
                        aria-label={`Quantity of ${l.name} returned, up to ${left}`}
                        className={`${field} w-20 text-right font-mono`}
                      />
                    )}
                    {left > 0 && <span className="mt-1 block text-xs text-slate-500">of {left}</span>}
                  </td>
                  <td className="px-4 py-3">
                    {left > 0 && (
                      <select
                        value={c.restock ? "stock" : "faulty"}
                        onChange={(e) => set(l.id, { restock: e.target.value === "stock" })}
                        className={`${field} py-1.5`}
                        aria-label={`Where ${l.name} goes`}
                      >
                        <option value="stock">Back in stock</option>
                        <option value="faulty">Faulty - keep out of stock</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {c.qty > 0 ? formatLKR(lineCredit) : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block text-xs text-slate-500">
            Return date
            <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className={`${field} mt-1 block`} />
          </label>
          <label className="block text-xs text-slate-500">
            Reason <span className="text-slate-400">(printed on the return note)</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Wrong model, customer changed mind, faulty on arrival"
              className={`${field} mt-1 w-full`}
            />
          </label>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-800">
          <div className="flex justify-between">
            <span className="text-slate-500">Credit for returned goods</span>
            <span className="font-mono font-medium">{formatLKR(credit)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Balance before</span>
            <span className="font-mono">{formatLKR(balanceDue)}</span>
          </div>
          <div className="flex justify-between border-t border-slate-200 pt-2 dark:border-slate-800">
            <span className="text-slate-500">{balanceAfter < 0 ? "Customer is owed" : "Balance after"}</span>
            <span className="font-mono">{formatLKR(Math.abs(balanceAfter))}</span>
          </div>

          {maxRefund > 0 ? (
            <div className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
              <p className="text-xs text-slate-500">
                The customer has paid for these goods. Enter what you hand back now -
                0 if they will take credit instead.
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  value={refundText ?? (maxRefund / 100).toFixed(2)}
                  onChange={(e) => setRefundText(e.target.value)}
                  inputMode="decimal"
                  aria-label="Refund amount"
                  className={`${field} w-36 text-right font-mono`}
                />
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={field} aria-label="Refund method">
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Reference (optional)"
                  className={`${field} min-w-0 flex-1`}
                />
              </div>
            </div>
          ) : (
            credit > 0 && (
              <p className="border-t border-slate-200 pt-3 text-xs text-slate-500 dark:border-slate-800">
                Nothing to refund - the credit lowers what the customer still owes.
              </p>
            )
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <button
            type="button"
            onClick={submit}
            disabled={pending || credit <= 0}
            className="w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {pending ? "Saving..." : `Save return on ${invoiceNo}`}
          </button>
        </div>
      </div>
    </div>
  );
}
