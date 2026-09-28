import { PrismaClient } from "@prisma/client";

import { human, KEEP_DEFAULT, pinDatabase, takeBackup } from "../src/lib/backup";

/**
 * Take a verified snapshot of the database - see src/lib/backup.ts.
 *
 *   npm run db:backup
 *   npm run db:backup -- --dir "D:/Google Drive/IV Technology backups"
 *   npm run db:backup -- --keep 60
 *
 * Also copies it to the backup folder chosen in Settings, if one is set.
 */

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  pinDatabase();
  const prisma = new PrismaClient();
  try {
    const r = await takeBackup(prisma, {
      dir: arg("dir"),
      keep: Number(arg("keep") ?? KEEP_DEFAULT),
    });
    const s = r.summary;
    console.log(`Backup written and verified:\n  ${r.file}  (${human(r.size)})`);
    console.log(
      `  customers=${s.customers}  items=${s.items}  estimates=${s.quotations}` +
        `  invoices=${s.invoices}  payments=${s.payments}`,
    );
    if (r.copy?.file) {
      console.log(`  Copy saved to backup folder:\n  ${r.copy.file}`);
    } else if (r.copy) {
      // Not fatal: the local backup is good. Most often a USB stick left out.
      console.log(
        `\n  WARNING: could not copy to the backup folder ${r.copy.folder}\n` +
          `  (${r.copy.error})\n  Is the drive plugged in? The local backup above is fine.`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("Backup FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
