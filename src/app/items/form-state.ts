import type { FieldErrors } from "@/lib/validation";

// Kept out of actions.ts: a "use server" module may only export async
// functions, so shared types and constants live here.

export interface ItemFormState {
  errors: FieldErrors;
}

export const emptyItemFormState: ItemFormState = { errors: {} };
