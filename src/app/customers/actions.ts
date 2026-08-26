"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { normalisePhone, str, uniqueFieldError } from "@/lib/validation";
import type { CustomerFormState } from "./form-state";

export async function updateCustomer(
  id: number,
  _prev: CustomerFormState,
  form: FormData,
): Promise<CustomerFormState> {
  const name = str(form, "name");
  const phone = normalisePhone(str(form, "phone"));
  const address = str(form, "address");

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Name is required.";
  if (!phone) errors.phone = "Phone number is required.";
  else if (phone.length < 7) errors.phone = "That phone number looks too short.";
  if (Object.keys(errors).length > 0) return { errors };

  try {
    await prisma.customer.update({
      where: { id },
      data: { name, phone, address: address || null },
    });
  } catch (error) {
    const mapped = uniqueFieldError(error, {
      phone: "Another customer already uses this phone number.",
    });
    if (mapped) return { errors: mapped };
    throw error;
  }

  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(`/customers/${id}`);
}
