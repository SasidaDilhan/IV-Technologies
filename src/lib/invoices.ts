import { prisma } from "@/lib/prisma";
import { billTotals } from "@/lib/money";
import { getSettings, nextInvoiceNo } from "@/lib/settings";

export interface ConvertInput {
  quotationId: number;
  /** Cents taken at confirmation. May be 0. */
  advanceAmount: number;
  /** "cash" | "card" | "bank_transfer" | "cheque" */
  advanceMethod: string;
  advanceReference?: string;
  issueDate: string;
  /** Days until the balance is due; 0 means no due date. */
  dueDays: number;
}

export interface ConvertResult {
  ok: boolean;
  error?: string;
  invoiceId?: number;
  invoiceNo?: string;
}

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "card", label: "Card" },
];

function parseDate(value: string, label: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`${label} is not a valid date.`);
  return d;
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

/**
 * Confirm a quotation into an invoice.
 *
 * This is the moment the goods are committed: the units reserved on the quote
 * become sold, and the customer owes money. It all happens in one transaction
 * because a half-converted quote - an invoice whose units are still in stock,
 * or sold units with no invoice - is a stock count nobody can reconcile.
 *
 * The advance is recorded as the first Payment rather than as a separate
 * amount, so there is exactly one ledger of money received and its method and
 * date are captured like any other payment.
 */
export async function convertToInvoice(
  input: ConvertInput,
): Promise<ConvertResult> {
  let issueDate: Date;
  try {
    issueDate = parseDate(input.issueDate, "Issue date");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (input.advanceAmount < 0) {
    return { ok: false, error: "Advance cannot be negative." };
  }

  await getSettings();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.findUnique({
        where: { id: input.quotationId },
        include: {
          invoice: true,
          lines: {
            orderBy: { sortOrder: "asc" },
            include: { item: true, serialUnits: true },
          },
        },
      });

      if (!quotation) throw new Error("That quotation no longer exists.");
      if (quotation.invoice) {
        throw new Error(
          `This quotation was already invoiced as ${quotation.invoice.invoiceNo}.`,
        );
      }
      if (quotation.lines.length === 0) {
        throw new Error("This quotation has no lines to invoice.");
      }

      const totals = billTotals({
        lines: quotation.lines,
        billDiscountType: quotation.billDiscountType,
        billDiscountValue: quotation.billDiscountValue,
      });
      if (input.advanceAmount > totals.total) {
        throw new Error("The advance is more than the bill total.");
      }

      const invoiceNo = await nextInvoiceNo(tx);

      const invoice = await tx.invoice.create({
        data: {
          invoiceNo,
          customerId: quotation.customerId,
          quotationId: quotation.id,
          issueDate,
          dueDate: input.dueDays > 0 ? addDays(issueDate, input.dueDays) : null,
          status: "issued",
          billDiscountType: quotation.billDiscountType,
          billDiscountValue: quotation.billDiscountValue,
          // The advance lives in the payment ledger, not here, so the two can
          // never disagree about how much has been received.
          advanceAmount: 0,
          termsText: quotation.termsText,
        },
      });

      for (const line of quotation.lines) {
        const invoiceLine = await tx.invoiceLine.create({
          data: {
            invoiceId: invoice.id,
            itemId: line.itemId,
            unitPrice: line.unitPrice,
            quantity: line.quantity,
            lineDiscountType: line.lineDiscountType,
            lineDiscountValue: line.lineDiscountValue,
            note: line.note,
            sortOrder: line.sortOrder,
          },
        });

        if (line.serialUnits.length > 0) {
          // The quoteLine link is deliberately left in place: it is the record
          // that this quotation reserved these units. Only the sale is added.
          const sold = await tx.serialUnit.updateMany({
            where: {
              id: { in: line.serialUnits.map((s) => s.id) },
              status: "in_stock",
              invoiceLineId: null,
            },
            data: { invoiceLineId: invoiceLine.id, status: "sold" },
          });

          if (sold.count !== line.serialUnits.length) {
            throw new Error(
              `Some units for ${line.item.itemCode} are no longer in stock. ` +
                `Reopen the quotation and reselect them.`,
            );
          }
        }
      }

      if (input.advanceAmount > 0) {
        await tx.payment.create({
          data: {
            invoiceId: invoice.id,
            amount: input.advanceAmount,
            method: input.advanceMethod,
            paidAt: issueDate,
            reference: input.advanceReference || null,
            note: "Advance on confirmation",
          },
        });
      }

      await tx.quotation.update({
        where: { id: quotation.id },
        data: { status: "confirmed" },
      });

      return { id: invoice.id, invoiceNo };
    });

    return { ok: true, invoiceId: result.id, invoiceNo: result.invoiceNo };
  } catch (error) {
    return { ok: false, error: (error as Error).message ?? "Could not confirm." };
  }
}

export interface PaymentInput {
  invoiceId: number;
  amount: number;
  method: string;
  paidAt: string;
  reference?: string;
}

/** Log a payment received against an invoice. */
export async function addPayment(
  input: PaymentInput,
): Promise<{ ok: boolean; error?: string }> {
  if (input.amount <= 0) return { ok: false, error: "Enter an amount." };

  let paidAt: Date;
  try {
    paidAt = parseDate(input.paidAt, "Payment date");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    include: { lines: true, payments: true },
  });
  if (!invoice) return { ok: false, error: "Invoice not found." };

  const totals = billTotals({
    lines: invoice.lines,
    billDiscountType: invoice.billDiscountType,
    billDiscountValue: invoice.billDiscountValue,
    advanceAmount: invoice.advanceAmount,
    payments: invoice.payments,
  });

  if (input.amount > totals.balanceDue) {
    return {
      ok: false,
      error: "That is more than the outstanding balance.",
    };
  }

  await prisma.payment.create({
    data: {
      invoiceId: invoice.id,
      amount: input.amount,
      method: input.method,
      paidAt,
      reference: input.reference || null,
    },
  });

  return { ok: true };
}

/** Remove a payment logged in error. */
export async function deletePayment(
  id: number,
): Promise<{ ok: boolean; error?: string }> {
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return { ok: false, error: "Payment not found." };
  await prisma.payment.delete({ where: { id } });
  return { ok: true };
}

/**
 * Settlement state, derived from the payment ledger rather than stored.
 * A stored flag would go stale the moment a payment was logged or removed.
 */
export function settlementOf(balanceDue: number, paid: number) {
  if (balanceDue <= 0) return { label: "paid", settled: true };
  if (paid > 0) return { label: "part paid", settled: false };
  return { label: "unpaid", settled: false };
}
