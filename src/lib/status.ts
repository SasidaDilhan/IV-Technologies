/**
 * What a document's stored status is called on screen.
 *
 * The stored values ("draft", "confirmed", "issued" ...) are left exactly as
 * they are in the database - renaming them would mean rewriting the client's
 * existing rows. Only the words shown to the operator change here.
 */

export type DocKind = "quotation" | "invoice";

const QUOTATION: Record<string, string> = {
  draft: "Estimate",
  sent: "Estimate - sent",
  confirmed: "Invoiced",
};

const INVOICE: Record<string, string> = {
  issued: "Invoice",
  draft: "Invoice",
  superseded: "Superseded",
  cancelled: "Cancelled",
};

export function statusLabel(kind: DocKind, status: string): string {
  const table = kind === "quotation" ? QUOTATION : INVOICE;
  return table[status] ?? status;
}

/** Tailwind classes for the status pill, by meaning rather than raw value. */
export function statusTone(kind: DocKind, status: string): string {
  if (kind === "invoice" && status === "superseded") {
    return "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
  }
  if (kind === "quotation" && status === "confirmed") {
    return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300";
  }
  if (kind === "quotation") {
    return "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300";
  }
  return "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300";
}
