import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

/**
 * Backups of the one file that holds everything: prisma/dev.db.
 *
 * Every backup is written twice when a backup folder is set:
 *   1. backups/ inside the program folder - always there, fast to restore;
 *   2. the backup folder the shop chose (another drive, a USB stick, a Google
 *      Drive folder) - survives the disk or the computer dying.
 *
 * Snapshots use SQLite's own `VACUUM INTO` rather than copying the file. A
 * plain copy of a database that is in use can capture a torn state - the main
 * file and its journal caught mid-write - which restores as corruption. VACUUM
 * INTO writes a clean, consistent copy while the app keeps running, so a
 * backup is safe at any time of day, even mid-bill.
 *
 * Used by the Settings page ("Back up now"), scripts/backup.ts (START.bat,
 * UPDATE.bat, BACKUP.bat) and scripts/restore.ts.
 */

/** Most recent backups kept, whatever their age. */
export const KEEP_DEFAULT = 50;
/** Days for which the day's last backup is also kept. */
export const DAILY_DAYS = 60;

/**
 * For scripts: resolve the database once and hand Prisma that exact file, so
 * the file a script checks and replaces is always the one Prisma opens.
 */
export function pinDatabase(): string {
  const file = databasePath();
  process.env.DATABASE_URL = `file:${file}`;
  return file;
}
export const BACKUP_PATTERN = /^iv-technology-.*\.db$/;

/** The shop's chosen second folder is kept in a plain text file, one line. */
const FOLDER_FILE = "backup-folder.txt";

export const localBackupDir = () => path.resolve("backups");

/**
 * The live database file, from DATABASE_URL (relative to prisma/). Read from
 * .env when a script runs without it loaded - Next.js loads it for the app.
 */
export function databasePath(): string {
  let url = process.env.DATABASE_URL;
  if (!url) {
    try {
      const m = fs.readFileSync(path.resolve(".env"), "utf8").match(/^\s*DATABASE_URL\s*=\s*"?([^"\r\n]+)"?/m);
      url = m?.[1];
    } catch {
      // no .env - fall through to the default
    }
  }
  url ??= "file:./dev.db";
  const file = url.replace(/^file:/, "");
  return path.isAbsolute(file) ? file : path.resolve("prisma", file);
}

/**
 * Where Google Drive for desktop puts "My Drive" on this PC, if it is
 * installed and signed in - usually G:\My Drive. Files saved there upload to
 * the owner's Google Drive by themselves.
 */
export function findGoogleDrive(): string | null {
  if (process.platform !== "win32") return null;
  for (const letter of "GDEFHIJKLMNOPQRSTUVWXYZ") {
    const p = `${letter}:\\My Drive`;
    try {
      if (fs.statSync(p).isDirectory()) return p;
    } catch {
      // no such drive, or not Google Drive
    }
  }
  // Older "Backup and Sync" kept it in the user's profile.
  const legacy = path.join(process.env.USERPROFILE ?? "", "Google Drive");
  try {
    if (process.env.USERPROFILE && fs.statSync(legacy).isDirectory()) return legacy;
  } catch {
    // not there either
  }
  return null;
}

export function getBackupFolder(): string | null {
  try {
    const line = fs.readFileSync(path.resolve(FOLDER_FILE), "utf8").split(/\r?\n/)[0].trim();
    return line || null;
  } catch {
    return null;
  }
}

/**
 * Set (or clear, with "") the second backup folder. The folder is created and
 * a test file written, so a typo or a read-only drive is caught now rather
 * than on the day the backup is needed.
 */
export function setBackupFolder(folder: string): { ok: true } | { ok: false; error: string } {
  const f = folder.trim().replace(/^"(.*)"$/, "$1");
  if (!f) {
    fs.rmSync(path.resolve(FOLDER_FILE), { force: true });
    return { ok: true };
  }
  if (/^https?:\/\//i.test(f)) {
    return {
      ok: false,
      error:
        "That is a web link - backups need a folder on this PC. Install Google Drive for " +
        "desktop (google.com/drive/download) and sign in; then reopen Settings and press " +
        '"Use Google Drive". Backups saved there upload to Google Drive by themselves.',
    };
  }
  if (!path.isAbsolute(f)) {
    return { ok: false, error: 'Give the full folder path, e.g. E:\\IV Technology backups' };
  }
  if (path.resolve(f).startsWith(localBackupDir())) {
    return { ok: false, error: "That is the normal backups folder. Pick another drive." };
  }
  try {
    fs.mkdirSync(f, { recursive: true });
    const probe = path.join(f, ".write-test");
    fs.writeFileSync(probe, "ok");
    fs.rmSync(probe, { force: true });
  } catch (e) {
    return { ok: false, error: `Cannot write to that folder: ${(e as Error).message}` };
  }
  fs.writeFileSync(path.resolve(FOLDER_FILE), f + "\r\n", "utf8");
  return { ok: true };
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

export interface DbSummary {
  customers: number;
  items: number;
  quotations: number;
  invoices: number;
  payments: number;
  lastInvoice: string | null;
  lastInvoiceDate: Date | null;
}

/**
 * Open a database file and read what is in it. Throws if it is not a readable
 * database of this system. Raw SQL only, so it also reads backups taken by an
 * older version whose tables lack newer columns.
 */
export async function inspectDatabase(file: string): Promise<DbSummary> {
  const head = Buffer.alloc(16);
  const fd = fs.openSync(file, "r");
  try {
    fs.readSync(fd, head, 0, 16, 0);
  } finally {
    fs.closeSync(fd);
  }
  if (head.toString("latin1") !== "SQLite format 3\0") {
    throw new Error("This is not a database file.");
  }

  const db = new PrismaClient({ datasources: { db: { url: `file:${file}` } } });
  try {
    const count = async (table: string) => {
      const rows = await db.$queryRawUnsafe<{ n: bigint | number }[]>(
        `SELECT COUNT(*) AS n FROM "${table}"`,
      );
      return Number(rows[0].n);
    };
    const last = await db.$queryRawUnsafe<{ invoiceNo: string; issueDate: unknown }[]>(
      `SELECT invoiceNo, issueDate FROM "Invoice" ORDER BY id DESC LIMIT 1`,
    );
    const raw = last[0]?.issueDate;
    const lastDate =
      raw == null ? null : new Date(typeof raw === "bigint" ? Number(raw) : (raw as string | number));
    return {
      customers: await count("Customer"),
      items: await count("Item"),
      quotations: await count("Quotation"),
      invoices: await count("Invoice"),
      payments: await count("Payment"),
      lastInvoice: last[0]?.invoiceNo ?? null,
      lastInvoiceDate: lastDate && !Number.isNaN(lastDate.getTime()) ? lastDate : null,
    };
  } catch (e) {
    throw new Error(
      `This file is not a readable IV Technology database (${(e as Error).message.split("\n")[0]}).`,
    );
  } finally {
    await db.$disconnect();
  }
}

/**
 * Keep the newest `keep` backups, plus the last backup of each of the most
 * recent DAILY_DAYS days. Backups are taken after every change, so a busy day
 * alone would fill `keep`; the daily ones make sure a mistake noticed a week
 * later can still be undone.
 */
function prune(dir: string, keep: number): number {
  // Names are iv-technology-YYYY-MM-DD_HHMMSS..., so a sort is oldest-first.
  const files = fs.readdirSync(dir).filter((f) => BACKUP_PATTERN.test(f)).sort();
  const kept = new Set(files.slice(-keep));
  const lastOfDay = new Map<string, string>();
  for (const f of files) lastOfDay.set(f.slice("iv-technology-".length, "iv-technology-".length + 10), f);
  Array.from(lastOfDay.keys())
    .sort()
    .slice(-DAILY_DAYS)
    .forEach((day) => kept.add(lastOfDay.get(day)!));

  const excess = files.filter((f) => !kept.has(f));
  for (const f of excess) fs.rmSync(path.join(dir, f), { force: true });
  return excess.length;
}

export interface BackupResult {
  file: string;
  size: number;
  summary: DbSummary;
  /** The copy in the chosen backup folder, if one is set. */
  copy: { folder: string; file: string | null; error: string | null } | null;
}

/**
 * Snapshot the live database into backups/ (or `dir`), verify it by reading
 * it back, then copy it to the chosen backup folder.
 *
 * A failure of the second copy - the USB stick is not plugged in - is
 * reported but does not fail the backup: the local one is good.
 */
export async function takeBackup(
  prisma: PrismaClient,
  opts: { dir?: string; keep?: number; label?: string } = {},
): Promise<BackupResult> {
  const dir = path.resolve(opts.dir ?? process.env.BACKUP_DIR ?? localBackupDir());
  const keep = opts.keep ?? KEEP_DEFAULT;
  fs.mkdirSync(dir, { recursive: true });

  const name = `iv-technology-${stamp(new Date())}${opts.label ? `-${opts.label}` : ""}.db`;
  const target = path.join(dir, name);
  if (fs.existsSync(target)) fs.rmSync(target);

  // SQLite needs forward slashes and doubled quotes inside the literal.
  const literal = target.replace(/\\/g, "/").replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`VACUUM INTO '${literal}'`);

  // Read it back before claiming success - a backup nobody has opened is a
  // promise, not a backup.
  const summary = await inspectDatabase(target);
  const size = fs.statSync(target).size;
  prune(dir, keep);

  let copy: BackupResult["copy"] = null;
  const folder = getBackupFolder();
  if (folder) {
    try {
      fs.mkdirSync(folder, { recursive: true });
      const dest = path.join(folder, name);
      fs.copyFileSync(target, dest);
      if (fs.statSync(dest).size !== size) throw new Error("the copy is incomplete");
      prune(folder, keep);
      copy = { folder, file: dest, error: null };
    } catch (e) {
      copy = { folder, file: null, error: (e as Error).message };
    }
  }

  return { file: target, size, summary, copy };
}

export interface BackupEntry {
  file: string;
  name: string;
  where: "local" | "folder";
  size: number;
  modified: Date;
}

/** Every backup in both places, newest first. */
export function listBackups(): BackupEntry[] {
  const out: BackupEntry[] = [];
  const scan = (dir: string, where: BackupEntry["where"]) => {
    let names: string[] = [];
    try {
      names = fs.readdirSync(dir).filter((f) => BACKUP_PATTERN.test(f));
    } catch {
      return; // folder missing or drive unplugged
    }
    for (const name of names) {
      const file = path.join(dir, name);
      const st = fs.statSync(file);
      out.push({ file, name, where, size: st.size, modified: st.mtime });
    }
  };
  scan(localBackupDir(), "local");
  const folder = getBackupFolder();
  if (folder) scan(folder, "folder");
  return out.sort((a, b) => b.modified.getTime() - a.modified.getTime());
}

export function human(bytes: number): string {
  return bytes < 1_000_000 ? `${Math.round(bytes / 1000)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;
}
