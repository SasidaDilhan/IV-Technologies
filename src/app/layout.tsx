import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "IV Technology Billing",
  description: "Billing system for IV Technology CCTV installations",
};

const NAV = [
  { href: "/", label: "Billing" },
  { href: "/estimates", label: "Estimates" },
  { href: "/quotations", label: "History" },
  { href: "/invoices", label: "Invoices" },
  { href: "/customers", label: "Customers" },
  { href: "/items", label: "Items" },
  { href: "/stock", label: "Stock intake" },
  { href: "/settings", label: "Settings" },
];

/**
 * The shell is a fixed-height column: the page itself never scrolls, so the
 * till screen can keep the scan box and the totals permanently on screen and
 * scroll only the line list. Pages that are ordinary documents wrap their own
 * content in PageShell to get a scrolling area back.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} flex h-full flex-col overflow-hidden`}>
        <header className="shrink-0 border-b border-slate-200 dark:border-slate-800">
          <nav className="flex items-center gap-6 px-5 py-3">
            <Link href="/" className="font-semibold tracking-tight">
              IV Technology
            </Link>
            <div className="flex gap-4 text-sm text-slate-600 dark:text-slate-400">
              {NAV.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hover:text-slate-900 dark:hover:text-slate-100"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <main className="min-h-0 flex-1">{children}</main>
      </body>
    </html>
  );
}
