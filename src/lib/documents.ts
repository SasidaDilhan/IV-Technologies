import { prisma } from "@/lib/prisma";
import { billTotals } from "@/lib/money";
import type { DocKind } from "@/lib/status";

export interface DocumentRow {
  kind: DocKind;
  id: number;
  number: string;
  issueDate: Date;
  createdAt: Date;
  status: string;
  customer: { id: number; name: string; phone: string };
  total: number;
  /** Set on an estimate that has become an invoice. */
  invoiceNo?: string | null;
}

/**
 * Estimates and invoices in one list, newest first.
 *
 *   estimatesOnly - quotations not yet turned into an invoice
 *   kind          - restrict to one kind
 */
export async function loadDocuments(opts: {
  kind?: DocKind;
  estimatesOnly?: boolean;
  take?: number;
}): Promise<DocumentRow[]> {
  const take = opts.take ?? 300;
  const wantQuotes = opts.kind !== "invoice";
  const wantInvoices = opts.kind !== "quotation" && !opts.estimatesOnly;

  const [quotations, invoices] = await Promise.all([
    wantQuotes
      ? prisma.quotation.findMany({
          where: opts.estimatesOnly ? { invoice: null } : undefined,
          orderBy: { createdAt: "desc" },
          take,
          include: { customer: true, lines: true, invoice: { select: { invoiceNo: true } } },
        })
      : Promise.resolve([]),
    wantInvoices
      ? prisma.invoice.findMany({
          orderBy: { createdAt: "desc" },
          take,
          include: { customer: true, lines: true },
        })
      : Promise.resolve([]),
  ]);

  const rows: DocumentRow[] = [
    ...quotations.map((q) => ({
      kind: "quotation" as const,
      id: q.id,
      number: q.quoteNo,
      issueDate: q.issueDate,
      createdAt: q.createdAt,
      status: q.status,
      customer: { id: q.customer.id, name: q.customer.name, phone: q.customer.phone },
      total: billTotals({
        lines: q.lines,
        billDiscountType: q.billDiscountType,
        billDiscountValue: q.billDiscountValue,
      }).total,
      invoiceNo: q.invoice?.invoiceNo ?? null,
    })),
    ...invoices.map((inv) => ({
      kind: "invoice" as const,
      id: inv.id,
      number: inv.invoiceNo,
      issueDate: inv.issueDate,
      createdAt: inv.createdAt,
      status: inv.status,
      customer: { id: inv.customer.id, name: inv.customer.name, phone: inv.customer.phone },
      total: billTotals({
        lines: inv.lines,
        billDiscountType: inv.billDiscountType,
        billDiscountValue: inv.billDiscountValue,
      }).total,
    })),
  ];

  // Newest activity first; creation time breaks ties within a day.
  return rows
    .sort(
      (a, b) =>
        b.issueDate.getTime() - a.issueDate.getTime() ||
        b.createdAt.getTime() - a.createdAt.getTime(),
    )
    .slice(0, take);
}
