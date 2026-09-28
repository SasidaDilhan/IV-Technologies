"use client";

import { useState, useTransition } from "react";

import {
  backupNowAction,
  openBackupFolderAction,
  saveBackupFolderAction,
  type BackupActionResult,
} from "@/app/settings/actions";

interface Props {
  /** backups/ inside the program folder. */
  localDir: string;
  folder: string | null;
  lastLocal: string | null;
  lastFolder: string | null;
  localCount: number;
  folderCount: number;
  folderReachable: boolean;
  /** "My Drive" of Google Drive for desktop, if installed on this PC. */
  googleDrive: string | null;
}

const field =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-mono text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-slate-400 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

const smallBtn =
  "shrink-0 rounded border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-100 disabled:opacity-50 " +
  "dark:border-slate-700 dark:hover:bg-slate-800";

const SUGGESTED_NAME = "IV Technology backups";

/**
 * Backups on the Settings page: where the backups are, where the second copy
 * goes, when the last one was taken, and a button to take one now.
 */
export default function BackupPanel(p: Props) {
  const [folder, setFolder] = useState(p.folder ?? "");
  const [result, setResult] = useState<BackupActionResult | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<BackupActionResult>) =>
    start(async () => setResult(await fn()));

  const driveFolder = p.googleDrive ? `${p.googleDrive}\\${SUGGESTED_NAME}` : null;
  const usingDrive = !!(p.folder && p.googleDrive && p.folder.startsWith(p.googleDrive));

  return (
    <section className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
      <h2 className="font-semibold">Backups</h2>
      <p className="mt-1 text-sm text-slate-500">
        A backup is taken automatically a minute after anything is saved, and
        every time the system starts. Keep a second copy on another drive, a
        USB stick or Google Drive, so a dead computer does not take the data
        with it. To put a backup back, close the system and double-click{" "}
        <span className="font-mono">RESTORE.bat</span>.
      </p>

      <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-slate-500">On this PC</dt>
        <dd className="min-w-0">
          {p.lastLocal ? `Last backup ${p.lastLocal}` : "No backup yet"}
          <span className="text-slate-400"> · {p.localCount} kept</span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className="truncate font-mono text-xs text-slate-500" title={p.localDir}>
              {p.localDir}
            </span>
            <button type="button" className={smallBtn} disabled={pending} onClick={() => run(() => openBackupFolderAction("local"))}>
              Open
            </button>
          </span>
        </dd>

        <dt className="text-slate-500">Backup folder</dt>
        <dd className="min-w-0">
          {!p.folder ? (
            <span className="text-amber-700 dark:text-amber-500">Not set - backups are on this PC only</span>
          ) : !p.folderReachable ? (
            <span className="text-amber-700 dark:text-amber-500">
              Cannot reach this folder - is the drive plugged in, or Google Drive running?
            </span>
          ) : (
            <>
              {p.lastFolder ? `Last copy ${p.lastFolder}` : "No copy yet"}
              <span className="text-slate-400"> · {p.folderCount} kept</span>
              {usingDrive && (
                <span className="text-emerald-700 dark:text-emerald-400"> · uploads to Google Drive</span>
              )}
            </>
          )}
          {p.folder && (
            <span className="mt-0.5 flex items-center gap-2">
              <span className="truncate font-mono text-xs text-slate-500" title={p.folder}>
                {p.folder}
              </span>
              {p.folderReachable && (
                <button type="button" className={smallBtn} disabled={pending} onClick={() => run(() => openBackupFolderAction("folder"))}>
                  Open
                </button>
              )}
            </span>
          )}
        </dd>
      </dl>

      {!usingDrive && (
        <div className="mt-4 rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {driveFolder ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>
                Google Drive found on this PC. Backups saved to{" "}
                <span className="font-mono text-xs">{driveFolder}</span> upload to Google Drive by themselves.
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setFolder(driveFolder);
                  run(() => saveBackupFolderAction(driveFolder));
                }}
                className="shrink-0 rounded-md bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
              >
                Use Google Drive
              </button>
            </div>
          ) : (
            <span>
              To back up to Google Drive, install{" "}
              <span className="font-medium">Google Drive for desktop</span>{" "}
              (google.com/drive/download) and sign in. It adds a drive such as{" "}
              <span className="font-mono text-xs">G:\My Drive</span> - reopen this page and a
              one-click button appears here.
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-xs text-slate-500">
          Backup folder (full path) - or type one yourself, e.g. a USB stick
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
          {pending ? "Working..." : "Back up now"}
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
