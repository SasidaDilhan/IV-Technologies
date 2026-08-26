"use client";

import { useEffect, useRef } from "react";
import { useFormState, useFormStatus } from "react-dom";

import type { SerialFormState } from "@/app/stock/form-state";
import { emptySerialFormState } from "@/app/stock/form-state";

interface Props {
  action: (state: SerialFormState, form: FormData) => Promise<SerialFormState>;
  itemCode: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
    >
      {pending ? "Adding..." : "Add"}
    </button>
  );
}

/**
 * Serial entry for stock intake.
 *
 * Built for a barcode scanner, which behaves as a keyboard that types the code
 * and presses Enter. That means the input has to clear itself and keep focus
 * after every submit, or the second scan lands in the wrong place.
 */
export default function SerialIntake({ action, itemCode }: Props) {
  const [state, formAction] = useFormState(action, emptySerialFormState);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyed on nonce rather than on `added`, so scanning the same duplicate
  // twice still re-clears and re-focuses the field.
  useEffect(() => {
    if (state.nonce === 0) return;
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  }, [state.nonce]);

  return (
    <div className="space-y-3">
      <form action={formAction} className="flex gap-2">
        <input
          ref={inputRef}
          name="serialNumber"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          placeholder={`Scan or type a serial for ${itemCode}`}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <SubmitButton />
      </form>

      {state.error && (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.added && !state.error && (
        <p className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
          Added <span className="font-mono font-medium">{state.added}</span> to stock.
        </p>
      )}
      <p className="text-xs text-slate-500">
        Press Enter after each serial. The field clears itself so you can scan
        the next unit straight away.
      </p>
    </div>
  );
}
