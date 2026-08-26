import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Units available to put on a bill: in stock and not already reserved against
 * another quotation. Excluding reserved units is what stops the same physical
 * camera being promised to two customers.
 *
 * `forQuotation` is passed when reopening an existing quotation - that quote's
 * own reservations must stay selectable, or removing a line would make its
 * units impossible to add back.
 */
export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  const itemId = Number(params.id);
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Bad item id" }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const forQuotation = Number(searchParams.get("forQuotation"));
  const ownReservation =
    Number.isInteger(forQuotation) && forQuotation > 0
      ? { quoteLine: { quotationId: forQuotation } }
      : null;

  const serials = await prisma.serialUnit.findMany({
    where: {
      itemId,
      status: "in_stock",
      invoiceLineId: null,
      ...(ownReservation
        ? { OR: [{ quoteLineId: null }, ownReservation] }
        : { quoteLineId: null }),
    },
    orderBy: { serialNumber: "asc" },
    select: { id: true, serialNumber: true },
  });

  return NextResponse.json({ serials });
}
