/**
 * Payment methods, in their own module so client components can import them
 * without pulling the database code in lib/invoices into the browser bundle.
 */
export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
];
