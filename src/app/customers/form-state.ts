import type { FieldErrors } from "@/lib/validation";

// Kept out of actions.ts: a "use server" module may only export async
// functions, so shared types and constants live here.

export interface CustomerFormState {
  errors: FieldErrors;
}

export const emptyCustomerFormState: CustomerFormState = { errors: {} };
