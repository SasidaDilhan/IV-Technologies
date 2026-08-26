/**
 * Document reference formatting.
 *
 * Deliberately its own module with no database import: the settings form is a
 * client component and needs this to preview the next number, so it must not
 * drag Prisma into the browser bundle.
 */
export function formatDocNo(prefix: string, n: number, padding: number): string {
  return `${prefix}${String(n).padStart(padding, "0")}`;
}
