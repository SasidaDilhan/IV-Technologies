import { renderToBuffer } from "@react-pdf/renderer";

import { billTotals } from "@/lib/money";
import { ReturnNoteDocument } from "@/lib/pdf/ReturnNoteDocument";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string; returnId: string } },
) {
  const invoiceId = Number(params.id);
  const returnId = Number(params.returnId);
  if (!Number.isInteger(invoiceId) || !Number.isInteger(returnId)) {
    return new Response("Bad id", { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      lines: true,
      payments: true,
      returns: {
        orderBy: { id: "asc" },
        include: {
          lines: { include: { serials: true, invoiceLine: { include: { item: true } } } },
        },
      },
    },
  });
  const ret = invoice?.returns.find((r) => r.id === returnId);
  if (!invoice || !ret) return new Response("Return not found", { status: 404 });

  // The balance as it stood right after this return - later returns and
  // payments are not part of this note.
  const upToThis = invoice.returns.filter((r) => r.id <= ret.id);
  const paidByThen = invoice.payments.filter((p) => p.paidAt <= ret.createdAt);
  const after = billTotals({
    lines: invoice.lines,
    billDiscountType: invoice.billDiscountType,
    billDiscountValue: invoice.billDiscountValue,
    advanceAmount: invoice.advanceAmount,
    payments: paidByThen,
    returns: upToThis,
  });

  const settings = await getSettings();

  const buffer = await renderToBuffer(
    ReturnNoteDocument({
      returnNo: ret.returnNo,
      returnDate: formatDate(ret.returnDate),
      invoiceNo: invoice.invoiceNo,
      invoiceDate: formatDate(invoice.issueDate),
      reason: ret.reason,
      customer: {
        name: invoice.customer.name,
        phone: invoice.customer.phone,
        address: invoice.customer.address,
      },
      lines: ret.lines.map((l) => ({
        name: l.invoiceLine.item.name,
        itemCode: l.invoiceLine.item.itemCode,
        serialNumbers: l.serials.map((s) => s.serialNumber).sort(),
        quantity: l.quantity,
        creditAmount: l.creditAmount,
      })),
      creditAmount: ret.creditAmount,
      refundAmount: ret.refundAmount,
      refundMethod: PAYMENT_METHODS.find((m) => m.value === ret.refundMethod)?.label ?? ret.refundMethod,
      balanceAfter: after.balanceDue,
      settings: {
        businessName: settings.businessName,
        addressLine1: settings.addressLine1,
        addressLine2: settings.addressLine2,
        city: settings.city,
        phone: settings.phone,
        email: settings.email,
        website: settings.website,
        regNo: settings.regNo,
        logoDataUrl: settings.logoDataUrl,
      },
    }),
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Return-${ret.returnNo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
