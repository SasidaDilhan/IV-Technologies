"use client";

import { useEffect, useRef, useState, useTransition } from "react";

import { createCustomer } from "@/app/quotations/actions";

export interface SelectedCustomer {
  id: number;
  name: string;
  phone: string;
  address: string | null;
}

interface Props {
  selected: SelectedCustomer | null;
  onSelect: (customer: SelectedCustomer | null) => void;
}

const field =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-slate-400 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

/** Customer lookup by phone or name, sized for the till's side rail. */
export default function CustomerPanel({ selected, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<SelectedCustomer[]>([]);
  const [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false);
  const [creating, startCreate] = useTransition();
  const [createError, setCreateError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (selected) return;
    // Two characters is enough for a name; the endpoint decides whether the
    // text looks like a phone number and matches accordingly.
    if (query.trim().length < 2) {
      setMatches([]);
      setSearched(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/customers/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        const data = await res.json();
        setMatches(data.customers ?? []);
        setSearched(true);
      } catch {
        // Superseded keystroke or offline.
      } finally {
        setSearching(false);
      }
    }, 250);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, selected]);

  if (selected) {
    return (
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{selected.name}</p>
          <p className="font-mono text-sm text-slate-600 dark:text-slate-400">
            {selected.phone}
          </p>
          {selected.address && (
            <p className="truncate text-xs text-slate-500">{selected.address}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setQuery("");
            setMatches([]);
            setSearched(false);
          }}
          className="shrink-0 text-xs text-slate-500 underline hover:text-slate-800 dark:hover:text-slate-200"
        >
          Change
        </button>
      </div>
    );
  }

  const noMatch = searched && !searching && matches.length === 0;

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Phone number or name"
        autoComplete="off"
        className={field}
      />

      {searching && <p className="mt-1 text-xs text-slate-500">Searching...</p>}

      {matches.length > 0 && (
        <ul className="mt-2 max-h-40 divide-y divide-slate-200 overflow-y-auto rounded-md border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onSelect(m)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <span className="block truncate font-medium">{m.name}</span>
                <span className="block font-mono text-xs text-slate-500">{m.phone}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {noMatch && (
        <form
          ref={formRef}
          className="mt-2 space-y-2 rounded-md border border-dashed border-slate-300 p-2 dark:border-slate-700"
          action={(formData) => {
            setCreateError(null);
            startCreate(async () => {
              const result = await createCustomer(formData);
              if (result.ok && result.customer) {
                onSelect(result.customer);
                formRef.current?.reset();
              } else {
                setCreateError(result.error ?? "Could not create the customer.");
              }
            });
          }}
        >
          <p className="text-xs text-slate-500">No match - add them:</p>
          <input
            name="name"
            placeholder="Name"
            defaultValue={/^[\d\s+()-]+$/.test(query) ? "" : query}
            className={field}
          />
          <input
            name="phone"
            defaultValue={/^[\d\s+()-]+$/.test(query) ? query : ""}
            placeholder="Phone"
            className={`${field} font-mono`}
          />
          <input name="address" placeholder="Address (optional)" className={field} />
          {createError && (
            <p className="text-xs text-red-600 dark:text-red-400">{createError}</p>
          )}
          <button
            type="submit"
            disabled={creating}
            className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {creating ? "Saving..." : "Create & select"}
          </button>
        </form>
      )}
    </div>
  );
}
