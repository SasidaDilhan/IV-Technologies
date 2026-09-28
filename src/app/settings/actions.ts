"use server";

import { revalidatePath } from "next/cache";

import { setBackupFolder, takeBackup } from "@/lib/backup";
import { prisma } from "@/lib/prisma";
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

export interface BackupActionResult {
  ok: boolean;
  message: string;
  warning?: string;
}

/** "Back up now" on the Settings page. */
export async function backupNowAction(): Promise<BackupActionResult> {
  try {
    const r = await takeBackup(prisma);
    revalidatePath("/settings");
    return {
      ok: true,
      message: `Backup saved: ${r.summary.invoices} invoices, ${r.summary.customers} customers.`,
      warning: r.copy?.error
        ? `Could not copy to ${r.copy.folder} (${r.copy.error}). Is the drive plugged in? The backup on this PC is fine.`
        : undefined,
    };
  } catch (e) {
    return { ok: false, message: `Backup FAILED: ${(e as Error).message}` };
  }
}

/** Set or clear the second backup folder, then take a backup to prove it works. */
export async function saveBackupFolderAction(folder: string): Promise<BackupActionResult> {
  const set = setBackupFolder(folder);
  if (!set.ok) return { ok: false, message: set.error };
  revalidatePath("/settings");
  if (!folder.trim()) return { ok: true, message: "Backup folder removed. Backups stay on this PC only." };
  const r = await backupNowAction();
  return r.ok ? { ...r, message: `Backup folder saved. ${r.message}` } : r;
}
