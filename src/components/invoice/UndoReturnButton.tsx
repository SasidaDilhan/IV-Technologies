"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { undoReturnAction } from "@/app/invoices/actions";

/** Undo the latest return, for one entered by mistake. Asks first. */
export default function UndoReturnButton({
  returnId,
  invoiceId,
  returnNo,
}: {
  returnId: number;
  invoiceId: number;
  returnNo: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Undo return ${returnNo}? The items go back onto the invoice and any refund on it is removed.`)) return;
          setError(null);
          start(async () => {
            const r = await undoReturnAction(returnId, invoiceId);
            if (!r.ok) setError(r.error ?? "Could not undo.");
            else router.refresh();
          });
        }}
        className="text-xs text-slate-500 underline hover:text-red-600 disabled:opacity-50"
      >
        {pending ? "Undoing..." : "Undo"}
      </button>
      {error && <span className="mt-1 max-w-xs text-right text-xs text-red-600">{error}</span>}
    </span>
  );
}
