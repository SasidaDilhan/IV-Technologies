import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

/**
 * Build the database the client's machine starts from.
 *
 * Keeps what is real and hard to retype - the item catalogue with its prices,
 * and the business identity, logo, terms and numbering. Removes everything
 * that was development data: the placeholder serial numbers, the seeded
 * customer, and the quotations and invoices built while testing.
 *
 * Writes to handover/dev.db and never touches the working database, so this is
 * safe to run and re-run.
 *
 *   npm run db:handover                    catalogue + settings
 *   npm run db:handover -- --no-items      settings only, empty catalogue
 *   npm run db:handover -- --keep-quotations
 */

async function main() {
  const keepQuotations = process.argv.includes("--keep-quotations");
  const dropItems = process.argv.includes("--no-items");
  const outDir = path.resolve("handover");
  const target = path.join(outDir, "dev.db");

  fs.mkdirSync(outDir, { recursive: true });
  if (fs.existsSync(target)) fs.unlinkSync(target);

  // Snapshot the live database rather than copying the file - see backup.ts.
  const source = new PrismaClient();
  try {
    const literal = target.replace(/\\/g, "/").replace(/'/g, "''");
    await source.$executeRawUnsafe(`VACUUM INTO '${literal}'`);
  } finally {
    await source.$disconnect();
  }

  const db = new PrismaClient({ datasources: { db: { url: `file:${target}` } } });
  try {
    const before = {
      items: await db.item.count(),
      serials: await db.serialUnit.count(),
      customers: await db.customer.count(),
      quotations: await db.quotation.count(),
      invoices: await db.invoice.count(),
    };

    // Order matters: children before parents.
    await db.payment.deleteMany();
    await db.serialUnit.deleteMany();
    await db.invoiceLine.deleteMany();
    await db.invoice.deleteMany();

    if (!keepQuotations) {
      await db.quoteLine.deleteMany();
      await db.quotation.deleteMany();
      await db.customer.deleteMany();
    }

    // Only possible once no bill line references them - Item deletes are
    // Restrict, which is what stops a sold item vanishing from history.
    if (dropItems) await db.item.deleteMany();

    // The counters must not rewind past anything still in the file.
    const highestQuote = (await db.quotation.findMany({ select: { quoteNo: true } }))
      .map((q) => Number(q.quoteNo))
      .filter((n) => Number.isFinite(n))
      .reduce((max, n) => (n > max ? n : max), 1253);

    const settings = await db.settings.update({
      where: { id: 1 },
      data: { quoteNextNumber: highestQuote + 1, invoiceNextNumber: 1 },
    });

    const after = {
      items: await db.item.count(),
      serials: await db.serialUnit.count(),
      customers: await db.customer.count(),
      quotations: await db.quotation.count(),
      invoices: await db.invoice.count(),
    };

    console.log(`Handover database written to:\n  ${target}\n`);
    console.log("                 before   after");
    for (const key of Object.keys(before) as (keyof typeof before)[]) {
      console.log(
        `  ${key.padEnd(12)} ${String(before[key]).padStart(6)}  ${String(
          after[key],
        ).padStart(6)}`,
      );
    }

    console.log("\nkept:");
    console.log(`  business : ${settings.businessName}`);
    console.log(`  logo     : ${settings.logoDataUrl ? "embedded" : "MISSING"}`);
    console.log(`  terms    : ${settings.defaultTerms.split("\n").length} lines`);
    console.log(
      `  next quote / invoice: ${settings.quotePrefix}` +
        `${String(settings.quoteNextNumber).padStart(settings.quoteNumberPadding, "0")}` +
        ` / ${settings.invoicePrefix}` +
        `${String(settings.invoiceNextNumber).padStart(settings.invoiceNumberPadding, "0")}`,
    );

    if (after.serials > 0) {
      throw new Error("placeholder serial numbers were not removed");
    }
    if (dropItems && after.items > 0) {
      throw new Error("the catalogue was not emptied");
    }

    console.log(
      "\nCopy handover/dev.db to the client machine as prisma/dev.db " +
        "AFTER running install-pos.bat there.",
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error("FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
