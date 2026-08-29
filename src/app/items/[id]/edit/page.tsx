import Link from "next/link";
import { notFound } from "next/navigation";

import ItemForm from "@/components/ItemForm";
import { prisma } from "@/lib/prisma";
import { toRupees } from "@/lib/money";
import { updateItem } from "../../actions";
import PageShell from "@/components/PageShell";

export const dynamic = "force-dynamic";

export default async function EditItemPage({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const item = await prisma.item.findUnique({
    where: { id },
    include: { _count: { select: { serialUnits: true } } },
  });
  if (!item) notFound();

  // Bind the id so the client form keeps the (state, formData) signature
  // that useFormState expects.
  const action = updateItem.bind(null, item.id);

  return (
    <PageShell>
      <div className="space-y-6">
        <div>
          <Link href="/items" className="text-sm text-slate-500 hover:underline">
            &larr; Items
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Edit item</h1>
          <p className="font-mono text-sm text-slate-500">{item.itemCode}</p>
        </div>

        <ItemForm
          action={action}
          submitLabel="Save changes"
          lockTracking={item._count.serialUnits > 0}
          defaults={{
            itemCode: item.itemCode,
            name: item.name,
            description: item.description ?? "",
            barcode: item.barcode ?? "",
            unitPrice: toRupees(item.unitPrice).toFixed(2),
            tracksSerials: item.tracksSerials,
          }}
        />
      </div>
    </PageShell>
  );
}
