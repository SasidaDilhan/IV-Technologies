"use client";

import { useState, useTransition } from "react";

import {
  backupNowAction,
  saveBackupFolderAction,
  type BackupActionResult,
} from "@/app/settings/actions";

interface Props {
  folder: string | null;
  lastLocal: string | null;
  lastFolder: string | null;
  localCount: number;
  folderCount: number;
  folderReachable: boolean;
}

const field =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-slate-400 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

/**
 * Backups on the Settings page: where the second copy goes, when the last
 * backup was taken, and a button to take one now (e.g. before a big change).
 */
export default function BackupPanel(p: Props) {
  const [folder, setFolder] = useState(p.folder ?? "");
  const [result, setResult] = useState<BackupActionResult | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<BackupActionResult>) =>
    start(async () => setResult(await fn()));

  return (
    <section className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
      <h2 className="font-semibold">Backups</h2>
      <p className="mt-1 text-sm text-slate-500">
        A backup is taken automatically a minute after anything is saved, and
        every time the system starts. Keep a second copy on
        another drive, a USB stick or a Google Drive folder, so a dead computer
        does not take the data with it. To put a backup back, close the system
        and double-click <span className="font-mono">RESTORE.bat</span>.
      </p>

      <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-slate-500">On this PC</dt>
        <dd>
          {p.lastLocal ? `Last backup ${p.lastLocal}` : "No backup yet"}
          <span className="text-slate-400"> · {p.localCount} kept</span>
        </dd>
        <dt className="text-slate-500">Backup folder</dt>
        <dd>
          {!p.folder ? (
            <span className="text-amber-700 dark:text-amber-500">Not set - backups are on this PC only</span>
          ) : !p.folderReachable ? (
            <span className="text-amber-700 dark:text-amber-500">
              Cannot reach {p.folder} - is the drive plugged in?
            </span>
          ) : (
            <>
              {p.lastFolder ? `Last copy ${p.lastFolder}` : "No copy yet"}
              <span className="text-slate-400"> · {p.folderCount} kept</span>
            </>
          )}
        </dd>
      </dl>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-xs text-slate-500">
          Backup folder (full path)
          <input
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
            placeholder="e.g.  E:\IV Technology backups"
            spellCheck={false}
            autoComplete="off"
            className={`${field} mt-1`}
          />
        </label>
        <button
          type="button"
          disabled={pending || folder.trim() === (p.folder ?? "")}
          onClick={() => run(() => saveBackupFolderAction(folder))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
        >
          Save folder
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(backupNowAction)}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
        >
          {pending ? "Backing up..." : "Back up now"}
        </button>
      </div>

      {result && (
        <div className="mt-3 space-y-1 text-sm" role="status">
          <p className={result.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
            {result.message}
          </p>
          {result.warning && <p className="text-amber-700 dark:text-amber-500">{result.warning}</p>}
        </div>
      )}
    </section>
  );
}
