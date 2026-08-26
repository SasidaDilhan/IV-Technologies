/**
 * Small hand-rolled form validation.
 *
 * Deliberately not a schema library: the forms in this app are few and simple,
 * and the rules read more clearly inline than they would as a schema.
 */

export type FieldErrors = Record<string, string>;

export interface Validated<T> {
  ok: boolean;
  errors: FieldErrors;
  value: T;
}

/** Trim a form value to a string, treating null/File as empty. */
export function str(form: FormData, key: string): string {
  const raw = form.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

export function bool(form: FormData, key: string): boolean {
  return form.get(key) === "on" || form.get(key) === "true";
}

/**
 * Parse a human-typed rupee amount ("12,500" / "12500.50") into a number.
 * Returns NaN when it is not a sane amount, so callers can report it.
 */
export function parseRupees(input: string): number {
  if (!input) return NaN;
  const cleaned = input.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return NaN;
  return Number(cleaned);
}

/**
 * Normalise a scanned or typed serial number.
 * Scanners often emit trailing whitespace and inconsistent case; storing a
 * single canonical form is what makes the unique constraint meaningful.
 */
export function normaliseSerial(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}

/** Same normalisation for item codes, which are also scanned/typed. */
export function normaliseCode(input: string): string {
  return input.trim().toUpperCase();
}

/**
 * Reduce a Sri Lankan phone number to one canonical local form.
 *
 * "+94 77 945 7745", "0094779457745", "077 945 7745" and "779457745" are all
 * the same person, and the phone number is the customer key - without this
 * the same customer gets created twice under two spellings.
 *
 *   +94 77 945 7745  ->  0779457745
 *   077 945 7745     ->  0779457745
 *   77 945 7745      ->  0779457745
 */
export function normalisePhone(input: string): string {
  let digits = input.replace(/\D/g, "");

  // International prefix, with or without the 00 trunk.
  if (digits.startsWith("0094")) digits = digits.slice(4);
  else if (digits.startsWith("94") && digits.length >= 11) digits = digits.slice(2);

  // Local subscriber number missing its leading 0.
  if (digits.length === 9 && !digits.startsWith("0")) digits = `0${digits}`;

  return digits;
}

/**
 * Map a Prisma unique-constraint violation to a field error.
 * Returns null when the error is not a P2002, so the caller can rethrow.
 */
export function uniqueFieldError(
  error: unknown,
  fieldMessages: Record<string, string>,
): FieldErrors | null {
  const e = error as { code?: string; meta?: { target?: unknown } };
  if (e?.code !== "P2002") return null;

  const target = e.meta?.target;
  const fields = Array.isArray(target)
    ? (target as string[])
    : typeof target === "string"
      ? [target]
      : [];

  for (const field of fields) {
    if (fieldMessages[field]) return { [field]: fieldMessages[field] };
  }
  // Unique violation on a column we did not anticipate.
  return { _form: "That value is already used by another record." };
}
