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

/**
 * Transactional core of "save a quotation".
 *
 * Kept out of the server action so it can be exercised directly - the action
 * is only a thin wrapper that adds cache revalidation. Everything here runs in
 * one transaction: a half-written quote (lines without their serials, or a
 * burnt quote number with no document) is worse than a failure the operator
 * can retry.
 */
export async function createQuotation(
  payload: QuotationPayload,
): Promise<CreateResult> {
  if (!payload.customerId) return { ok: false, error: "Select a customer first." };
  if (payload.lines.length === 0) return { ok: false, error: "Add at least one item." };

  let issueDate: Date;
  let validUntil: Date;
  try {
    issueDate = parseDate(payload.issueDate, "Issue date");
    validUntil = parseDate(payload.validUntil, "Valid until");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (validUntil < issueDate) {
    return { ok: false, error: "Valid until cannot be before the issue date." };
  }

  // Make sure the settings row exists before the transaction increments it.
  await getSettings();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: payload.customerId },
      });
      if (!customer) throw new Error("That customer no longer exists.");

      const quoteNo = await nextQuoteNo(tx);

      const quotation = await tx.quotation.create({
        data: {
          quoteNo,
          customerId: payload.customerId,
          issueDate,
          validUntil,
          status: "draft",
          billDiscountType: payload.billDiscountType,
          billDiscountValue: payload.billDiscountValue,
          termsText: payload.termsText,
        },
      });

      for (let i = 0; i < payload.lines.length; i++) {
        const line = payload.lines[i];

        const item = await tx.item.findUnique({ where: { id: line.itemId } });
        if (!item) throw new Error(`Item ${line.itemId} no longer exists.`);

        // Quantity is authoritative from the serial selection for tracked
        // items. Trusting the client's number here is what would let the
        // printed quantity drift from the units actually reserved.
        const quantity = item.tracksSerials ? line.serialIds.length : line.quantity;

        if (item.tracksSerials && quantity === 0) {
          throw new Error(`Select at least one serial number for ${item.itemCode}.`);
        }
        if (quantity <= 0) {
          throw new Error(`Quantity for ${item.itemCode} must be at least 1.`);
        }
        if (line.unitPrice < 0) {
          throw new Error(`Unit price for ${item.itemCode} cannot be negative.`);
        }

        const quoteLine = await tx.quoteLine.create({
          data: {
            quotationId: quotation.id,
            itemId: item.id,
            unitPrice: line.unitPrice,
            quantity,
            lineDiscountType: line.discountType,
            lineDiscountValue: line.discountValue,
            note: line.note || null,
            sortOrder: i,
          },
        });

        if (item.tracksSerials) {
          // Re-check inside the transaction: the picker's list was fetched
          // earlier, and another operator may have reserved a unit since.
          const claimed = await tx.serialUnit.updateMany({
            where: {
              id: { in: line.serialIds },
              itemId: item.id,
              status: "in_stock",
              quoteLineId: null,
              invoiceLineId: null,
            },
            data: { quoteLineId: quoteLine.id },
          });

          if (claimed.count !== line.serialIds.length) {
            throw new Error(
              `Some serial numbers for ${item.itemCode} were taken by another ` +
                `bill while this one was open. Reopen the picker and choose again.`,
            );
          }
        }
      }

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
