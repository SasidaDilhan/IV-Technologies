"use client";

import { useState, useTransition } from "react";

import { removeSerial, restockFaultyUnit } from "@/app/stock/actions";

/** Button for a faulty unit (from a return) that has been repaired. */
export function RestockFaultyButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await restockFaultyUnit(id);
            setError(result.error ?? null);
          })
        }
        className="text-xs text-slate-500 underline hover:text-emerald-700 disabled:opacity-50 dark:hover:text-emerald-400"
        title="Repaired or replaced - it can be sold again"
      >
        {pending ? "Saving..." : "Back in stock"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </>
  );
}

export default function RemoveSerialButton({ id }: { id: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await removeSerial(id);
            setError(result.error ?? null);
          })
        }
        className="text-xs text-slate-500 underline hover:text-red-600 disabled:opacity-50 dark:hover:text-red-400"
      >
        {pending ? "Removing..." : "Remove"}
      </button>
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </>
  );
}
