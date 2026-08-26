import Link from "next/link";
import { notFound } from "next/navigation";

import CustomerForm from "@/components/CustomerForm";
import PageShell from "@/components/PageShell";
import { prisma } from "@/lib/prisma";
import { updateCustomer } from "../../actions";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) notFound();

  // Bind the id so the client form keeps the (state, formData) signature
  // that useFormState expects.
  const action = updateCustomer.bind(null, customer.id);

  return (
    <PageShell>
      <div className="space-y-6">
        <div>
          <Link
            href={`/customers/${customer.id}`}
            className="text-sm text-slate-500 hover:underline"
          >
            &larr; {customer.name}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Edit customer</h1>
        </div>

        <CustomerForm
          action={action}
          cancelHref={`/customers/${customer.id}`}
          defaults={{
            name: customer.name,
            phone: customer.phone,
            address: customer.address ?? "",
          }}
        />
      </div>
    </PageShell>
  );
}
