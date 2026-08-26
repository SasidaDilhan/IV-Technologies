"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";

import type { CustomerFormState } from "@/app/customers/form-state";
import { emptyCustomerFormState } from "@/app/customers/form-state";

interface Props {
  action: (state: CustomerFormState, form: FormData) => Promise<CustomerFormState>;
  defaults: { name: string; phone: string; address: string };
  cancelHref: string;
}

const field =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-slate-400 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
    >
      {pending ? "Saving..." : "Save changes"}
    </button>
  );
}

export default function CustomerForm({ action, defaults, cancelHref }: Props) {
  const [state, formAction] = useFormState(action, emptyCustomerFormState);

  return (
    <form action={formAction} className="max-w-lg space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium">
          Name
        </label>
        <input id="name" name="name" defaultValue={defaults.name} className={`${field} mt-1`} />
        {state.errors.name && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {state.errors.name}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="phone" className="block text-sm font-medium">
          Phone
        </label>
        <input
          id="phone"
          name="phone"
          defaultValue={defaults.phone}
          className={`${field} mt-1 font-mono`}
        />
        <p className="mt-1 text-xs text-slate-500">
          Any format works - +94 77 945 7745 and 077 945 7745 are stored the
          same way, so the same customer is never created twice.
        </p>
        {state.errors.phone && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
            {state.errors.phone}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="address" className="block text-sm font-medium">
          Address <span className="text-slate-400">(optional)</span>
        </label>
        <input
          id="address"
          name="address"
          defaultValue={defaults.address}
          className={`${field} mt-1`}
        />
      </div>

      <div className="flex items-center gap-3">
        <SubmitButton />
        <Link href={cancelHref} className="text-sm text-slate-500 hover:underline">
          Cancel
        </Link>
      </div>
    </form>
  );
}
