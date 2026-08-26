import { prisma } from "@/lib/prisma";
import { SETTINGS_ID, formatDocNo, getSettings } from "@/lib/settings";
import { str } from "@/lib/validation";
import type { FieldErrors } from "@/lib/validation";
import type { SettingsFormState } from "@/app/settings/form-state";
import { MAX_LOGO_BYTES } from "@/app/settings/form-state";

function intField(
  form: FormData,
  key: string,
  errors: FieldErrors,
  label: string,
  min: number,
): number {
  const raw = str(form, key);
  const n = Number(raw);
  if (!raw || !Number.isInteger(n) || n < min) {
    errors[key] = `${label} must be a whole number of at least ${min}.`;
    return min;
  }
  return n;
}

/**
 * Save the business identity, terms template and document numbering.
 *
 * The numbering fields are the risky part: pointing a counter at a number
 * that has already been issued would produce two documents with the same
 * reference, so the next number is checked against what exists before saving.
 */
export async function applySettings(
  _prev: SettingsFormState,
  form: FormData,
): Promise<SettingsFormState> {
  const errors: FieldErrors = {};

  const businessName = str(form, "businessName");
  if (!businessName) errors.businessName = "Business name is required.";

  const quotePrefix = str(form, "quotePrefix");
  const invoicePrefix = str(form, "invoicePrefix");
  const quoteNextNumber = intField(form, "quoteNextNumber", errors, "Next quotation number", 1);
  const invoiceNextNumber = intField(form, "invoiceNextNumber", errors, "Next invoice number", 1);
  const quoteNumberPadding = intField(form, "quoteNumberPadding", errors, "Quotation padding", 1);
  const invoiceNumberPadding = intField(form, "invoiceNumberPadding", errors, "Invoice padding", 1);

  // Logo: either a new data URL from the picker, or "remove", or unchanged.
  const logoAction = str(form, "logoAction");
  const logoDataUrl = str(form, "logoDataUrl");
  if (logoAction === "replace") {
    if (!logoDataUrl.startsWith("data:image/")) {
      errors.logo = "That file is not an image.";
    } else if (logoDataUrl.length > MAX_LOGO_BYTES) {
      errors.logo = `That image is too large. Keep it under ${Math.round(
        MAX_LOGO_BYTES / 1000,
      )} KB.`;
    }
  }

  if (Object.keys(errors).length === 0) {
    const nextQuoteNo = formatDocNo(quotePrefix, quoteNextNumber, quoteNumberPadding);
    const clashQ = await prisma.quotation.findUnique({
      where: { quoteNo: nextQuoteNo },
      select: { id: true },
    });
    if (clashQ) {
      errors.quoteNextNumber = `${nextQuoteNo} has already been issued. Use a higher number.`;
    }

    const nextInvoiceNo = formatDocNo(
      invoicePrefix,
      invoiceNextNumber,
      invoiceNumberPadding,
    );
    const clashI = await prisma.invoice.findUnique({
      where: { invoiceNo: nextInvoiceNo },
      select: { id: true },
    });
    if (clashI) {
      errors.invoiceNextNumber = `${nextInvoiceNo} has already been issued. Use a higher number.`;
    }

    if (nextQuoteNo === nextInvoiceNo) {
      errors.invoicePrefix =
        "Quotations and invoices would produce the same reference. Give them different prefixes.";
    }
  }

  if (Object.keys(errors).length > 0) return { errors };

  await getSettings();
  await prisma.settings.update({
    where: { id: SETTINGS_ID },
    data: {
      businessName,
      addressLine1: str(form, "addressLine1") || null,
      addressLine2: str(form, "addressLine2") || null,
      city: str(form, "city") || null,
      phone: str(form, "phone") || null,
      email: str(form, "email") || null,
      website: str(form, "website") || null,
      regNo: str(form, "regNo") || null,
      defaultTerms: str(form, "defaultTerms"),
      quotePrefix,
      quoteNextNumber,
      quoteNumberPadding,
      invoicePrefix,
      invoiceNextNumber,
      invoiceNumberPadding,
      ...(logoAction === "replace" ? { logoDataUrl } : {}),
      ...(logoAction === "remove" ? { logoDataUrl: null } : {}),
    },
  });

  return { errors: {}, savedAt: new Date().toLocaleTimeString("en-GB") };
}
