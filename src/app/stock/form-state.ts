// Kept out of actions.ts: a "use server" module may only export async
// functions, so shared types and constants live here.

export interface SerialFormState {
  error?: string;
  /** Serial accepted on the last submit, echoed back as confirmation. */
  added?: string;
  /** Bumped on every submit so the client can react to repeat scans. */
  nonce: number;
}

export const emptySerialFormState: SerialFormState = { nonce: 0 };
