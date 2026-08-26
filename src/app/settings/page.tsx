import PageShell from "@/components/PageShell";
import SettingsForm from "@/components/SettingsForm";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const s = await getSettings();

  return (
    <PageShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-sm text-slate-500">
            Business identity, logo, document numbering, and the terms template.
            These are what appear on every document you issue.
          </p>
        </div>

        <SettingsForm
          values={{
            businessName: s.businessName,
            addressLine1: s.addressLine1 ?? "",
            addressLine2: s.addressLine2 ?? "",
            city: s.city ?? "",
            phone: s.phone ?? "",
            email: s.email ?? "",
            website: s.website ?? "",
            regNo: s.regNo ?? "",
            logoDataUrl: s.logoDataUrl,
            defaultTerms: s.defaultTerms,
            quotePrefix: s.quotePrefix,
            quoteNextNumber: s.quoteNextNumber,
            quoteNumberPadding: s.quoteNumberPadding,
            invoicePrefix: s.invoicePrefix,
            invoiceNextNumber: s.invoiceNextNumber,
            invoiceNumberPadding: s.invoiceNumberPadding,
          }}
        />
      </div>
    </PageShell>
  );
}
