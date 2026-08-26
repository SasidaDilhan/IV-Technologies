import fs from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";
import { billTotals, formatLKR, toCents } from "../src/lib/money";
import { DEFAULT_TERMS, SETTINGS_ID } from "../src/lib/settings";

const prisma = new PrismaClient();

// ===========================================================================
// Real data, transcribed from Estimate 001253 (issued 14 Aug 2026).
//
// Prices are in RUPEES here and converted with toCents() on the way in.
// ===========================================================================

/** Business identity, from the estimate header and the terms page footer. */
const SETTINGS = {
  businessName: "IV Technology",
  addressLine1: "483/A Mahadeniya, Waliwita",
  addressLine2: null as string | null,
  city: "Kaduwela",
  phone: "0771890058",
  // The estimate header prints this without the "@" - corrected here from the
  // terms page, which has it right.
  email: "ivtechnology20@gmail.com",
  website: null as string | null,
  regNo: "WP/COL/KA/2024/00624",
  tagline: "CCTV Sales | Installation | Service",
  // 001253 was the last number issued on paper.
  quoteNextNumber: 1254,
};

const CUSTOMER = {
  phone: "0779457745",
  name: "New customer",
  address: null as string | null,
};

const QUOTE = {
  quoteNo: "001253",
  issueDate: new Date("2026-08-14"),
  validUntilDays: 14,
  billDiscount: { type: "percent" as const, value: 5 },
};

/**
 * The catalog.
 *
 * Only the DVR and the camera carry manufacturer part numbers on the estimate.
 * The rest had no code, so short internal codes are assigned here - itemCode is
 * required and unique, and staff need something to search on.
 *
 * tracksSerials is on for the three items that are individually serialised
 * electronics (DVR, camera, hard disk). Consumables and labour are not tracked.
 */
const ITEMS = [
  {
    itemCode: "DS-7108HGHI-M1",
    name: "Hikvision 2mp 8ch DVR",
    unitPrice: 18500,
    tracksSerials: true,
  },
  {
    itemCode: "PSU-OUT-2A",
    name: "CCTV Outdoor Power Supply 2A",
    unitPrice: 1850,
    tracksSerials: false,
  },
  {
    itemCode: "DS-2CE10DF0T-PFS",
    name: "Hikvision Full Time Colour 20m with Audio",
    unitPrice: 8950,
    tracksSerials: true,
  },
  {
    itemCode: "HDD-1TB",
    name: "1 TB HardDisk",
    unitPrice: 19500,
    tracksSerials: true,
  },
  {
    itemCode: "BALUN-8MP",
    name: "8 MP Video Balun",
    unitPrice: 650,
    tracksSerials: false,
  },
  {
    itemCode: "RACK-3U",
    name: "3U Rack (DVR safety cabin)",
    unitPrice: 3950,
    tracksSerials: false,
  },
  {
    itemCode: "SRV-INSTALL",
    name: "Installation, configuration & 1st Year service warranty",
    unitPrice: 3950,
    tracksSerials: false,
  },
  {
    itemCode: "CBL-CAT6-M",
    name: "Cat 6 Cabling Per Meter",
    unitPrice: 285,
    tracksSerials: false,
  },
  {
    itemCode: "EXT-CORD",
    name: "Extension Cord (normal)",
    unitPrice: 2450,
    tracksSerials: false,
  },
  {
    itemCode: "CBL-NET-3M",
    name: "3m Network cable",
    unitPrice: 950,
    tracksSerials: false,
  },
  {
    itemCode: "PLUG-POINT",
    name: "Plug point",
    unitPrice: 1950,
    tracksSerials: false,
  },
];

/**
 * Serial-tracked stock on hand.
 *
 * Placeholder serials stand in so there is stock to sell; replace them with
 * the actual numbers off the boxes. They are not attached to the quotation -
 * units are picked at invoice time.
 */
const STOCK = [
  {
    itemCode: "DS-2CE10DF0T-PFS",
    serials: Array.from({ length: 10 }, (_, i) => `SN-CAM-${String(i + 1).padStart(4, "0")}`),
  },
  {
    itemCode: "DS-7108HGHI-M1",
    serials: Array.from({ length: 3 }, (_, i) => `SN-DVR-${String(i + 1).padStart(4, "0")}`),
  },
  {
    itemCode: "HDD-1TB",
    serials: Array.from({ length: 3 }, (_, i) => `SN-HDD-${String(i + 1).padStart(4, "0")}`),
  },
];

/**
 * The eleven lines of Estimate 001253, in the printed order.
 * `note` is the blue sub-text under the item name on the original.
 *
 * No serial numbers here: a quotation prices a model and a quantity. The
 * physical units are chosen when the customer confirms and it becomes an
 * invoice.
 */
const LINES = [
  { itemCode: "DS-7108HGHI-M1", quantity: 1, unitPrice: 18500 },
  {
    itemCode: "PSU-OUT-2A",
    quantity: 8,
    unitPrice: 1850,
    note: "3 Months Warranty",
  },
  { itemCode: "DS-2CE10DF0T-PFS", quantity: 8, unitPrice: 8950 },
  { itemCode: "HDD-1TB", quantity: 1, unitPrice: 19500, note: "2years warranty" },
  { itemCode: "BALUN-8MP", quantity: 8, unitPrice: 650 },
  { itemCode: "RACK-3U", quantity: 1, unitPrice: 3950 },
  { itemCode: "SRV-INSTALL", quantity: 8, unitPrice: 3950 },
  {
    itemCode: "CBL-CAT6-M",
    quantity: 60,
    unitPrice: 285,
    note:
      "Cat 6 Full Copper Cable, Casin, Conduit, Flexible Hose all necessary items\n" +
      "Charge per meter (Data cable distance Measure and pay basis)",
  },
  { itemCode: "EXT-CORD", quantity: 1, unitPrice: 2450 },
  { itemCode: "CBL-NET-3M", quantity: 1, unitPrice: 950 },
  {
    itemCode: "PLUG-POINT",
    quantity: 1,
    unitPrice: 1950,
    note: "13A Plug base 01, Sunk Box 01, and Labour Charge",
  },
];

/** Printed on Estimate 001253, for the assertion at the end of the seed. */
const EXPECTED = { subtotal: 187600, discount: 9380, grandTotal: 178220 };

// ===========================================================================
// Seeding logic
// ===========================================================================

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

function logoDataUrl(): string | null {
  const file = path.join(__dirname, "assets", "logo.jpg");
  if (!fs.existsSync(file)) return null;
  return `data:image/jpeg;base64,${fs.readFileSync(file).toString("base64")}`;
}

async function reset() {
  // Order matters: children before parents.
  await prisma.payment.deleteMany();
  await prisma.serialUnit.deleteMany();
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.quoteLine.deleteMany();
  await prisma.quotation.deleteMany();
  await prisma.item.deleteMany();
  await prisma.customer.deleteMany();
}

async function main() {
  await reset();

  const { tagline, ...settingsFields } = SETTINGS;
  const settingsData = {
    ...settingsFields,
    website: tagline, // printed under the business name on the terms page
    defaultTerms: DEFAULT_TERMS,
    logoDataUrl: logoDataUrl(),
  };
  await prisma.settings.upsert({
    where: { id: SETTINGS_ID },
    update: settingsData,
    create: { id: SETTINGS_ID, ...settingsData },
  });

  const customer = await prisma.customer.create({ data: CUSTOMER });

  const itemsByCode = new Map<string, { id: number; tracksSerials: boolean }>();
  for (const item of ITEMS) {
    const created = await prisma.item.create({
      data: {
        itemCode: item.itemCode,
        name: item.name,
        barcode: null,
        unitPrice: toCents(item.unitPrice),
        tracksSerials: item.tracksSerials,
      },
    });
    itemsByCode.set(created.itemCode, {
      id: created.id,
      tracksSerials: created.tracksSerials,
    });
  }

  for (const group of STOCK) {
    const item = itemsByCode.get(group.itemCode);
    if (!item) throw new Error(`STOCK references unknown itemCode ${group.itemCode}`);
    await prisma.serialUnit.createMany({
      data: group.serials.map((serialNumber) => ({
        serialNumber,
        itemId: item.id,
        status: "in_stock",
      })),
    });
  }

  const quotation = await prisma.quotation.create({
    data: {
      quoteNo: QUOTE.quoteNo,
      customerId: customer.id,
      issueDate: QUOTE.issueDate,
      validUntil: addDays(QUOTE.issueDate, QUOTE.validUntilDays),
      status: "sent",
      billDiscountType: "percent",
      // 5% -> 500 basis points
      billDiscountValue: Math.round(QUOTE.billDiscount.value * 100),
      termsText: DEFAULT_TERMS,
    },
  });

  for (let index = 0; index < LINES.length; index++) {
    const line = LINES[index];
    const item = itemsByCode.get(line.itemCode);
    if (!item) throw new Error(`LINES references unknown itemCode ${line.itemCode}`);

    await prisma.quoteLine.create({
      data: {
        quotationId: quotation.id,
        itemId: item.id,
        unitPrice: toCents(line.unitPrice),
        quantity: line.quantity,
        lineDiscountType: "fixed",
        lineDiscountValue: 0,
        note: "note" in line ? line.note : null,
        sortOrder: index,
      },
    });

  }

  await report(quotation.id);
}

/** Print the seeded estimate and check it against the printed original. */
async function report(quotationId: number) {
  const quotation = await prisma.quotation.findUniqueOrThrow({
    where: { id: quotationId },
    include: {
      customer: true,
      lines: {
        include: { item: true, serialUnits: true },
        orderBy: { sortOrder: "asc" },
      },
    },
  });

  const totals = billTotals({
    lines: quotation.lines,
    billDiscountType: quotation.billDiscountType,
    billDiscountValue: quotation.billDiscountValue,
  });

  const out: string[] = [""];
  out.push(`ESTIMATE ${quotation.quoteNo}   issued ${quotation.issueDate.toDateString()}`);
  out.push(`Bill to: ${quotation.customer.name} - ${quotation.customer.phone}`);
  out.push("-".repeat(84));
  for (const line of quotation.lines) {
    out.push(
      line.item.name.slice(0, 46).padEnd(47) +
        formatLKR(line.unitPrice).padStart(16) +
        String(line.quantity).padStart(5) +
        formatLKR(line.unitPrice * line.quantity).padStart(16),
    );
  }
  out.push("-".repeat(84));
  out.push(`Subtotal${formatLKR(totals.subtotal).padStart(76 - 8)}`);
  out.push(`Discount (5%)${formatLKR(totals.billDiscount).padStart(76 - 13)}`);
  out.push(`Grand total${formatLKR(totals.total).padStart(76 - 11)}`);
  out.push("");

  const checks: [string, number, number][] = [
    ["subtotal", totals.subtotal, toCents(EXPECTED.subtotal)],
    ["discount", totals.billDiscount, toCents(EXPECTED.discount)],
    ["grand total", totals.total, toCents(EXPECTED.grandTotal)],
  ];
  let failed = 0;
  for (const [label, actual, expected] of checks) {
    const ok = actual === expected;
    if (!ok) failed++;
    out.push(
      `${ok ? "OK  " : "FAIL"} ${label}: ${formatLKR(actual)}` +
        (ok ? "" : `  (printed estimate says ${formatLKR(expected)})`),
    );
  }

  const inStock = await prisma.serialUnit.count({ where: { status: "in_stock" } });
  const sold = await prisma.serialUnit.count({ where: { status: "sold" } });
  out.push("");
  out.push(`Serial units: ${inStock} in stock, ${sold} sold`);
  out.push("(a quotation reserves nothing - units are picked when it is invoiced)");
  console.log(out.join("\n"));

  if (failed > 0) throw new Error(`${failed} total(s) do not match Estimate 001253`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
