"use server";

import { revalidatePath } from "next/cache";

import {
  addPayment as addPaymentCore,
  convertToInvoice as convertCore,
  deletePayment as deletePaymentCore,
  reviseInvoice as reviseInvoiceCore,
  type RevisionPayload,
  type ConvertInput,
  type ConvertResult,
  type PaymentInput,
} from "@/lib/invoices";
import {
  createReturn,
  undoReturn,
  type ReturnInput,
  type ReturnResult,
} from "@/lib/returns";

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

/** Replace an issued invoice with a new revision (<original>-1, -2 ...). */
export async function reviseInvoiceAction(
  previousId: number,
  payload: RevisionPayload,
): Promise<ConvertResult> {
  const result = await reviseInvoiceCore(previousId, payload);
  if (result.ok) {
    revalidatePath("/invoices");
    revalidatePath(`/invoices/${previousId}`);
    revalidatePath("/quotations");
    revalidatePath("/items");
    revalidatePath("/stock");
  }
  return result;
}

function revalidateAfterReturn(invoiceId: number) {
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/items");
  revalidatePath("/stock");
  revalidatePath("/dashboard");
  revalidatePath("/customers");
}

/** Record goods brought back against an invoice (see lib/returns). */
export async function createReturnAction(input: ReturnInput): Promise<ReturnResult> {
  const result = await createReturn(input);
  if (result.ok) revalidateAfterReturn(input.invoiceId);
  return result;
}

/** Undo the latest return on an invoice, entered by mistake. */
export async function undoReturnAction(returnId: number, invoiceId: number) {
  const result = await undoReturn(returnId);
  if (result.ok) revalidateAfterReturn(invoiceId);
  return result;
}
