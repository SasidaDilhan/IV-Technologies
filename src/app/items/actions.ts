"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import type { ItemFormState } from "./form-state";
import { toCents } from "@/lib/money";
import {
  bool,
  normaliseCode,
  parseRupees,
  str,
  uniqueFieldError,
  type FieldErrors,
} from "@/lib/validation";

const UNIQUE_MESSAGES = {
  itemCode: "An item with this code already exists.",
  barcode: "This barcode is already on another item.",
};

interface ParsedItem {
  itemCode: string;
  name: string;
  description: string | null;
  barcode: string | null;
  costPrice: number;
  unitPrice: number;
  tracksSerials: boolean;
}

function parseItemForm(form: FormData): {
  errors: FieldErrors;
  value: ParsedItem;
} {
  const errors: FieldErrors = {};

  const itemCode = normaliseCode(str(form, "itemCode"));
  const name = str(form, "name");
  const description = str(form, "description");
  const barcodeRaw = str(form, "barcode");
  const priceRaw = str(form, "unitPrice");
  const costRaw = str(form, "costPrice");
  const tracksSerials = bool(form, "tracksSerials");

  if (!itemCode) errors.itemCode = "Item code is required.";
  if (!name) errors.name = "Name is required.";

  const rupees = parseRupees(priceRaw);
  if (!priceRaw) {
    errors.unitPrice = "Price is required.";
  } else if (Number.isNaN(rupees)) {
    errors.unitPrice = "Enter a number, e.g. 12500 or 12500.50";
  } else if (rupees < 0) {
    errors.unitPrice = "Price cannot be negative.";
  }

  // Buying price is optional - labour and services have none - but when it is
  // given it must be a real amount.
  let costCents = 0;
  if (costRaw) {
    const costRupees = parseRupees(costRaw);
    if (Number.isNaN(costRupees)) {
      errors.costPrice = "Enter a number, e.g. 9000 or 9000.50";
    } else {
      costCents = toCents(costRupees);
    }
  }

  return {
    errors,
    value: {
      itemCode,
      name,
      description: description || null,
      barcode: barcodeRaw || null,
      costPrice: costCents,
      unitPrice: Number.isNaN(rupees) ? 0 : toCents(rupees),
      tracksSerials,
    },
  };
}

export async function createItem(
  _prev: ItemFormState,
  form: FormData,
): Promise<ItemFormState> {
  const { errors, value } = parseItemForm(form);
  if (Object.keys(errors).length > 0) return { errors };

  try {
    await prisma.item.create({ data: value });
  } catch (error) {
    const fieldErrors = uniqueFieldError(error, UNIQUE_MESSAGES);
    if (fieldErrors) return { errors: fieldErrors };
    throw error;
  }

  revalidatePath("/items");
  redirect("/items");
}

export async function updateItem(
  id: number,
  _prev: ItemFormState,
  form: FormData,
): Promise<ItemFormState> {
  const { errors, value } = parseItemForm(form);
  if (Object.keys(errors).length > 0) return { errors };

  // Turning serial tracking off would orphan any units already logged, so it
  // is blocked while stock exists rather than silently discarding the link.
  if (!value.tracksSerials) {
    const units = await prisma.serialUnit.count({ where: { itemId: id } });
    if (units > 0) {
      return {
        errors: {
          tracksSerials:
            `Cannot turn off serial tracking: ${units} serial number(s) are ` +
            `already recorded for this item.`,
        },
      };
    }
  }

  try {
    await prisma.item.update({ where: { id }, data: value });
  } catch (error) {
    const fieldErrors = uniqueFieldError(error, UNIQUE_MESSAGES);
    if (fieldErrors) return { errors: fieldErrors };
    throw error;
  }

  revalidatePath("/items");
  redirect("/items");
}
