import { prisma } from "@/lib/prisma";
import { billTotals } from "@/lib/money";
import { normaliseSerial } from "@/lib/validation";

/**
 * History search: "who has this camera?" and "who bought this item?"
 *
 * Accepts a serial number, an item code, an item name, a document number, or
 * a customer name/phone, and answers with the documents that match and the
 * customer on each one. A serial is unique to a physical unit, so an exact
 * serial hit is reported separately and prominently - that is the lookup the
 * shop actually needs when a unit comes back for warranty.
 */

export interface HistoryLine {
  itemCode: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  serialNumbers: string[];
  /** True when this line is why the document matched. */
  matched: boolean;
}

export interface HistoryDoc {
  kind: "quotation" | "invoice";
  id: number;
  number: string;
  issueDate: Date;
  status: string;
  customer: { id: number; name: string; phone: string };
  lines: HistoryLine[];
  total: number;
}

export interface MatchedSerial {
  serialNumber: string;
  status: string;
  itemCode: string;
  itemName: string;
  /** Set once the unit is on an invoice - this is the owner. */
  soldTo: { name: string; phone: string } | null;
  /**
   * Set when the unit is promised on an open quotation but not yet invoiced.
   * Reported separately from soldTo so "in stock" is never mistaken for
   * "free to sell" - the unit is spoken for.
   */
  reservedFor: { name: string; phone: string; documentNo: string } | null;
}

export interface HistoryResult {
  query: string;
  matchedSerial: MatchedSerial | null;
  matchedItems: { id: number; itemCode: string; name: string }[];
  documents: HistoryDoc[];
}

const EMPTY: Omit<HistoryResult, "query"> = {
  matchedSerial: null,
  matchedItems: [],
  documents: [],
};

export async function searchHistory(rawQuery: string): Promise<HistoryResult> {
  const q = rawQuery.trim();
  if (q.length < 2) return { query: q, ...EMPTY };

  const serialKey = normaliseSerial(q);
  const digits = q.replace(/\D/g, "");

  const [serialUnit, items] = await Promise.all([
    prisma.serialUnit.findUnique({
      where: { serialNumber: serialKey },
      include: { item: true },
    }),
    prisma.item.findMany({
      where: { OR: [{ itemCode: { contains: q } }, { name: { contains: q } }] },
      select: { id: true, itemCode: true, name: true },
      take: 20,
    }),
  ]);

  const itemIds = items.map((i) => i.id);

  // A document matches if it carries the scanned unit, carries a matching
  // item, is numbered like the query, or belongs to a matching customer.
  const customerWhere = {
    OR: [
      { name: { contains: q } },
      ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
    ],
  };

  // Quotation and Invoice have the same shape here, so the line/customer half
  // of the filter is identical for both; only the document number differs.
  const commonMatches = [
    ...(itemIds.length ? [{ lines: { some: { itemId: { in: itemIds } } } }] : []),
    ...(serialUnit
      ? [{ lines: { some: { serialUnits: { some: { id: serialUnit.id } } } } }]
      : []),
    { customer: customerWhere },
  ];

  // Quotations never carry units, so a serial hit can only reach one through
  // its customer or its number - not through a line.
  const quotationMatches = commonMatches.filter(
    (m) => !("lines" in m) || !JSON.stringify(m).includes("serialUnits"),
  );

  const [quotations, invoices] = await Promise.all([
    prisma.quotation.findMany({
      where: {
        OR: [...quotationMatches, { quoteNo: { contains: q } }],
      },
      orderBy: { issueDate: "desc" },
      take: 50,
      include: {
        customer: true,
        lines: {
          orderBy: { sortOrder: "asc" },
          include: { item: true },
        },
      },
    }),
    prisma.invoice.findMany({
      where: {
        OR: [...commonMatches, { invoiceNo: { contains: q } }],
      },
      orderBy: { issueDate: "desc" },
      take: 50,
      include: {
        customer: true,
        lines: {
          orderBy: { sortOrder: "asc" },
          include: { item: true, serialUnits: { orderBy: { serialNumber: "asc" } } },
        },
      },
    }),
  ]);

  const itemIdSet = new Set(itemIds);

  function shapeLines(
    lines: {
      itemId: number;
      quantity: number;
      unitPrice: number;
      item: { itemCode: string; name: string };
      /** Invoice lines carry units; quotation lines never do. */
      serialUnits?: { id: number; serialNumber: string }[];
    }[],
  ): HistoryLine[] {
    return lines.map((line) => ({
      itemCode: line.item.itemCode,
      itemName: line.item.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      serialNumbers: (line.serialUnits ?? []).map((s) => s.serialNumber),
      matched:
        itemIdSet.has(line.itemId) ||
        (serialUnit !== null &&
          (line.serialUnits ?? []).some((s) => s.id === serialUnit.id)),
    }));
  }

  const documents: HistoryDoc[] = [
    ...quotations.map((doc) => ({
      kind: "quotation" as const,
      id: doc.id,
      number: doc.quoteNo,
      issueDate: doc.issueDate,
      status: doc.status,
      customer: {
        id: doc.customer.id,
        name: doc.customer.name,
        phone: doc.customer.phone,
      },
      lines: shapeLines(doc.lines),
      total: billTotals({
        lines: doc.lines,
        billDiscountType: doc.billDiscountType,
        billDiscountValue: doc.billDiscountValue,
      }).total,
    })),
    ...invoices.map((doc) => ({
      kind: "invoice" as const,
      id: doc.id,
      number: doc.invoiceNo,
      issueDate: doc.issueDate,
      status: doc.status,
      customer: {
        id: doc.customer.id,
        name: doc.customer.name,
        phone: doc.customer.phone,
      },
      lines: shapeLines(doc.lines),
      total: billTotals({
        lines: doc.lines,
        billDiscountType: doc.billDiscountType,
        billDiscountValue: doc.billDiscountValue,
        advanceAmount: doc.advanceAmount,
      }).total,
    })),
  ].sort((a, b) => b.issueDate.getTime() - a.issueDate.getTime());

  // Who ends up owning the scanned unit: the invoice is the sale, so it wins
  // over a quotation, which is only a reservation.
  let soldTo: MatchedSerial["soldTo"] = null;
  let reservedFor: MatchedSerial["reservedFor"] = null;
  if (serialUnit) {
    const carries = (doc: HistoryDoc) =>
      doc.lines.some((l) => l.serialNumbers.includes(serialUnit.serialNumber));

    const invoiced = documents.find((doc) => doc.kind === "invoice" && carries(doc));
    if (invoiced) {
      soldTo = { name: invoiced.customer.name, phone: invoiced.customer.phone };
    } else {
      const quoted = documents.find((doc) => doc.kind === "quotation" && carries(doc));
      if (quoted) {
        reservedFor = {
          name: quoted.customer.name,
          phone: quoted.customer.phone,
          documentNo: quoted.number,
        };
      }
    }
  }

  return {
    query: q,
    matchedSerial: serialUnit
      ? {
          serialNumber: serialUnit.serialNumber,
          status: serialUnit.status,
          itemCode: serialUnit.item.itemCode,
          itemName: serialUnit.item.name,
          soldTo,
          reservedFor,
        }
      : null,
    matchedItems: items,
    documents,
  };
}
