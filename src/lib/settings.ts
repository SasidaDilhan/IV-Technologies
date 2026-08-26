import { prisma } from "@/lib/prisma";

/**
 * Settings is a single row, always id = 1. Reading it lazily creates it, so a
 * fresh database is never missing the business identity or the terms template.
 */
export const SETTINGS_ID = 1;

/**
 * IV Technology's terms, transcribed from Estimate 001253.
 *
 * The template is plain text so it stays editable in a textarea, with a
 * minimal markup the PDF renderer understands:
 *   "# "  section heading
 *   "- "  bullet
 *   any other line is a paragraph
 * Anything the operator types without markup still prints as a paragraph.
 */
export const DEFAULT_TERMS = [
  "# 1. Introduction",
  "These Terms and Conditions govern all sales, installations, and services provided by IV Technology to the customer. By purchasing products or using our services, you agree to these Terms.",
  "",
  "# 2. Products and Services",
  "We supply and install CCTV cameras, DVR/NVR systems, Alarm systems, Fingerprint systems and related security equipment. All products are brand new unless otherwise stated. Installation services include setup, wiring, configuration, and basic user guidance.",
  "",
  "# 3. Quotations and Payments",
  "- All quotations are valid for 14 days from the date of issue.",
  "- Work will begin only after a minimum advance payment agreed upon by both parties.",
  "- The remaining balance must be paid upon completion of installation.",
  "- Payments can be made via cash, cheque or bank transfer.",
  "",
  "# 4. Warranty",
  "- Product Warranty: All CCTV products come with a manufacturer's warranty covering manufacturing defects only, as mentioned in itemwise.",
  "- Service Warranty: Installation and service-related work are covered by a 1-year service warranty from the date of installation.",
  "- Warranty does not cover physical damage, lightning, power surges, misuse, or third-party interference.",
  "- Warranty claims are valid only with the original invoice.",
  "",
  "# 5. Installation Conditions",
  "- The client must provide safe access to the site and ensure electricity and network availability.",
  "- Any additional work (extra wiring, trunking, drilling, etc.) not included in the quotation will be charged separately.",
  "- Once installation is completed and approved by the client, any relocation or reinstallation will be treated as a new service request.",
  "",
  "# 6. Liability",
  "IV Technology is not responsible for:",
  "- Loss or damage caused by misuse, tampering, or unauthorised repairs.",
  "- Data loss or recording errors from DVR/NVR devices.",
  "- Any incidents captured or missed by the CCTV system.",
  "",
  "# 7. Ownership",
  "All equipment remains the property of IV Technology until full payment has been received.",
  "",
  "# 8. Privacy",
  "We respect your privacy. All customer details, installation locations, and recorded information will remain confidential and will not be shared with third parties except as required by law.",
  "",
  "# 9. Cancellation",
  "- Cancellations made before installation may incur a service fee depending on the work already completed.",
  "- Once products are installed, no refunds will be issued.",
  "",
  "# 10. Governing Law",
  "These Terms and Conditions are governed by the laws of Sri Lanka. Any disputes shall be resolved through mutual discussion or, if necessary, by a competent court in Sri Lanka.",
].join("\n");

export async function getSettings() {
  const existing = await prisma.settings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;

  return prisma.settings.create({
    data: { id: SETTINGS_ID, defaultTerms: DEFAULT_TERMS },
  });
}

/**
 * Allocate the next quotation number and advance the counter atomically.
 *
 * Runs inside the caller's transaction so a failed save cannot burn a number,
 * and two simultaneous saves cannot be handed the same one.
 */
export async function nextQuoteNo(
  tx: Pick<typeof prisma, "settings">,
): Promise<string> {
  const settings = await tx.settings.update({
    where: { id: SETTINGS_ID },
    data: { quoteNextNumber: { increment: 1 } },
  });

  // update() returns the row AFTER incrementing, so the number just allocated
  // is one below the stored counter.
  const allocated = settings.quoteNextNumber - 1;
  return formatDocNo(settings.quotePrefix, allocated, settings.quoteNumberPadding);
}

/** Same allocation, for invoices. See nextQuoteNo for why it runs in the tx. */
export async function nextInvoiceNo(
  tx: Pick<typeof prisma, "settings">,
): Promise<string> {
  const settings = await tx.settings.update({
    where: { id: SETTINGS_ID },
    data: { invoiceNextNumber: { increment: 1 } },
  });

  const allocated = settings.invoiceNextNumber - 1;
  return formatDocNo(
    settings.invoicePrefix,
    allocated,
    settings.invoiceNumberPadding,
  );
}

export function formatDocNo(prefix: string, n: number, padding: number): string {
  return `${prefix}${String(n).padStart(padding, "0")}`;
}
