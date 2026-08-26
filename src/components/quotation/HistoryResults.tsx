import Link from "next/link";

import { formatLKR } from "@/lib/money";
import type { HistoryDoc, HistoryResult } from "@/lib/history";

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs dark:bg-slate-800">
      {children}
    </span>
  );
}

function DocCard({ doc }: { doc: HistoryDoc }) {
  const matched = doc.lines.filter((l) => l.matched);
  const shown = matched.length > 0 ? matched : doc.lines;

  return (
    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-500">
              {doc.kind === "quotation" ? "Quotation" : "Invoice"}
            </span>
            {doc.kind === "quotation" ? (
              <Link
                href={`/quotations/${doc.id}`}
                className="font-mono font-medium underline"
              >
                {doc.number}
              </Link>
            ) : (
              // Invoice screens arrive in Phase 06; the record is shown but
              // there is nowhere to link to yet.
              <span className="font-mono font-medium">{doc.number}</span>
            )}
            <StatusPill>{doc.status}</StatusPill>
          </div>
          <p className="mt-2 font-medium">{doc.customer.name}</p>
          <p className="font-mono text-sm text-slate-600 dark:text-slate-400">
            {doc.customer.phone}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-500">
            {doc.issueDate.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </p>
          <p className="font-mono font-medium">{formatLKR(doc.total)}</p>
        </div>
      </div>

      <ul className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
        {shown.map((line, i) => (
          <li key={i} className="text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className={line.matched ? "font-medium" : ""}>
                {line.itemName}
              </span>
              <span className="whitespace-nowrap font-mono text-xs text-slate-500">
                {line.quantity} &times; {formatLKR(line.unitPrice)}
              </span>
            </div>
            <span className="font-mono text-xs text-slate-500">{line.itemCode}</span>
            {line.serialNumbers.length > 0 && (
              <p className="font-mono text-xs text-slate-500">
                S/N: {line.serialNumbers.join(", ")}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function HistoryResults({ result }: { result: HistoryResult }) {
  const { matchedSerial, matchedItems, documents } = result;

  return (
    <div className="space-y-5">
      {/* The warranty lookup: one scanned unit, and who has it. */}
      {matchedSerial && (
        <div className="rounded-lg border-2 border-slate-900 p-4 dark:border-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Serial number found
          </p>
          <p className="mt-1 font-mono text-lg font-semibold">
            {matchedSerial.serialNumber}
          </p>
          <p className="text-sm">
            {matchedSerial.itemName}{" "}
            <span className="font-mono text-slate-500">
              ({matchedSerial.itemCode})
            </span>
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <StatusPill>{matchedSerial.status}</StatusPill>
            {matchedSerial.soldTo ? (
              <span>
                Sold to <strong>{matchedSerial.soldTo.name}</strong>{" "}
                <span className="font-mono text-slate-500">
                  {matchedSerial.soldTo.phone}
                </span>
              </span>
            ) : matchedSerial.reservedFor ? (
              <span>
                Reserved for <strong>{matchedSerial.reservedFor.name}</strong>{" "}
                <span className="font-mono text-slate-500">
                  {matchedSerial.reservedFor.phone}
                </span>{" "}
                <span className="text-slate-500">
                  on quotation {matchedSerial.reservedFor.documentNo} - not yet
                  invoiced.
                </span>
              </span>
            ) : matchedSerial.status === "in_stock" ? (
              <span className="text-slate-500">
                Free in stock - not on any bill.
              </span>
            ) : (
              <span className="text-slate-500">
                Not linked to an invoice; see the documents below.
              </span>
            )}
          </div>
        </div>
      )}

      {matchedItems.length > 0 && (
        <p className="text-sm text-slate-500">
          Matched {matchedItems.length} catalog item
          {matchedItems.length === 1 ? "" : "s"}:{" "}
          {matchedItems.map((i) => i.itemCode).join(", ")}
        </p>
      )}

      {documents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
          <p className="text-slate-500">
            {matchedSerial
              ? "That unit is not on any quotation or invoice yet."
              : `Nothing found for "${result.query}".`}
          </p>
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {documents.length} document{documents.length === 1 ? "" : "s"}, newest
            first.
          </p>
          <div className="space-y-3">
            {documents.map((doc) => (
              <DocCard key={`${doc.kind}-${doc.id}`} doc={doc} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
