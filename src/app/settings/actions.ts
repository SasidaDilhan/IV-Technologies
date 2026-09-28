"use server";

import { spawn } from "node:child_process";
import fs from "node:fs";

import { revalidatePath } from "next/cache";

import { getBackupFolder, localBackupDir, setBackupFolder, takeBackup } from "@/lib/backup";
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

/**
 * Open a backup folder in File Explorer. The system runs on the shop PC
 * itself, so the window opens on the screen the button was pressed on.
 */
export async function openBackupFolderAction(which: "local" | "folder"): Promise<BackupActionResult> {
  const dir = which === "local" ? localBackupDir() : getBackupFolder();
  if (!dir || !fs.existsSync(dir)) {
    return { ok: false, message: "That folder cannot be found - is the drive plugged in?" };
  }
  if (process.platform !== "win32") return { ok: false, message: dir };
  spawn("explorer.exe", [dir], { detached: true, stdio: "ignore" }).unref();
  return { ok: true, message: `Opened ${dir}` };
}
