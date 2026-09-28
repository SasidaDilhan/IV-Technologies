import type { PrismaClient } from "@prisma/client";

import { takeBackup } from "@/lib/backup";

/**
 * Back up automatically after data changes.
 *
 * Not on every save: a long bill is many saves in a few minutes, and a backup
 * each time would push the older backups out of the kept set. Instead the
 * first change starts a short timer, and one backup covers every change made
 * before it fires - at most one backup a minute, always within a minute of the
 * last change. The save itself never waits for the backup.
 *
 * Set AUTO_BACKUP=off in .env to disable (Back up now and START.bat still
 * back up).
 */

const DELAY_MS = Number(process.env.AUTO_BACKUP_DELAY_MS) || 60_000;

/** Operations that change data. Raw SQL is left out - the backup itself is raw. */
const WRITES = new Set([
  "create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany",
]);

// Kept on globalThis so a dev-server reload does not start a second timer.
const state = globalThis as unknown as {
  autoBackupTimer?: ReturnType<typeof setTimeout> | null;
  autoBackupRunning?: boolean;
  autoBackupPending?: boolean;
  autoBackupFailures?: number;
};

/** Retries after a failure (e.g. the database busy mid-save) before waiting for the next change. */
const MAX_RETRIES = 3;

export function isWrite(action: string): boolean {
  return WRITES.has(action);
}

export function scheduleBackup(prisma: PrismaClient): void {
  if (process.env.AUTO_BACKUP === "off") return;
  // A backup already running will be followed by another, so changes made
  // while it runs are not missed.
  if (state.autoBackupRunning) {
    state.autoBackupPending = true;
    return;
  }
  if (state.autoBackupTimer) return;

  const timer = setTimeout(() => void run(prisma), DELAY_MS);
  // Never keep a script or a test alive just to take a backup.
  timer.unref?.();
  state.autoBackupTimer = timer;
}

async function run(prisma: PrismaClient): Promise<void> {
  state.autoBackupTimer = null;
  state.autoBackupRunning = true;
  state.autoBackupPending = false;
  try {
    const r = await takeBackup(prisma);
    state.autoBackupFailures = 0;
    if (r.copy?.error) {
      console.warn(`[auto-backup] saved on this PC; copy to ${r.copy.folder} failed: ${r.copy.error}`);
    }
  } catch (e) {
    // Logged, never thrown: a failed backup must not break billing. It is
    // retried a few times, then again on the next change; Settings shows when
    // the last backup was taken.
    console.error("[auto-backup] FAILED:", e instanceof Error ? e.message : e);
    state.autoBackupFailures = (state.autoBackupFailures ?? 0) + 1;
    if (state.autoBackupFailures <= MAX_RETRIES) state.autoBackupPending = true;
  } finally {
    state.autoBackupRunning = false;
    if (state.autoBackupPending) scheduleBackup(prisma);
  }
}
