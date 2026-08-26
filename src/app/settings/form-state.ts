import type { FieldErrors } from "@/lib/validation";

// Kept out of actions.ts: a "use server" module may only export async
// functions, so shared types and constants live here.

export interface SettingsFormState {
  errors: FieldErrors;
  savedAt?: string;
}

export const emptySettingsFormState: SettingsFormState = { errors: {} };

/** Data URLs are stored inline in SQLite, so the logo has to stay small. */
export const MAX_LOGO_BYTES = 400_000;
