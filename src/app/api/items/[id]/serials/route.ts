import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Units available to sell: in stock and not already on an invoice.
 *
 * Quotations do not reserve stock - they price a model and a quantity - so the
 * only thing that removes a unit from this list is having been sold.
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
    where: { itemId, status: "in_stock", invoiceLineId: null },
    orderBy: { serialNumber: "asc" },
    select: { id: true, serialNumber: true },
  });

  return NextResponse.json({ serials });
}
