import path from "node:path";
import { PrismaClient } from "@prisma/client";

/**
 * Check the database inside the built package before it goes to a client.
 *
 * The package is assembled from several moving parts and can be built while
 * the handover database is mid-edit, so the thing that actually ships is what
 * gets inspected here - not the script that was supposed to produce it.
 *
 *   npm run verify:package
 */
const target = path.resolve("handover/IV-Technology-Billing/prisma/dev.db");
const db = new PrismaClient({ datasources: { db: { url: `file:${target}` } } });

let fails = 0;
function check(label: string, cond: boolean, detail = "") {
  if (!cond) fails++;
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? "  -> " + detail : ""}`);
}

async function main() {
  console.log(`Inspecting the database inside the package:\n  ${target}\n`);

  console.log("--- must be EMPTY ---");
  const counts = {
    customers: await db.customer.count(),
    items: await db.item.count(),
    serialUnits: await db.serialUnit.count(),
    quotations: await db.quotation.count(),
    quoteLines: await db.quoteLine.count(),
    invoices: await db.invoice.count(),
    invoiceLines: await db.invoiceLine.count(),
    payments: await db.payment.count(),
  };
  for (const [name, n] of Object.entries(counts)) {
    check(`${name} empty`, n === 0, String(n));
  }

  console.log("\n--- must be KEPT ---");
  const s = await db.settings.findUnique({ where: { id: 1 } });
  check("settings row exists", s !== null);
  if (!s) return;
  check("business name", s.businessName === "IV Technology", s.businessName);
  check("address", (s.addressLine1 ?? "").includes("Mahadeniya"), s.addressLine1 ?? "");
  check("city", s.city === "Kaduwela", s.city ?? "");
  check("phone", s.phone === "0771890058", s.phone ?? "");
  check("email", s.email === "ivtechnology20@gmail.com", s.email ?? "");
  check("registration no", s.regNo === "WP/COL/KA/2024/00624", s.regNo ?? "");
  check("strapline", (s.website ?? "").includes("CCTV Sales"), s.website ?? "");
  check("logo embedded", (s.logoDataUrl ?? "").startsWith("data:image/jpeg"),
        s.logoDataUrl ? `${Math.round(s.logoDataUrl.length / 1024)} KB` : "MISSING");
  check("terms template", s.defaultTerms.split("\n").length > 30,
        `${s.defaultTerms.split("\n").length} lines`);

  console.log("\n--- numbering ---");
  const quoteNo =
    s.quotePrefix + String(s.quoteNextNumber).padStart(s.quoteNumberPadding, "0");
  const invNo =
    s.invoicePrefix + String(s.invoiceNextNumber).padStart(s.invoiceNumberPadding, "0");
  check("first quotation will be 001254", quoteNo === "001254", quoteNo);
  check("first invoice will be INV-000001", invNo === "INV-000001", invNo);

  console.log(
    fails === 0
      ? "\nCLEAN - safe to send to the client"
      : `\n${fails} PROBLEM(S) - do not send yet`,
  );
  if (fails) process.exitCode = 1;
}

main().finally(() => db.$disconnect());
