import { renderToBuffer } from "@react-pdf/renderer";

import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { QuotationDocument } from "@/lib/pdf/QuotationDocument";

// The PDF renderer needs Node APIs, not the edge runtime.
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
  if (!Number.isInteger(id)) {
    return new Response("Bad quotation id", { status: 400 });
  }

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      customer: true,
      lines: {
        orderBy: { sortOrder: "asc" },
        include: { item: true, serialUnits: { orderBy: { serialNumber: "asc" } } },
      },
    },
  });

  if (!quotation) return new Response("Quotation not found", { status: 404 });

  const settings = await getSettings();

  const buffer = await renderToBuffer(
    QuotationDocument({
      kind: "quotation",
      quoteNo: quotation.quoteNo,
      issueDate: formatDate(quotation.issueDate),
      validUntil: formatDate(quotation.validUntil),
      status: quotation.status,
      customer: {
        name: quotation.customer.name,
        phone: quotation.customer.phone,
        address: quotation.customer.address,
      },
      lines: quotation.lines.map((line) => ({
        name: line.item.name,
        itemCode: line.item.itemCode,
        note: line.note,
        serialNumbers: line.serialUnits.map((s) => s.serialNumber),
        unitPrice: line.unitPrice,
        quantity: line.quantity,
        lineDiscountType: line.lineDiscountType,
        lineDiscountValue: line.lineDiscountValue,
      })),
      billDiscountType: quotation.billDiscountType,
      billDiscountValue: quotation.billDiscountValue,
      termsText: quotation.termsText,
      extraTerms: quotation.extraTerms,
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
      // inline so "Generate PDF" opens a preview tab rather than a silent download
      "Content-Disposition": `inline; filename="Quotation-${quotation.quoteNo}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
