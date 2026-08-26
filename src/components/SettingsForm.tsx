"use client";

import { useRef, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";

import { saveSettings } from "@/app/settings/actions";
import {
  MAX_LOGO_BYTES,
  emptySettingsFormState,
} from "@/app/settings/form-state";
import { formatDocNo } from "@/lib/doc-number";

export interface SettingsValues {
  businessName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  regNo: string;
  logoDataUrl: string | null;
  defaultTerms: string;
  quotePrefix: string;
  quoteNextNumber: number;
  quoteNumberPadding: number;
  invoicePrefix: string;
  invoiceNextNumber: number;
  invoiceNumberPadding: number;
}

const field =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 " +
  "focus:outline-none focus:ring-2 focus:ring-slate-400 " +
  "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

const labelClass = "block text-xs font-medium text-slate-500";

function Err({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-sm text-red-600 dark:text-red-400">{message}</p>;
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
    >
      {pending ? "Saving..." : "Save settings"}
    </button>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 p-5 dark:border-slate-800">
      <h2 className="font-medium">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function SettingsForm({ values }: { values: SettingsValues }) {
  const [state, formAction] = useFormState(saveSettings, emptySettingsFormState);

  const [logo, setLogo] = useState<string | null>(values.logoDataUrl);
  const [logoAction, setLogoAction] = useState<"keep" | "replace" | "remove">("keep");
  const [logoError, setLogoError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Live preview of what the next document numbers will look like.
  const [quotePrefix, setQuotePrefix] = useState(values.quotePrefix);
  const [quoteNext, setQuoteNext] = useState(String(values.quoteNextNumber));
  const [quotePad, setQuotePad] = useState(String(values.quoteNumberPadding));
  const [invoicePrefix, setInvoicePrefix] = useState(values.invoicePrefix);
  const [invoiceNext, setInvoiceNext] = useState(String(values.invoiceNextNumber));
  const [invoicePad, setInvoicePad] = useState(String(values.invoiceNumberPadding));

  const preview = (prefix: string, next: string, pad: string) => {
    const n = Number(next);
    const p = Number(pad);
    if (!Number.isInteger(n) || n < 1 || !Number.isInteger(p) || p < 1) return "-";
    return formatDocNo(prefix, n, p);
  };

  function pickLogo(file: File) {
    setLogoError(null);
    if (!file.type.startsWith("image/")) {
      setLogoError("Choose an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      if (url.length > MAX_LOGO_BYTES) {
        setLogoError(
          `That image is too large (${Math.round(url.length / 1000)} KB). ` +
            `Keep it under ${Math.round(MAX_LOGO_BYTES / 1000)} KB.`,
        );
        return;
      }
      setLogo(url);
      setLogoAction("replace");
    };
    reader.readAsDataURL(file);
  }

  return (
    <form action={formAction} className="space-y-5">
      {state.savedAt && (
        <p className="rounded-md bg-emerald-100 px-3 py-2 text-sm text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          Saved at {state.savedAt}. New documents will use these details.
        </p>
      )}

      <Section
        title="Business details"
        hint="Printed in the header of every estimate and invoice."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className={labelClass}>Business name</span>
            <input
              name="businessName"
              defaultValue={values.businessName}
              className={`${field} mt-1`}
            />
            <Err message={state.errors.businessName} />
          </label>
          <label>
            <span className={labelClass}>Address line 1</span>
            <input
              name="addressLine1"
              defaultValue={values.addressLine1}
              className={`${field} mt-1`}
            />
          </label>
          <label>
            <span className={labelClass}>Address line 2</span>
            <input
              name="addressLine2"
              defaultValue={values.addressLine2}
              className={`${field} mt-1`}
            />
          </label>
          <label>
            <span className={labelClass}>City</span>
            <input name="city" defaultValue={values.city} className={`${field} mt-1`} />
          </label>
          <label>
            <span className={labelClass}>Phone</span>
            <input
              name="phone"
              defaultValue={values.phone}
              className={`${field} mt-1 font-mono`}
            />
          </label>
          <label>
            <span className={labelClass}>Email</span>
            <input
              name="email"
              defaultValue={values.email}
              className={`${field} mt-1`}
            />
          </label>
          <label>
            <span className={labelClass}>Strapline</span>
            <input
              name="website"
              defaultValue={values.website}
              placeholder="CCTV Sales | Installation | Service"
              className={`${field} mt-1`}
            />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Registration number</span>
            <input
              name="regNo"
              defaultValue={values.regNo}
              className={`${field} mt-1 font-mono`}
            />
          </label>
        </div>
      </Section>

      <Section title="Logo" hint="Appears top-right on every printed document.">
        <div className="flex flex-wrap items-center gap-5">
          <div className="flex h-24 w-40 items-center justify-center rounded-md border border-slate-200 bg-white p-2 dark:border-slate-800">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- a data: URL, not a served asset
              <img src={logo} alt="Business logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-xs text-slate-400">No logo</span>
            )}
          </div>

          <div className="space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) pickLogo(file);
              }}
              className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-2 file:text-sm file:text-white dark:file:bg-slate-100 dark:file:text-slate-900"
            />
            {logo && (
              <button
                type="button"
                onClick={() => {
                  setLogo(null);
                  setLogoAction("remove");
                  if (fileRef.current) fileRef.current.value = "";
                }}
                className="text-xs text-slate-500 underline hover:text-red-600"
              >
                Remove logo
              </button>
            )}
            {logoError && (
              <p className="text-sm text-red-600 dark:text-red-400">{logoError}</p>
            )}
            <Err message={state.errors.logo} />
          </div>
        </div>

        <input type="hidden" name="logoAction" value={logoAction} />
        <input type="hidden" name="logoDataUrl" value={logo ?? ""} />
      </Section>

      <Section
        title="Document numbering"
        hint="Quotations and invoices count independently. Changing a counter cannot reuse a reference that has already been issued."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          {[
            {
              label: "Quotations",
              prefixName: "quotePrefix",
              nextName: "quoteNextNumber",
              padName: "quoteNumberPadding",
              prefix: quotePrefix,
              setPrefix: setQuotePrefix,
              next: quoteNext,
              setNext: setQuoteNext,
              pad: quotePad,
              setPad: setQuotePad,
              errNext: state.errors.quoteNextNumber,
              errPrefix: undefined as string | undefined,
            },
            {
              label: "Invoices",
              prefixName: "invoicePrefix",
              nextName: "invoiceNextNumber",
              padName: "invoiceNumberPadding",
              prefix: invoicePrefix,
              setPrefix: setInvoicePrefix,
              next: invoiceNext,
              setNext: setInvoiceNext,
              pad: invoicePad,
              setPad: setInvoicePad,
              errNext: state.errors.invoiceNextNumber,
              errPrefix: state.errors.invoicePrefix,
            },
          ].map((g) => (
            <div
              key={g.label}
              className="rounded-md border border-slate-200 p-4 dark:border-slate-800"
            >
              <h3 className="text-sm font-medium">{g.label}</h3>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <label>
                  <span className={labelClass}>Prefix</span>
                  <input
                    name={g.prefixName}
                    value={g.prefix}
                    onChange={(e) => g.setPrefix(e.target.value)}
                    placeholder="none"
                    className={`${field} mt-1 font-mono`}
                  />
                </label>
                <label>
                  <span className={labelClass}>Next no.</span>
                  <input
                    name={g.nextName}
                    value={g.next}
                    onChange={(e) => g.setNext(e.target.value)}
                    inputMode="numeric"
                    className={`${field} mt-1 text-right font-mono`}
                  />
                </label>
                <label>
                  <span className={labelClass}>Digits</span>
                  <input
                    name={g.padName}
                    value={g.pad}
                    onChange={(e) => g.setPad(e.target.value)}
                    inputMode="numeric"
                    className={`${field} mt-1 text-right font-mono`}
                  />
                </label>
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Next will be{" "}
                <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                  {preview(g.prefix, g.next, g.pad)}
                </span>
              </p>
              <Err message={g.errNext} />
              <Err message={g.errPrefix} />
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="Default terms & conditions"
        hint={
          "Loaded into every new quotation. Editing a quotation copies this text " +
          "into that document; it never writes back here."
        }
      >
        <p className="mb-2 text-xs text-slate-500">
          Start a line with <span className="font-mono">#</span> for a heading and{" "}
          <span className="font-mono">-</span> for a bullet.
        </p>
        <textarea
          name="defaultTerms"
          defaultValue={values.defaultTerms}
          rows={16}
          className={`${field} font-mono text-xs leading-relaxed`}
        />
      </Section>

      <div className="flex items-center gap-3">
        <SaveButton />
        {state.errors._form && (
          <p className="text-sm text-red-600 dark:text-red-400">{state.errors._form}</p>
        )}
      </div>
    </form>
  );
}
