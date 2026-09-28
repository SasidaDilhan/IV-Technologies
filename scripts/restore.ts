import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

import { PrismaClient } from "@prisma/client";

import {
  pinDatabase,
  human,
  inspectDatabase,
  listBackups,
  takeBackup,
  type DbSummary,
} from "../src/lib/backup";

/**
 * Put a backup back as the live database. Run through RESTORE.bat.
 *
 *   RESTORE.bat                      pick from the list, newest first
 *   drag any .db file onto RESTORE.bat   restore that file (e.g. a dev.db
 *                                        someone copied by hand)
 *
 * Nothing is lost by restoring: the current database is backed up first
 * (or, if it is too damaged to open, kept as dev.db.broken-<time>).
 * RESTORE.bat then runs `prisma migrate deploy`, so a backup taken by an
 * older version is brought up to date.
 */

// Answers are queued as they arrive, so typing ahead (or piped input) is
// never lost between one question and the next.
const rl = readline.createInterface({ input: process.stdin });
const lines: string[] = [];
const waiting: ((line: string | null) => void)[] = [];
let ended = false;
rl.on("line", (l) => (waiting.length ? waiting.shift()!(l) : lines.push(l)));
rl.on("close", () => {
  ended = true;
  while (waiting.length) waiting.shift()!(null);
});

/** Ask a question; a closed input counts as a blank answer. */
function ask(prompt: string): Promise<string> {
  process.stdout.write(prompt);
  if (lines.length) return Promise.resolve(lines.shift()!);
  if (ended) return Promise.resolve("");
  return new Promise((resolve) => waiting.push((l) => resolve(l ?? "")));
}

function when(d: Date | null): string {
  return d
    ? d.toLocaleString("en-GB", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "-";
}

function describe(s: DbSummary): string {
  return (
    `    ${s.invoices} invoices, ${s.quotations} estimates, ${s.customers} customers, ` +
    `${s.items} items, ${s.payments} payments\n` +
    `    Last invoice: ${
      s.lastInvoice
        ? `${s.lastInvoice} (${
            s.lastInvoiceDate?.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) ?? "-"
          })`
        : "none"
    }`
  );
}

async function systemIsRunning(): Promise<boolean> {
  try {
    await fetch(`http://localhost:${process.env.PORT ?? 3000}`, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
}

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function chooseFile(): Promise<string | null> {
  const dropped = process.argv[2]?.trim().replace(/^"(.*)"$/, "$1");
  if (dropped) return path.resolve(dropped);

  const backups = listBackups().slice(0, 15);
  if (backups.length === 0) {
    console.log("  No backups found in the backups folder or the backup drive.");
  } else {
    console.log("  Backups, newest first:\n");
    backups.forEach((b, i) => {
      const where = b.where === "local" ? "this PC " : "backup drive";
      console.log(
        `   ${String(i + 1).padStart(2)}.  ${when(b.modified).padEnd(22)} ${where.padEnd(13)} ${human(b.size)}` +
          (b.name.includes("before-restore") ? "  (taken before a restore)" : ""),
      );
    });
  }
  console.log("\n    P.  Use another file (for example a dev.db copied by hand)");
  console.log("    Q.  Cancel\n");

  const answer = (
    await ask(backups.length ? "  Which one? [Enter = 1, the newest]: " : "  P or Q: ")
  ).trim().toUpperCase();

  if (answer === "Q") return null;
  if (answer === "P") {
    const p = (await ask("  Paste the full path of the file: ")).trim().replace(/^"(.*)"$/, "$1");
    return p ? path.resolve(p) : null;
  }
  const n = answer === "" ? 1 : Number(answer);
  if (!Number.isInteger(n) || n < 1 || n > backups.length) {
    console.log("  That is not one of the numbers above.");
    return null;
  }
  return backups[n - 1].file;
}

async function main(): Promise<number> {
  const live = pinDatabase();

  if (await systemIsRunning()) {
    console.log(
      "\n  The billing system is still running.\n" +
        "  Close its black window first, then run RESTORE.bat again.",
    );
    return 1;
  }

  const file = await chooseFile();
  if (!file) {
    console.log("\n  Cancelled. Nothing was changed.");
    return 2;
  }
  if (!fs.existsSync(file)) {
    console.log(`\n  File not found:\n    ${file}`);
    return 1;
  }
  if (path.resolve(file) === path.resolve(live)) {
    console.log("\n  That is the database in use now - choose a backup instead.");
    return 1;
  }

  let chosen: DbSummary;
  try {
    chosen = await inspectDatabase(file);
  } catch (e) {
    console.log(`\n  Cannot use this file: ${(e as Error).message}`);
    return 1;
  }

  console.log(`\n  Restore from:\n    ${file}\n${describe(chosen)}`);

  let current: DbSummary | null = null;
  if (fs.existsSync(live)) {
    try {
      current = await inspectDatabase(live);
      console.log(`\n  It will REPLACE what is in the system now:\n${describe(current)}`);
    } catch {
      console.log("\n  The database in use now cannot be read (it may be damaged).");
    }
  }

  const ok = (await ask('\n  Type YES to restore, anything else to cancel: ')).trim();
  if (ok !== "YES") {
    console.log("\n  Cancelled. Nothing was changed.");
    return 2;
  }

  // Keep what is there now - a restore must never be the thing that loses data.
  if (fs.existsSync(live)) {
    if (current) {
      const prisma = new PrismaClient();
      try {
        const r = await takeBackup(prisma, { label: "before-restore" });
        console.log(`\n  Current data saved first:\n    ${r.file}`);
      } finally {
        await prisma.$disconnect();
      }
    } else {
      const kept = path.join(path.dirname(live), `dev.db.broken-${stamp()}`);
      fs.copyFileSync(live, kept);
      console.log(`\n  Damaged database kept as:\n    ${kept}`);
    }
  }

  // Copy beside the live file, then swap it in. Old journal files belong to
  // the database being replaced; left behind, SQLite would replay them into
  // the restored one and corrupt it.
  const temp = `${live}.restoring`;
  fs.copyFileSync(file, temp);
  for (const ext of ["-journal", "-wal", "-shm"]) fs.rmSync(live + ext, { force: true });
  try {
    fs.renameSync(temp, live);
  } catch (e) {
    fs.rmSync(temp, { force: true });
    console.log(
      `\n  Could not replace the database: ${(e as Error).message}\n` +
        "  Is the billing system still open somewhere? Close it and try again.\n" +
        "  Nothing was changed.",
    );
    return 1;
  }

  const after = await inspectDatabase(live);
  console.log(`\n  Restored. The system now has:\n${describe(after)}`);
  return 0;
}

main()
  .then((code) => {
    rl.close();
    process.exit(code);
  })
  .catch((e) => {
    rl.close();
    console.error("\n  Restore FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
