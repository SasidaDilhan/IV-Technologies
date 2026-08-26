"use server";

import { revalidatePath } from "next/cache";

import { applySettings } from "@/lib/settings-save";
import type { SettingsFormState } from "./form-state";

/** Thin wrapper: the real work lives in lib/settings-save so it stays testable. */
export async function saveSettings(
  prev: SettingsFormState,
  form: FormData,
): Promise<SettingsFormState> {
  const result = await applySettings(prev, form);

  if (Object.keys(result.errors).length === 0) {
    revalidatePath("/settings");
    revalidatePath("/");
  }

  return result;
}
