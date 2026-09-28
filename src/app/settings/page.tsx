import fs from "node:fs";

import BackupPanel from "@/components/BackupPanel";
import PageShell from "@/components/PageShell";
import SettingsForm from "@/components/SettingsForm";
import { findGoogleDrive, getBackupFolder, listBackups, localBackupDir } from "@/lib/backup";
import { getSettings } from "@/lib/settings";

const ago = (d: Date | undefined) =>
  d
    ? d.toLocaleString("en-GB", {
        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : null;

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const s = await getSettings();
  const folder = getBackupFolder();
  const backups = listBackups();
  const local = backups.filter((b) => b.where === "local");
  const copies = backups.filter((b) => b.where === "folder");

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

        <BackupPanel
          localDir={localBackupDir()}
          googleDrive={findGoogleDrive()}
          folder={folder}
          lastLocal={ago(local[0]?.modified)}
          lastFolder={ago(copies[0]?.modified)}
          localCount={local.length}
          folderCount={copies.length}
          folderReachable={folder ? fs.existsSync(folder) : false}
        />
      </div>
    </PageShell>
  );
}
