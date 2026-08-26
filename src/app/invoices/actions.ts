"use server";

import { revalidatePath } from "next/cache";

import {
  addPayment as addPaymentCore,
  convertToInvoice as convertCore,
  deletePayment as deletePaymentCore,
  type ConvertInput,
  type ConvertResult,
  type PaymentInput,
} from "@/lib/invoices";

/** Thin wrappers: the real work lives in lib/invoices so it stays testable. */

export async function confirmQuotation(
  input: ConvertInput,
): Promise<ConvertResult> {
  const result = await convertCore(input);
  if (result.ok) {
    revalidatePath("/invoices");
    revalidatePath("/quotations");
    revalidatePath(`/quotations/${input.quotationId}`);
    revalidatePath("/items");
    revalidatePath("/stock");
  }
  return result;
}

export async function logPayment(input: PaymentInput) {
  const result = await addPaymentCore(input);
  if (result.ok) {
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${input.invoiceId}`);
  }
  return result;
}

export async function removePayment(id: number, invoiceId: number) {
  const result = await deletePaymentCore(id);
  if (result.ok) {
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${invoiceId}`);
  }
  return result;
}
