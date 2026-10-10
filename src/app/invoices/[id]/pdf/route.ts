import { renderToBuffer } from "@react-pdf/renderer";

import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { QuotationDocument } from "@/lib/pdf/QuotationDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) return new Response("Bad invoice id", { status: 400 });

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      customer: true,
      payments: { orderBy: { paidAt: "asc" } },
      returns: { orderBy: { id: "asc" } },
      lines: {
        orderBy: { sortOrder: "asc" },
        include: {
          item: true,
          serialUnits: { orderBy: { serialNumber: "asc" } },
          returnLines: { include: { serials: true } },
        },
      },
    },
  });
  if (!invoice) return new Response("Invoice not found", { status: 404 });

  const settings = await getSettings();

  const buffer = await renderToBuffer(
    QuotationDocument({
      kind: "invoice",
      quoteNo: invoice.invoiceNo,
      issueDate: formatDate(invoice.issueDate),
      validUntil: "",
      dueDate: invoice.dueDate ? formatDate(invoice.dueDate) : null,
      status: invoice.status,
      customer: {
        name: invoice.customer.name,
        phone: invoice.customer.phone,
        address: invoice.customer.address,
      },
      lines: invoice.lines.map((line) => ({
        name: line.item.name,
        itemCode: line.item.itemCode,
        note: line.note,
        // The invoice prints as issued: every unit sold on the line, including
        // any since returned (the return has its own note) or moved to a newer
        // revision (kept as a snapshot).
        serialNumbers:
          line.serialUnits.length === 0 && line.returnLines.length === 0 && line.serialSnapshot
            ? line.serialSnapshot.split(", ")
            : [
                ...line.serialUnits.map((s) => s.serialNumber),
                ...line.returnLines.flatMap((r) => r.serials.map((s) => s.serialNumber)),
              ].sort(),
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineDiscountType: line.lineDiscountType,
        lineDiscountValue: line.lineDiscountValue,
      })),
      billDiscountType: invoice.billDiscountType,
      billDiscountValue: invoice.billDiscountValue,
      termsText: invoice.termsText,
      extraTerms: invoice.extraTerms,
      returns: invoice.returns.map((r) => ({
        returnNo: r.returnNo,
        creditAmount: r.creditAmount,
        refundAmount: r.refundAmount,
      })),
      payments: invoice.payments.map((p) => ({
        date: formatDate(p.paidAt),
        method: p.method,
        amount: p.amount,
        reference: p.reference,
      })),
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
      "Content-Disposition": `inline; filename="Invoice-${invoice.invoiceNo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
