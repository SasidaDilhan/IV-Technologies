"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { createQuotation } from "@/lib/quotations";
import { normalisePhone, str, uniqueFieldError } from "@/lib/validation";
import type { QuotationPayload, SaveResult } from "./types";

export interface CustomerResult {
  ok: boolean;
  error?: string;
  customer?: { id: number; name: string; phone: string; address: string | null };
}

/**
 * Create a customer from the inline "no match" form on the billing screen.
 * Returns the created record so the screen can select it without a round trip.
 */
export async function createCustomer(form: FormData): Promise<CustomerResult> {
  const name = str(form, "name");
  const phone = str(form, "phone");
  const address = str(form, "address");

  if (!name) return { ok: false, error: "Name is required." };
  if (!phone) return { ok: false, error: "Phone number is required." };

  const digits = normalisePhone(phone);
  if (digits.length < 7) return { ok: false, error: "That phone number looks too short." };

  try {
    const customer = await prisma.customer.create({
      data: { name, phone: digits, address: address || null },
    });
    revalidatePath("/quotations");
    return { ok: true, customer };
  } catch (error) {
    const mapped = uniqueFieldError(error, {
      phone: "A customer with this phone number already exists.",
    });
    if (mapped) return { ok: false, error: Object.values(mapped)[0] };
    throw error;
  }
}

/** Thin wrapper: the real work lives in lib/quotations so it stays testable. */
export async function saveQuotation(payload: QuotationPayload): Promise<SaveResult> {
  const result = await createQuotation(payload);

  if (result.ok) {
    revalidatePath("/quotations");
    revalidatePath("/items");
    revalidatePath("/stock");
  }

  return result;
}
