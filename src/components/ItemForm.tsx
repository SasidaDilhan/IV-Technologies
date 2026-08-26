"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import type { ItemFormState } from "@/app/items/form-state";
import { emptyItemFormState } from "@/app/items/form-state";

export interface ItemFormValues {
  itemCode: string;
  name: string;
  barcode: string;
  /** Rupees, as displayed in the input. */
  unitPrice: string;
  tracksSerials: boolean;
}

interface Props {
  action: (state: ItemFormState, form: FormData) => Promise<ItemFormState>;
  defaults?: Partial<ItemFormValues>;
  submitLabel: string;
  /** Locks the tracking toggle when units already exist for this item. */
  lockTracking?: boolean;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-600 dark:text-red-400">{message}</p>;
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
    >
      {pending ? "Saving..." : label}
    </button>
  );
}

const inputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

const labelClass = "block text-sm font-medium text-slate-700 dark:text-slate-300";

export default function ItemForm({
  action,
  defaults,
  submitLabel,
  lockTracking = false,
}: Props) {
  const [state, formAction] = useFormState(action, emptyItemFormState);

  return (
    <form action={formAction} className="max-w-xl space-y-5">
      {state.errors._form && (
        <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {state.errors._form}
        </div>
      )}

      <div>
        <label htmlFor="itemCode" className={labelClass}>
          Item code
        </label>
        <input
          id="itemCode"
          name="itemCode"
          defaultValue={defaults?.itemCode}
          placeholder="DS-2CE10DF0T-PFS"
          className={`${inputClass} mt-1 font-mono`}
          autoComplete="off"
        />
        <FieldError message={state.errors.itemCode} />
      </div>

      <div>
        <label htmlFor="name" className={labelClass}>
          Name
        </label>
        <input
          id="name"
          name="name"
          defaultValue={defaults?.name}
          placeholder="Hikvision 2MP ColorVu Bullet Camera"
          className={`${inputClass} mt-1`}
          autoComplete="off"
        />
        <FieldError message={state.errors.name} />
      </div>

      <div>
        <label htmlFor="barcode" className={labelClass}>
          Barcode <span className="text-slate-400">(optional)</span>
        </label>
        <input
          id="barcode"
          name="barcode"
          defaultValue={defaults?.barcode}
          className={`${inputClass} mt-1 font-mono`}
          autoComplete="off"
        />
        <FieldError message={state.errors.barcode} />
      </div>

      <div>
        <label htmlFor="unitPrice" className={labelClass}>
          Unit price (LKR)
        </label>
        <input
          id="unitPrice"
          name="unitPrice"
          defaultValue={defaults?.unitPrice}
          inputMode="decimal"
          placeholder="12500.00"
          className={`${inputClass} mt-1 text-right font-mono`}
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-slate-500">
          Default price only. Each bill can override it per line.
        </p>
        <FieldError message={state.errors.unitPrice} />
      </div>

      <div className="rounded-md border border-slate-200 p-3 dark:border-slate-800">
        {/* A disabled checkbox is omitted from the submitted FormData, which
            would read as "tracking turned off" and block every save. The
            hidden field carries the real value while the box stays locked. */}
        {lockTracking && <input type="hidden" name="tracksSerials" value="on" />}
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            name={lockTracking ? undefined : "tracksSerials"}
            defaultChecked={defaults?.tracksSerials}
            disabled={lockTracking}
            className="mt-1 h-4 w-4 rounded border-slate-300 disabled:opacity-50"
          />
          <span>
            <span className="block text-sm font-medium text-slate-800 dark:text-slate-200">
              Track serial numbers
            </span>
            <span className="block text-xs text-slate-500">
              Log every physical unit individually. Quantity on a bill then
              comes from the units you pick, not a typed number.
            </span>
            {lockTracking && (
              <span className="mt-1 block text-xs text-amber-600 dark:text-amber-500">
                Locked: serial numbers are already recorded for this item.
              </span>
            )}
          </span>
        </label>
        <FieldError message={state.errors.tracksSerials} />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton label={submitLabel} />
        <Link
          href="/items"
          className="text-sm text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
