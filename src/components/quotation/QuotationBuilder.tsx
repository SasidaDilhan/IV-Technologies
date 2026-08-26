"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { reviseQuotation, saveQuotation } from "@/app/quotations/actions";
import type { DraftLinePayload } from "@/app/quotations/types";
import { discountAmount, formatLKR, parseDiscountInput } from "@/lib/money";
import ScanBar, { type AddedLine } from "./ScanBar";
import CustomerPanel, { type SelectedCustomer } from "./CustomerPanel";
import TermsDialog from "./TermsDialog";

export interface DraftLine {
  key: string;
  itemId: number;
  itemCode: string;
  name: string;
  tracksSerials: boolean;
  /** Rupees as typed, so the operator sees exactly what they entered. */
  unitPrice: string;
  quantity: number;
  discountType: "fixed" | "percent";
  discountValue: string;
  note: string;
}

/** An existing quotation loaded back into the till for editing. */
export interface InitialQuotation {
  id: number;
  quoteNo: string;
  customer: SelectedCustomer;
  issueDate: string;
  validUntil: string;
  billDiscountType: "fixed" | "percent";
  billDiscountValue: string;
  terms: string;
  extraTerms: string;
  lines: DraftLine[];
}

interface Props {
  defaultTerms: string;
  today: string;
  validUntil: string;
  /** Present when reopening an existing quotation. */
  initial?: InitialQuotation;
}

const cell =
  "rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-slate-400 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

/** Cents for one line, or null when a field cannot be parsed. */
function lineCents(line: DraftLine): number | null {
  const price = parseDiscountInput("fixed", line.unitPrice);
  if (!price) return null;
  const gross = price.value * line.quantity;
  const disc = parseDiscountInput(line.discountType, line.discountValue);
  if (!disc) return null;
  return gross - discountAmount(gross, disc.type, disc.value);
}

export default function QuotationBuilder({
  defaultTerms,
  today,
  validUntil,
  initial,
}: Props) {
  const router = useRouter();
  const [customer, setCustomer] = useState<SelectedCustomer | null>(
    initial?.customer ?? null,
  );
  const [lines, setLines] = useState<DraftLine[]>(initial?.lines ?? []);
  const [issueDate, setIssueDate] = useState(initial?.issueDate ?? today);
  const [validUntilDate, setValidUntilDate] = useState(
    initial?.validUntil ?? validUntil,
  );
  const [billDiscountType, setBillDiscountType] = useState<"fixed" | "percent">(
    initial?.billDiscountType ?? "fixed",
  );
  const [billDiscountValue, setBillDiscountValue] = useState(
    initial?.billDiscountValue ?? "",
  );
  const [terms, setTerms] = useState(initial?.terms ?? defaultTerms);
  const [extraTerms, setExtraTerms] = useState(initial?.extraTerms ?? "");
  const [termsOpen, setTermsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  function addLine(added: AddedLine) {
    setLines((prev) => {
      // Scanning the same model twice should raise the quantity on one line,
      // the way the printed estimate reads - not open a second line.
      const index = prev.findIndex((l) => l.itemId === added.item.id);
      if (index !== -1) {
        const next = [...prev];
        next[index] = {
          ...next[index],
          quantity: next[index].quantity + added.quantity,
        };
        return next;
      }

      return [
        ...prev,
        {
          key: `${added.item.id}-${Date.now()}-${prev.length}`,
          itemId: added.item.id,
          itemCode: added.item.itemCode,
          name: added.item.name,
          tracksSerials: added.item.tracksSerials,
          unitPrice: (added.item.unitPrice / 100).toFixed(2),
          quantity: added.quantity,
          discountType: "fixed",
          discountValue: "",
          note: "",
        },
      ];
    });
  }

  function patch(key: string, changes: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...changes } : l)));
  }

  const totals = useMemo(() => {
    let subtotal = 0;
    let invalid = false;
    for (const line of lines) {
      const cents = lineCents(line);
      if (cents === null) invalid = true;
      else subtotal += cents;
    }
    const billDisc = parseDiscountInput(billDiscountType, billDiscountValue);
    if (!billDisc) invalid = true;
    const discount = billDisc ? discountAmount(subtotal, billDisc.type, billDisc.value) : 0;
    return { subtotal, discount, total: subtotal - discount, invalid };
  }, [lines, billDiscountType, billDiscountValue]);

  const unitCount = lines.reduce((n, l) => n + l.quantity, 0);

  function buildPayload() {
    const billDisc = parseDiscountInput(billDiscountType, billDiscountValue);
    if (!billDisc) return null;

    const payloadLines: DraftLinePayload[] = [];
    for (const line of lines) {
      const price = parseDiscountInput("fixed", line.unitPrice);
      const disc = parseDiscountInput(line.discountType, line.discountValue);
      if (!price || !disc) return null;
      payloadLines.push({
        itemId: line.itemId,
        unitPrice: price.value,
        quantity: line.quantity,
        discountType: disc.type,
        discountValue: disc.value,
        note: line.note,
      });
    }

    return {
      customerId: customer?.id ?? 0,
      issueDate,
      validUntil: validUntilDate,
      billDiscountType: billDisc.type,
      billDiscountValue: billDisc.value,
      termsText: terms,
      extraTerms,
      lines: payloadLines,
    };
  }

  function save(thenPdf: boolean) {
    setError(null);
    if (!customer) return setError("Select a customer first.");
    if (lines.length === 0) return setError("Add at least one item.");

    const payload = buildPayload();
    if (!payload) {
      return setError("Check the prices and discounts - one is not a valid amount.");
    }

    startSave(async () => {
      const result = initial
        ? await reviseQuotation(initial.id, payload)
        : await saveQuotation(payload);
      if (!result.ok) {
        setError(result.error ?? "Could not save.");
        return;
      }
      if (thenPdf) window.open(`/quotations/${result.quotationId}/pdf`, "_blank");
      router.push(`/quotations/${result.quotationId}`);
    });
  }

  return (
    <div className="flex h-full">
      {/* ---------------- left: entry + lines ---------------- */}
      <section className="flex min-w-0 flex-1 flex-col p-4">
        <ScanBar onAdd={addLine} />

        <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
          <div className="grid shrink-0 grid-cols-[1fr_7rem_5rem_8rem_7rem_2rem] gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            <span>Item</span>
            <span className="text-right">Unit price</span>
            <span className="text-right">Qty</span>
            <span>Discount</span>
            <span className="text-right">Total</span>
            <span />
          </div>

          {/* Only this list scrolls. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
            {lines.length === 0 ? (
              <div className="flex h-full items-center justify-center p-8 text-center text-sm text-slate-500">
                Scan a serial number or barcode to start the bill.
              </div>
            ) : (
              lines.map((line) => {
                const cents = lineCents(line);
                return (
                  <div
                    key={line.key}
                    className="grid grid-cols-[1fr_7rem_5rem_8rem_7rem_2rem] items-start gap-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800/60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{line.name}</p>
                      <p className="truncate font-mono text-xs text-slate-500">
                        {line.itemCode}
                      </p>
                      <input
                        value={line.note}
                        onChange={(e) => patch(line.key, { note: e.target.value })}
                        placeholder="Note"
                        className={`${cell} mt-1 w-full max-w-xs text-xs`}
                      />
                    </div>

                    <input
                      value={line.unitPrice}
                      onChange={(e) => patch(line.key, { unitPrice: e.target.value })}
                      inputMode="decimal"
                      className={`${cell} w-full text-right font-mono`}
                    />

                    <input
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) =>
                        patch(line.key, {
                          quantity: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                      className={`${cell} w-full text-right font-mono`}
                    />

                    <div className="flex gap-1">
                      <input
                        value={line.discountValue}
                        onChange={(e) =>
                          patch(line.key, { discountValue: e.target.value })
                        }
                        placeholder="0"
                        inputMode="decimal"
                        className={`${cell} w-full min-w-0 text-right font-mono`}
                      />
                      <select
                        value={line.discountType}
                        onChange={(e) =>
                          patch(line.key, {
                            discountType: e.target.value as "fixed" | "percent",
                          })
                        }
                        className={`${cell} shrink-0`}
                      >
                        <option value="fixed">Rs</option>
                        <option value="percent">%</option>
                      </select>
                    </div>

                    <span className="pt-1 text-right font-mono text-sm">
                      {cents === null ? (
                        <span className="text-red-600 dark:text-red-400">check</span>
                      ) : (
                        formatLKR(cents)
                      )}
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        setLines((prev) => prev.filter((l) => l.key !== line.key))
                      }
                      title="Remove line"
                      className="pt-1 text-slate-400 hover:text-red-600"
                    >
                      &times;
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="shrink-0 border-t border-slate-200 px-3 py-1.5 text-xs text-slate-500 dark:border-slate-800">
            {lines.length} line{lines.length === 1 ? "" : "s"} &middot; {unitCount} unit
            {unitCount === 1 ? "" : "s"}
          </div>
        </div>
      </section>

      {/* ---------------- right: customer, totals, actions ---------------- */}
      <aside className="flex w-[22rem] shrink-0 flex-col border-l border-slate-200 dark:border-slate-800">
        {/* Pinned, not scrolled: on a short window the middle section can
            shrink to nothing, and the customer must never be the thing that
            disappears - a bill without one cannot be saved. */}
        <div className="shrink-0 border-b border-slate-200 p-4 dark:border-slate-800">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Customer
          </h2>
          <div className="mt-2">
            <CustomerPanel selected={customer} onSelect={setCustomer} />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Dates
          </h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="text-xs text-slate-500">
              Issue
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className={`${cell} mt-1 w-full`}
              />
            </label>
            <label className="text-xs text-slate-500">
              Valid until
              <input
                type="date"
                value={validUntilDate}
                onChange={(e) => setValidUntilDate(e.target.value)}
                className={`${cell} mt-1 w-full`}
              />
            </label>
          </div>

          {/* Job-specific conditions sit in the open, not behind the dialog:
              this is the box that actually gets used on a given bill, while
              the standard template is set once and rarely touched. */}
          <h2 className="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Terms for this bill
          </h2>
          <textarea
            value={extraTerms}
            onChange={(e) => setExtraTerms(e.target.value)}
            rows={3}
            placeholder={"Anything specific to this job, one per line.\ne.g. Scaffolding to be provided by the customer"}
            className={`${cell} mt-2 w-full resize-y leading-relaxed`}
          />
          <p className="mt-1 text-xs text-slate-500">
            Printed above the standard terms. Leave empty if there are none.
          </p>

          <button
            type="button"
            onClick={() => setTermsOpen(true)}
            className="mt-4 flex w-full items-center justify-between rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <span>Standard terms</span>
            <span className="text-xs text-slate-500">
              {terms === defaultTerms ? "template" : "edited"}
            </span>
          </button>
        </div>

        {/* Totals stay pinned: the number being agreed is never scrolled away. */}
        <div className="shrink-0 border-t border-slate-200 p-4 dark:border-slate-800">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-mono">{formatLKR(totals.subtotal)}</span>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 text-sm">
            <span className="text-slate-500">Discount</span>
            <div className="flex gap-1">
              <input
                value={billDiscountValue}
                onChange={(e) => setBillDiscountValue(e.target.value)}
                placeholder="0"
                inputMode="decimal"
                className={`${cell} w-20 text-right font-mono`}
              />
              <select
                value={billDiscountType}
                onChange={(e) =>
                  setBillDiscountType(e.target.value as "fixed" | "percent")
                }
                className={cell}
              >
                <option value="fixed">Rs</option>
                <option value="percent">%</option>
              </select>
            </div>
          </div>

          {totals.discount > 0 && (
            <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
              <span>Discount applied</span>
              <span className="font-mono">- {formatLKR(totals.discount)}</span>
            </div>
          )}

          <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-800">
            <p className="text-xs uppercase tracking-wide text-slate-500">Grand total</p>
            <p className="font-mono text-3xl font-semibold tabular-nums">
              {formatLKR(totals.total)}
            </p>
          </div>

          {error && (
            <p className="mt-3 rounded-md bg-red-100 px-3 py-2 text-sm text-red-900 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => save(false)}
              disabled={saving || totals.invalid}
              className="rounded-md border border-slate-300 px-3 py-2.5 text-sm font-medium hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              {saving ? "Saving..." : initial ? "Save changes" : "Save draft"}
            </button>
            <button
              type="button"
              onClick={() => save(true)}
              disabled={saving || totals.invalid}
              className="rounded-md bg-slate-900 px-3 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            >
              Generate PDF
            </button>
          </div>
        </div>
      </aside>

      <TermsDialog
        open={termsOpen}
        value={terms}
        defaultTerms={defaultTerms}
        onChange={setTerms}
        onClose={() => setTermsOpen(false)}
      />
    </div>
  );
}
