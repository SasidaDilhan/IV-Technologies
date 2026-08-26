import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { normaliseSerial } from "@/lib/validation";

export const dynamic = "force-dynamic";

const serialSelect = {
  id: true,
  serialNumber: true,
  status: true,
  quoteLineId: true,
  invoiceLineId: true,
  item: {
    select: {
      id: true,
      itemCode: true,
      name: true,
      barcode: true,
      unitPrice: true,
      tracksSerials: true,
    },
  },
} as const;

type SerialRow = {
  id: number;
  serialNumber: string;
  status: string;
  quoteLineId: number | null;
  invoiceLineId: number | null;
  item: {
    id: number;
    itemCode: string;
    name: string;
    barcode: string | null;
    unitPrice: number;
    tracksSerials: boolean;
  };
};

/** Why a unit cannot go on a bill, or null when it is free to sell. */
function unavailableReason(s: SerialRow): string | null {
  if (s.invoiceLineId) return "already sold";
  if (s.status !== "in_stock") return `marked ${s.status}`;
  if (s.quoteLineId) return "reserved on another quotation";
  return null;
}

function shapeSerial(s: SerialRow) {
  const reason = unavailableReason(s);
  return {
    id: s.id,
    serialNumber: s.serialNumber,
    available: reason === null,
    reason,
    item: s.item,
  };
}

/**
 * Lookup for the add-item panel.
 *
 * Matches four ways, because all four are things staff actually do:
 *   - item name / item code   (typed)
 *   - item barcode            (scanned off a shelf label)
 *   - serial number           (scanned off the unit's own sticker)
 *
 * A serial is unique to one physical unit, so an exact serial match resolves
 * to both the catalog item AND the specific unit going on the bill - that is
 * what lets the operator scan a camera and have it land on the estimate.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ items: [], serial: null, serialHits: [], tooShort: true });
  }

  // Serials are stored normalised (upper case, no spaces); match the query the
  // same way so a scanner's stray whitespace or lower case still hits.
  const normalised = normaliseSerial(q);

  const [items, exact, partial] = await Promise.all([
    prisma.item.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { itemCode: { contains: q } },
          { barcode: { contains: q } },
        ],
      },
      orderBy: { itemCode: "asc" },
      take: 10,
      include: {
        _count: {
          select: {
            serialUnits: {
              where: { status: "in_stock", quoteLineId: null, invoiceLineId: null },
            },
          },
        },
      },
    }),
    prisma.serialUnit.findUnique({
      where: { serialNumber: normalised },
      select: serialSelect,
    }),
    prisma.serialUnit.findMany({
      where: { serialNumber: { contains: normalised } },
      orderBy: { serialNumber: "asc" },
      take: 6,
      select: serialSelect,
    }),
  ]);

  return NextResponse.json({
    tooShort: false,
    items: items.map((item) => ({
      id: item.id,
      itemCode: item.itemCode,
      name: item.name,
      barcode: item.barcode,
      unitPrice: item.unitPrice,
      tracksSerials: item.tracksSerials,
      available: item._count.serialUnits,
    })),
    serial: exact ? shapeSerial(exact) : null,
    serialHits: partial
      .filter((s) => s.serialNumber !== normalised)
      .map(shapeSerial),
  });
}
