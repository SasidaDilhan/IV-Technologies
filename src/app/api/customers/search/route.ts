import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { normalisePhone } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Customer lookup for the billing screen.
 *
 * Phone is the key - it is unique and it is what staff usually have - but a
 * walk-in often gives a name first, so both are matched from the same box.
 * Phone numbers are normalised, so "+94 77 945 7745" and "077 945 7745" find
 * the same record.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("q") ?? "").trim();
  if (raw.length < 2) {
    return NextResponse.json({ customers: [], tooShort: true });
  }

  const digits = normalisePhone(raw);
  const looksLikePhone = /\d/.test(raw);

  const customers = await prisma.customer.findMany({
    where: {
      OR: [
        { name: { contains: raw } },
        ...(looksLikePhone && digits.length >= 3
          ? [{ phone: { contains: digits } }]
          : []),
      ],
    },
    orderBy: { name: "asc" },
    take: 8,
    select: { id: true, name: true, phone: true, address: true },
  });

  return NextResponse.json({ customers, tooShort: false });
}
