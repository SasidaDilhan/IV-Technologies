import Link from "next/link";

import ItemForm from "@/components/ItemForm";
import { createItem } from "../actions";
import PageShell from "@/components/PageShell";

export default function NewItemPage() {
  return (
    <PageShell>
      <div className="space-y-6">
        <div>
          <Link href="/items" className="text-sm text-slate-500 hover:underline">
            &larr; Items
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">Add item</h1>
        </div>
        <ItemForm action={createItem} submitLabel="Create item" />
      </div>
    </PageShell>
  );
}
