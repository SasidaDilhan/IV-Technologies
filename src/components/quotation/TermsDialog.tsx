"use client";

import { useEffect } from "react";

interface Props {
  open: boolean;
  value: string;
  defaultTerms: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

/**
 * Terms live in a dialog rather than on the till screen: they are set once and
 * rarely touched, and inline they would push the totals off a single view.
 */
export default function TermsDialog({
  open,
  value,
  defaultTerms,
  onChange,
  onClose,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const dirty = value !== defaultTerms;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4 dark:border-slate-800">
          <div>
            <h2 className="font-semibold">Terms &amp; conditions</h2>
            <p className="text-xs text-slate-500">
              Applies to this quotation only. The saved template is not changed.
              Use <span className="font-mono">#</span> for a heading and{" "}
              <span className="font-mono">-</span> for a bullet.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Done
          </button>
        </div>

        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-0 flex-1 resize-none bg-transparent p-4 font-mono text-xs leading-relaxed focus:outline-none"
        />

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-3 dark:border-slate-800">
          <span className="text-xs text-slate-500">
            {dirty ? "Edited for this quotation" : "Using the saved template"}
          </span>
          <button
            type="button"
            onClick={() => onChange(defaultTerms)}
            disabled={!dirty}
            className="text-xs text-slate-500 underline disabled:opacity-40"
          >
            Reset to saved template
          </button>
        </div>
      </div>
    </div>
  );
}
