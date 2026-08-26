import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { normalisePhone } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * Phone-first customer lookup for the billing screen.
 * Digits are stripped from the query so "077 123 4567" and "0771234567"
 * both find the same record.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("q") ?? "").trim();
  const digits = normalisePhone(raw);

  if (digits.length < 3) {
    return NextResponse.json({ customers: [], tooShort: true });
  }

  const customers = await prisma.customer.findMany({
    where: { phone: { contains: digits } },
    orderBy: { phone: "asc" },
    take: 8,
    select: { id: true, name: true, phone: true, address: true },
  });

  return NextResponse.json({ customers, tooShort: false });
}
