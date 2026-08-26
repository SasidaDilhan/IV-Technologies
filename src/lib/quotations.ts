import { prisma } from "@/lib/prisma";
import { getSettings, nextQuoteNo } from "@/lib/settings";
import type { QuotationPayload } from "@/app/quotations/types";

export interface CreateResult {
  ok: boolean;
  error?: string;
  quotationId?: number;
  quoteNo?: string;
}

function parseDate(value: string, label: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`${label} is not a valid date.`);
  return d;
}

/** Shared validation for the line list of a new or revised quotation. */
async function validatedLines(
  tx: Pick<typeof prisma, "item">,
  payload: QuotationPayload,
) {
  const out: {
    itemId: number;
    unitPrice: number;
    quantity: number;
    lineDiscountType: string;
    lineDiscountValue: number;
    note: string | null;
    sortOrder: number;
  }[] = [];

  for (let i = 0; i < payload.lines.length; i++) {
    const line = payload.lines[i];
    const item = await tx.item.findUnique({ where: { id: line.itemId } });
    if (!item) throw new Error(`Item ${line.itemId} no longer exists.`);

    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      throw new Error(`Quantity for ${item.itemCode} must be at least 1.`);
    }
    if (line.unitPrice < 0) {
      throw new Error(`Unit price for ${item.itemCode} cannot be negative.`);
    }

    out.push({
      itemId: item.id,
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      lineDiscountType: line.discountType,
      lineDiscountValue: line.discountValue,
      note: line.note || null,
      sortOrder: i,
    });
  }

  return out;
}

function checkDates(payload: QuotationPayload) {
  const issueDate = parseDate(payload.issueDate, "Issue date");
  const validUntil = parseDate(payload.validUntil, "Valid until");
  if (validUntil < issueDate) {
    throw new Error("Valid until cannot be before the issue date.");
  }
  return { issueDate, validUntil };
}

/**
 * Transactional core of "save a quotation".
 *
 * A quotation prices a MODEL and a quantity - it does not reserve stock. The
 * physical units are chosen when the customer confirms and the quote becomes
 * an invoice, which is the point the goods actually leave the shop.
 *
 * Kept out of the server action so it can be exercised directly; the action is
 * only a thin wrapper that adds cache revalidation.
 */
export async function createQuotation(
  payload: QuotationPayload,
): Promise<CreateResult> {
  if (!payload.customerId) return { ok: false, error: "Select a customer first." };
  if (payload.lines.length === 0) return { ok: false, error: "Add at least one item." };

  let dates: { issueDate: Date; validUntil: Date };
  try {
    dates = checkDates(payload);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  // Make sure the settings row exists before the transaction increments it.
  await getSettings();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: payload.customerId },
      });
      if (!customer) throw new Error("That customer no longer exists.");

      const lines = await validatedLines(tx, payload);
      const quoteNo = await nextQuoteNo(tx);

      const quotation = await tx.quotation.create({
        data: {
          quoteNo,
          customerId: payload.customerId,
          issueDate: dates.issueDate,
          validUntil: dates.validUntil,
          status: "draft",
          billDiscountType: payload.billDiscountType,
          billDiscountValue: payload.billDiscountValue,
          termsText: payload.termsText,
          extraTerms: payload.extraTerms || null,
          lines: { create: lines },
        },
      });

      return { id: quotation.id, quoteNo };
    });

    return { ok: true, quotationId: result.id, quoteNo: result.quoteNo };
  } catch (error) {
    return {
      ok: false,
      error: (error as Error).message ?? "Could not save the quotation.",
    };
  }
}

/**
 * Re-save an existing quotation over the same record.
 *
 * Lines are replaced wholesale rather than diffed: a bill is small, and with
 * no stock reserved at this stage there is nothing to release. The quote
 * number never changes.
 */
export async function updateQuotation(
  id: number,
  payload: QuotationPayload,
): Promise<CreateResult> {
  if (!payload.customerId) return { ok: false, error: "Select a customer first." };
  if (payload.lines.length === 0) return { ok: false, error: "Add at least one item." };

  let dates: { issueDate: Date; validUntil: Date };
  try {
    dates = checkDates(payload);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.quotation.findUnique({
        where: { id },
        include: { invoice: true },
      });
      if (!existing) throw new Error("That quotation no longer exists.");
      if (existing.invoice) {
        throw new Error(
          `This quotation was already invoiced as ${existing.invoice.invoiceNo} ` +
            `and can no longer be edited.`,
        );
      }

      const lines = await validatedLines(tx, payload);

      await tx.quoteLine.deleteMany({ where: { quotationId: id } });
      await tx.quotation.update({
        where: { id },
        data: {
          customerId: payload.customerId,
          issueDate: dates.issueDate,
          validUntil: dates.validUntil,
          billDiscountType: payload.billDiscountType,
          billDiscountValue: payload.billDiscountValue,
          termsText: payload.termsText,
          extraTerms: payload.extraTerms || null,
          lines: { create: lines },
        },
      });

      return { id, quoteNo: existing.quoteNo };
    });

    return { ok: true, quotationId: result.id, quoteNo: result.quoteNo };
  } catch (error) {
    return {
      ok: false,
      error: (error as Error).message ?? "Could not save the quotation.",
    };
  }
}
