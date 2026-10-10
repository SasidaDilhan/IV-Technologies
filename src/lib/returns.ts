import { prisma } from "@/lib/prisma";
import { billTotals, lineShares, returnCredit, type BillTotals } from "@/lib/money";

/**
 * Returns: a customer brings back some or all of an invoice.
 *
 * The invoice is never edited - it stays exactly as issued. A return is its
 * own record, numbered <invoiceNo>-R1, -R2 ..., which
 *  - credits the customer with the returned goods' share of the invoice
 *    total (after line and bill discounts), lowering what they owe;
 *  - optionally records money handed back, when they had already paid;
 *  - releases returned serial units: back into stock, or marked faulty and
 *    kept out of stock.
 *
 * All of it runs in one transaction.
 */

export interface ReturnLineInput {
  invoiceLineId: number;
  quantity: number;
  /** true: back on the shelf. false: faulty, kept out of stock. */
  restock: boolean;
  /** Serial-tracked lines: exactly `quantity` units currently on this line. */
  serialIds: number[];
}

export interface ReturnInput {
  invoiceId: number;
  returnDate: string;
  reason: string;
  lines: ReturnLineInput[];
  /** Cents handed back now. */
  refundAmount: number;
  refundMethod: string;
  refundReference: string;
}

export interface ReturnResult {
  ok: boolean;
  error?: string;
  returnId?: number;
  returnNo?: string;
}

/** Lines in the one fixed order every credit calculation must use. */
export function orderLines<T extends { sortOrder: number; id: number }>(lines: T[]): T[] {
  return [...lines].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
}

/** Units of each invoice line already returned. */
export function returnedByLine(lines: { id: number; returnLines: { quantity: number }[] }[]) {
  return new Map(lines.map((l) => [l.id, l.returnLines.reduce((n, r) => n + r.quantity, 0)]));
}

/** "INV-000012" + 1 -> "INV-000012-R1". */
export function returnNumber(invoiceNo: string, n: number): string {
  return `${invoiceNo}-R${n}`;
}

/**
 * Settlement label for an invoice, taking returns into account.
 * Stored nowhere - derived from the totals, so it can never disagree.
 */
export function invoiceState(t: BillTotals): { label: string; settled: boolean } {
  if (t.returned > 0 && t.balanceDue < 0) return { label: "refund due", settled: false };
  if (t.returned > 0 && t.netTotal <= 0) return { label: "returned", settled: true };
  if (t.balanceDue <= 0) return { label: "paid", settled: true };
  if (t.paid > 0) return { label: "part paid", settled: false };
  return { label: "unpaid", settled: false };
}

export async function createReturn(input: ReturnInput): Promise<ReturnResult> {
  const returnDate = new Date(input.returnDate);
  if (Number.isNaN(returnDate.getTime())) return { ok: false, error: "Return date is not valid." };
  if (!Number.isInteger(input.refundAmount) || input.refundAmount < 0) {
    return { ok: false, error: "Refund cannot be negative." };
  }
  const wanted = input.lines.filter((l) => l.quantity > 0);
  if (wanted.length === 0) return { ok: false, error: "Choose at least one item to return." };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const invoice = await tx.invoice.findUnique({
        where: { id: input.invoiceId },
        include: {
          payments: true,
          returns: true,
          lines: { include: { item: true, serialUnits: true, returnLines: true } },
        },
      });
      if (!invoice) throw new Error("That invoice no longer exists.");
      if (invoice.supersededAt) {
        throw new Error("This invoice was revised. Return items on the latest revision.");
      }

      const lines = orderLines(invoice.lines);
      const shares = lineShares(lines, invoice.billDiscountType, invoice.billDiscountValue);
      const already = returnedByLine(lines);

      const planned: {
        line: (typeof lines)[number];
        quantity: number;
        credit: number;
        restock: boolean;
        serialIds: number[];
      }[] = [];

      for (const want of wanted) {
        const index = lines.findIndex((l) => l.id === want.invoiceLineId);
        if (index === -1) throw new Error("A returned line is not on this invoice.");
        const line = lines[index];
        const code = line.item.itemCode;
        const remaining = line.quantity - (already.get(line.id) ?? 0);

        if (!Number.isInteger(want.quantity) || want.quantity < 1) {
          throw new Error(`${code}: quantity must be a whole number.`);
        }
        if (want.quantity > remaining) {
          throw new Error(
            remaining === 0
              ? `${code}: everything on this line has already been returned.`
              : `${code}: only ${remaining} can still be returned.`,
          );
        }

        const serialIds = Array.from(new Set(want.serialIds));
        if (line.item.tracksSerials) {
          if (serialIds.length !== want.quantity) {
            throw new Error(
              `${code}: tick exactly ${want.quantity} serial number${want.quantity === 1 ? "" : "s"} ` +
                `(${serialIds.length} ticked).`,
            );
          }
          const onLine = new Set(line.serialUnits.map((s) => s.id));
          if (!serialIds.every((id) => onLine.has(id))) {
            throw new Error(`${code}: a ticked serial number is not on this invoice line.`);
          }
        } else if (serialIds.length > 0) {
          throw new Error(`${code}: this item has no serial numbers.`);
        }

        planned.push({
          line,
          quantity: want.quantity,
          credit: returnCredit(shares[index], line.quantity, already.get(line.id) ?? 0, want.quantity),
          restock: want.restock,
          serialIds,
        });
      }

      const creditAmount = planned.reduce((sum, p) => sum + p.credit, 0);

      // Refund: at most what the customer would be owed after this credit.
      const after = billTotals({
        lines,
        billDiscountType: invoice.billDiscountType,
        billDiscountValue: invoice.billDiscountValue,
        advanceAmount: invoice.advanceAmount,
        payments: invoice.payments,
        returns: [...invoice.returns, { creditAmount, refundAmount: 0 }],
      });
      const maxRefund = Math.max(0, -after.balanceDue);
      if (input.refundAmount > maxRefund) {
        throw new Error(
          maxRefund === 0
            ? "Nothing has been paid beyond what is still owed, so there is nothing to refund - the return just lowers the balance."
            : `The refund can be at most ${(maxRefund / 100).toFixed(2)}.`,
        );
      }
      if (input.refundAmount > 0 && !input.refundMethod) {
        throw new Error("Choose how the refund was paid.");
      }

      let n = invoice.returns.length + 1;
      let returnNo = returnNumber(invoice.invoiceNo, n);
      while (await tx.invoiceReturn.findUnique({ where: { returnNo } })) {
        returnNo = returnNumber(invoice.invoiceNo, ++n);
      }

      const created = await tx.invoiceReturn.create({
        data: {
          returnNo,
          invoiceId: invoice.id,
          returnDate,
          reason: input.reason.trim() || null,
          creditAmount,
          refundAmount: input.refundAmount,
          refundMethod: input.refundAmount > 0 ? input.refundMethod : null,
          refundReference: input.refundAmount > 0 ? input.refundReference.trim() || null : null,
        },
      });

      for (const p of planned) {
        const units = p.line.serialUnits.filter((s) => p.serialIds.includes(s.id));
        await tx.returnLine.create({
          data: {
            returnId: created.id,
            invoiceLineId: p.line.id,
            quantity: p.quantity,
            creditAmount: p.credit,
            costPrice: p.line.costPrice,
            restock: p.restock,
            serials: {
              create: units.map((u) => ({ serialUnitId: u.id, serialNumber: u.serialNumber })),
            },
          },
        });

        if (p.serialIds.length > 0) {
          // Claim inside the transaction, against this line only.
          const moved = await tx.serialUnit.updateMany({
            where: { id: { in: p.serialIds }, invoiceLineId: p.line.id },
            data: { invoiceLineId: null, status: p.restock ? "in_stock" : "faulty" },
          });
          if (moved.count !== p.serialIds.length) {
            throw new Error(`${p.line.item.itemCode}: the units changed while this was open. Try again.`);
          }
        }
      }

      return { id: created.id, returnNo };
    });
    return { ok: true, returnId: result.id, returnNo: result.returnNo };
  } catch (e) {
    return { ok: false, error: (e as Error).message ?? "Could not save the return." };
  }
}

/**
 * Undo a return entered by mistake. Only the most recent return on an
 * invoice can be undone, and only while its units are still where the
 * return put them - not sold again on another bill.
 */
export async function undoReturn(returnId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    await prisma.$transaction(async (tx) => {
      const ret = await tx.invoiceReturn.findUnique({
        where: { id: returnId },
        include: { lines: { include: { serials: { include: { serialUnit: true } } } } },
      });
      if (!ret) throw new Error("That return no longer exists.");

      const latest = await tx.invoiceReturn.findFirst({
        where: { invoiceId: ret.invoiceId },
        orderBy: { id: "desc" },
      });
      if (latest?.id !== ret.id) {
        throw new Error(`Undo ${latest?.returnNo} first - only the latest return can be undone.`);
      }

      for (const line of ret.lines) {
        for (const s of line.serials) {
          const u = s.serialUnit;
          const expected = line.restock ? "in_stock" : "faulty";
          if (u.invoiceLineId !== null || u.status !== expected) {
            throw new Error(
              `${u.serialNumber} has been sold or changed since it was returned, so this return cannot be undone.`,
            );
          }
          await tx.serialUnit.update({
            where: { id: u.id },
            data: { invoiceLineId: line.invoiceLineId, status: "sold" },
          });
        }
      }

      await tx.invoiceReturn.delete({ where: { id: ret.id } });
    });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
