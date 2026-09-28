import { prisma } from "@/lib/prisma";
import { billTotals } from "@/lib/money";
import { getSettings, nextInvoiceNo } from "@/lib/settings";

/** Which physical units go out against one line of the quotation. */
export interface LineSerials {
  quoteLineId: number;
  serialIds: number[];
}

export interface ConvertInput {
  quotationId: number;
  /** One entry per serial-tracked line. Untracked lines need no entry. */
  serials: LineSerials[];
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

export { PAYMENT_METHODS } from "@/lib/payment-methods";

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
 * This is where the physical units are chosen. A quotation only priced a model
 * and a quantity; the customer has now agreed, so the specific serial numbers
 * leaving the shop are picked here and marked sold.
 *
 * It all runs in one transaction because a half-converted quote - an invoice
 * whose units are still in stock, or sold units with no invoice - is a stock
 * count nobody can reconcile.
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

  const chosen = new Map(input.serials.map((s) => [s.quoteLineId, s.serialIds]));

  try {
    const result = await prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.findUnique({
        where: { id: input.quotationId },
        include: {
          invoice: true,
          lines: { orderBy: { sortOrder: "asc" }, include: { item: true } },
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
          extraTerms: quotation.extraTerms,
        },
      });

      for (const line of quotation.lines) {
        const invoiceLine = await tx.invoiceLine.create({
          data: {
            invoiceId: invoice.id,
            itemId: line.itemId,
            unitPrice: line.unitPrice,
            // The quotation's snapshot carries over, so the invoice margin is
            // measured against what the goods cost when the job was priced.
            costPrice: line.costPrice,
            quantity: line.quantity,
            lineDiscountType: line.lineDiscountType,
            lineDiscountValue: line.lineDiscountValue,
            note: line.note,
            sortOrder: line.sortOrder,
          },
        });

        if (!line.item.tracksSerials) continue;

        const serialIds = chosen.get(line.id) ?? [];
        if (serialIds.length !== line.quantity) {
          throw new Error(
            `${line.item.itemCode}: pick exactly ${line.quantity} serial ` +
              `number${line.quantity === 1 ? "" : "s"} ` +
              `(${serialIds.length} selected).`,
          );
        }

        // Claim inside the transaction: the picker's list was fetched earlier
        // and another sale may have taken a unit since.
        const sold = await tx.serialUnit.updateMany({
          where: {
            id: { in: serialIds },
            itemId: line.itemId,
            status: "in_stock",
            invoiceLineId: null,
          },
          data: { invoiceLineId: invoiceLine.id, status: "sold" },
        });

        if (sold.count !== serialIds.length) {
          throw new Error(
            `Some units for ${line.item.itemCode} were sold on another bill ` +
              `while this one was open. Reopen the picker and choose again.`,
          );
        }
      }

      await tx.quotation.update({
        where: { id: quotation.id },
        data: { status: "confirmed" },
      });

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
  if (invoice.supersededAt) {
    return {
      ok: false,
      error: "This invoice was revised. Record the payment on the latest revision.",
    };
  }

  const totals = billTotals({
    lines: invoice.lines,
    billDiscountType: invoice.billDiscountType,
    billDiscountValue: invoice.billDiscountValue,
    advanceAmount: invoice.advanceAmount,
    payments: invoice.payments,
  });

  if (input.amount > totals.balanceDue) {
    return { ok: false, error: "That is more than the outstanding balance." };
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

// ---------------------------------------------------------------------------
// Revisions
// ---------------------------------------------------------------------------

export interface RevisionLine {
  itemId: number;
  unitPrice: number;
  costPrice: number;
  quantity: number;
  discountType: string;
  discountValue: number;
  note: string;
  /** Required, and must match quantity, for serial-tracked items. */
  serialIds: number[];
}

export interface RevisionPayload {
  customerId: number;
  issueDate: string;
  billDiscountType: string;
  billDiscountValue: number;
  termsText: string;
  extraTerms: string;
  lines: RevisionLine[];
}

/** "INV-000001" + 2 -> "INV-000001-2". */
export function revisionNumber(baseNo: string, revisionNo: number): string {
  return `${baseNo}-${revisionNo}`;
}

/**
 * Replace an issued invoice with a new revision.
 *
 * The old invoice is not edited. Its lines, prices and totals stay exactly as
 * they were issued; it is only marked superseded. The new invoice takes the
 * original number with a revision suffix - INV-000001-1, then -2 - so the
 * chain reads naturally on paper.
 *
 * Two things have to move rather than be copied:
 *  - Serial units, because a physical unit can belong to only one live bill.
 *    Before they move, each old line records its serial numbers as text, so
 *    the superseded invoice still shows which units it listed.
 *  - Payments, because the customer paid against the job, and the job's live
 *    bill is now the new revision. Each moved payment keeps the id of the
 *    invoice it was first recorded against.
 *
 * All of it runs in one transaction.
 */
export async function reviseInvoice(
  previousId: number,
  payload: RevisionPayload,
): Promise<ConvertResult> {
  if (!payload.customerId) return { ok: false, error: "Select a customer first." };
  if (payload.lines.length === 0) return { ok: false, error: "Add at least one item." };

  let issueDate: Date;
  try {
    issueDate = parseDate(payload.issueDate, "Issue date");
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const previous = await tx.invoice.findUnique({
        where: { id: previousId },
        include: { lines: { include: { serialUnits: true } } },
      });
      if (!previous) throw new Error("That invoice no longer exists.");
      if (previous.supersededAt || previous.status === "superseded") {
        throw new Error(
          "This invoice has already been revised. Edit the latest revision instead.",
        );
      }

      const customer = await tx.customer.findUnique({ where: { id: payload.customerId } });
      if (!customer) throw new Error("That customer no longer exists.");

      // Number the revision from the original, not from the previous one.
      const rootId = previous.rootInvoiceId ?? previous.id;
      const root = await tx.invoice.findUniqueOrThrow({ where: { id: rootId } });
      const chain = await tx.invoice.findMany({
        where: { OR: [{ id: rootId }, { rootInvoiceId: rootId }] },
        select: { revisionNo: true },
      });
      const nextRevision =
        chain.reduce((max, inv) => Math.max(max, inv.revisionNo ?? 0), 0) + 1;
      const invoiceNo = revisionNumber(root.invoiceNo, nextRevision);

      const clash = await tx.invoice.findUnique({ where: { invoiceNo } });
      if (clash) throw new Error(`${invoiceNo} already exists.`);

      // Validate every line before anything is written.
      const items = new Map<number, { itemCode: string; tracksSerials: boolean }>();
      for (const line of payload.lines) {
        const item = await tx.item.findUnique({ where: { id: line.itemId } });
        if (!item) throw new Error(`Item ${line.itemId} no longer exists.`);
        items.set(item.id, item);
        if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
          throw new Error(`Quantity for ${item.itemCode} must be at least 1.`);
        }
        if (line.unitPrice < 0 || line.costPrice < 0) {
          throw new Error(`Prices for ${item.itemCode} cannot be negative.`);
        }
        if (item.tracksSerials && line.serialIds.length !== line.quantity) {
          throw new Error(
            `${item.itemCode}: pick exactly ${line.quantity} serial ` +
              `number${line.quantity === 1 ? "" : "s"} ` +
              `(${line.serialIds.length} selected).`,
          );
        }
      }

      // 1. Old lines keep a written record of their units, then let them go.
      for (const line of previous.lines) {
        if (line.serialUnits.length === 0) continue;
        await tx.invoiceLine.update({
          where: { id: line.id },
          data: {
            serialSnapshot: line.serialUnits
              .map((s) => s.serialNumber)
              .sort()
              .join(", "),
          },
        });
      }
      await tx.serialUnit.updateMany({
        where: { invoiceLineId: { in: previous.lines.map((l) => l.id) } },
        data: { invoiceLineId: null, status: "in_stock" },
      });

      // 2. The new revision.
      const invoice = await tx.invoice.create({
        data: {
          invoiceNo,
          customerId: payload.customerId,
          issueDate,
          dueDate: previous.dueDate,
          status: "issued",
          billDiscountType: payload.billDiscountType,
          billDiscountValue: payload.billDiscountValue,
          advanceAmount: 0,
          termsText: payload.termsText,
          extraTerms: payload.extraTerms || null,
          rootInvoiceId: rootId,
          revisionOfId: previous.id,
          revisionNo: nextRevision,
        },
      });

      for (let i = 0; i < payload.lines.length; i++) {
        const line = payload.lines[i];
        const item = items.get(line.itemId)!;
        const invoiceLine = await tx.invoiceLine.create({
          data: {
            invoiceId: invoice.id,
            itemId: line.itemId,
            unitPrice: line.unitPrice,
            costPrice: line.costPrice,
            quantity: line.quantity,
            lineDiscountType: line.discountType,
            lineDiscountValue: line.discountValue,
            note: line.note || null,
            sortOrder: i,
          },
        });

        if (!item.tracksSerials) continue;
        const claimed = await tx.serialUnit.updateMany({
          where: {
            id: { in: line.serialIds },
            itemId: line.itemId,
            status: "in_stock",
            invoiceLineId: null,
          },
          data: { invoiceLineId: invoiceLine.id, status: "sold" },
        });
        if (claimed.count !== line.serialIds.length) {
          throw new Error(
            `Some units for ${item.itemCode} were sold on another bill. ` +
              `Reopen the picker and choose again.`,
          );
        }
      }

      // 3. Payments follow the job, remembering where they were first taken.
      await tx.payment.updateMany({
        where: { invoiceId: previous.id, movedFromInvoiceId: null },
        data: { movedFromInvoiceId: previous.id },
      });
      await tx.payment.updateMany({
        where: { invoiceId: previous.id },
        data: { invoiceId: invoice.id },
      });

      // 4. The old invoice is kept, only marked as replaced.
      await tx.invoice.update({
        where: { id: previous.id },
        data: { status: "superseded", supersededAt: new Date() },
      });

      return { id: invoice.id, invoiceNo };
    });

    return { ok: true, invoiceId: result.id, invoiceNo: result.invoiceNo };
  } catch (error) {
    return { ok: false, error: (error as Error).message ?? "Could not revise." };
  }
}

/** The live revision in a chain - the one bills and payments should use. */
export async function latestRevisionId(invoiceId: number): Promise<number> {
  const inv = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!inv) return invoiceId;
  const rootId = inv.rootInvoiceId ?? inv.id;
  const latest = await prisma.invoice.findFirst({
    where: { OR: [{ id: rootId }, { rootInvoiceId: rootId }], supersededAt: null },
    orderBy: { id: "desc" },
    select: { id: true },
  });
  return latest?.id ?? invoiceId;
}
