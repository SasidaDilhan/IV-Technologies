import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Units available to put on a bill: in stock and not already reserved against
 * another quotation. Excluding reserved units is what stops the same physical
 * camera being promised to two customers.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const itemId = Number(params.id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Bad item id" }, { status: 400 });
  }

  const serials = await prisma.serialUnit.findMany({
    where: {
      itemId,
      status: "in_stock",
      quoteLineId: null,
      invoiceLineId: null,
    },
    orderBy: { serialNumber: "asc" },
    select: { id: true, serialNumber: true },
  });

  return NextResponse.json({ serials });
}
