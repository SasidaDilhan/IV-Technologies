import Link from "next/link";

import PageShell from "@/components/PageShell";
import { prisma } from "@/lib/prisma";
import { normalisePhone } from "@/lib/validation";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = (searchParams.q ?? "").trim();
  const digits = normalisePhone(q);

  const customers = await prisma.customer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q } },
            ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
          ],
        }
      : undefined,
    orderBy: { name: "asc" },
    take: 200,
    include: { _count: { select: { quotations: true, invoices: true } } },
  });

  return (
    <PageShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Customers</h1>
          <p className="text-sm text-slate-500">
            Everyone billed so far. New customers are added on the billing
            screen, mid-quotation.
          </p>
        </div>

        <form method="get" className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search by name or phone number"
            autoComplete="off"
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <button
            type="submit"
            className="whitespace-nowrap rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Search
          </button>
          {q && (
            <Link
              href="/customers"
              className="flex items-center px-2 text-sm text-slate-500 underline"
            >
              Clear
            </Link>
          )}
        </form>

        {customers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
            <p className="text-slate-500">
              {q ? `No customer matches "${q}".` : "No customers yet."}
            </p>
            <Link href="/" className="mt-2 inline-block text-sm underline">
              Go to billing
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left dark:bg-slate-900">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Address</th>
                  <th className="px-4 py-3 text-right font-medium">Quotations</th>
                  <th className="px-4 py-3 text-right font-medium">Invoices</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-900"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="font-medium underline"
                      >
                        {customer.name}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono">
                      {customer.phone}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {customer.address ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {customer._count.quotations}
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {customer._count.invoices}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
