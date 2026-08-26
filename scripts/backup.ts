import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

/**
 * Take a consistent snapshot of the database.
 *
 * Uses SQLite's own `VACUUM INTO` rather than copying the file. A plain copy
 * of a database that is in use can capture a torn state - the main file and
 * its journal caught mid-write - which restores as corruption. VACUUM INTO
 * writes a clean, fully-consistent copy while the app keeps running, so this
 * is safe to run on the shop machine at any time of day.
 *
 *   npm run db:backup
 *   npm run db:backup -- --dir "D:/Google Drive/IV Technology backups"
 *   npm run db:backup -- --keep 60
 */

const KEEP_DEFAULT = 30;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}${p(d.getMinutes())}`
  );
}

function human(bytes: number): string {
  return bytes < 1_000_000
    ? `${Math.round(bytes / 1000)} KB`
    : `${(bytes / 1_000_000).toFixed(1)} MB`;
}

async function main() {
  const dir = path.resolve(arg("dir") ?? process.env.BACKUP_DIR ?? "backups");
  const keep = Number(arg("keep") ?? KEEP_DEFAULT);

  fs.mkdirSync(dir, { recursive: true });

  const target = path.join(dir, `iv-technology-${stamp(new Date())}.db`);
  if (fs.existsSync(target)) {
    console.log(`A backup for this minute already exists:\n  ${target}`);
    return;
  }

  const prisma = new PrismaClient();
  try {
    // SQLite needs forward slashes and doubled quotes inside the literal.
    const literal = target.replace(/\\/g, "/").replace(/'/g, "''");
    await prisma.$executeRawUnsafe(`VACUUM INTO '${literal}'`);
  } finally {
    await prisma.$disconnect();
  }

  // Read the snapshot back before claiming success - a backup nobody has
  // opened is a promise, not a backup.
  const verifier = new PrismaClient({
    datasources: { db: { url: `file:${target}` } },
  });
  let counts: Record<string, number>;
  try {
    counts = {
      customers: await verifier.customer.count(),
      items: await verifier.item.count(),
      serialUnits: await verifier.serialUnit.count(),
      quotations: await verifier.quotation.count(),
      invoices: await verifier.invoice.count(),
      payments: await verifier.payment.count(),
    };
  } finally {
    await verifier.$disconnect();
  }

  const size = fs.statSync(target).size;
  console.log(`Backup written and verified:\n  ${target}  (${human(size)})`);
  console.log(
    "  " +
      Object.entries(counts)
        .map(([k, v]) => `${k}=${v}`)
        .join("  "),
  );

  // Prune the oldest, keeping the most recent `keep`.
  const existing = fs
    .readdirSync(dir)
    .filter((f) => /^iv-technology-.*\.db$/.test(f))
    .sort();

  const excess = existing.slice(0, Math.max(0, existing.length - keep));
  for (const f of excess) fs.unlinkSync(path.join(dir, f));

  console.log(
    `  ${existing.length - excess.length} backup(s) kept` +
      (excess.length ? `, ${excess.length} older removed` : ""),
  );
}

main().catch((e) => {
  console.error("Backup FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
