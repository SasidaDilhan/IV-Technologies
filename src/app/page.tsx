import QuotationBuilder from "@/components/quotation/QuotationBuilder";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Local (not UTC) yyyy-mm-dd, so "today" matches the shop's calendar. */
function isoDate(d: Date): string {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

/**
 * The till. This is the landing page because billing is what the machine is
 * open for all day - it loads ready to scan, with the cursor already in the
 * entry box.
 */
export default async function BillingPage() {
  const settings = await getSettings();

  const today = new Date();
  const plus14 = new Date(today);
  plus14.setDate(plus14.getDate() + 14);

  return (
    <QuotationBuilder
      defaultTerms={settings.defaultTerms}
      today={isoDate(today)}
      validUntil={isoDate(plus14)}
    />
  );
}
