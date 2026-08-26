"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import type { SerialFormState } from "./form-state";
import { normaliseSerial, str, uniqueFieldError } from "@/lib/validation";

/**
 * Add one serial number to stock. Called once per scan, so the failure modes
 * that matter are "already scanned" and "typo" - both must be reported without
 * losing the operator's place in the flow.
 */
export async function addSerial(
  itemId: number,
  prev: SerialFormState,
  form: FormData,
): Promise<SerialFormState> {
  const nonce = prev.nonce + 1;
  const serialNumber = normaliseSerial(str(form, "serialNumber"));

  if (!serialNumber) {
    return { error: "Scan or type a serial number.", nonce };
  }
  if (serialNumber.length < 3) {
    return { error: "That looks too short to be a serial number.", nonce };
  }

  const item = await prisma.item.findUnique({ where: { id: itemId } });
  if (!item) return { error: "Item not found.", nonce };
  if (!item.tracksSerials) {
    return { error: `${item.itemCode} is not set to track serial numbers.`, nonce };
  }

  try {
    await prisma.serialUnit.create({
      data: { serialNumber, itemId, status: "in_stock" },
    });
  } catch (error) {
    const fieldErrors = uniqueFieldError(error, {
      serialNumber: `${serialNumber} is already recorded.`,
    });
    if (fieldErrors) {
      // Say where the duplicate lives - the same serial on a different item
      // usually means the wrong item was selected before scanning.
      const existing = await prisma.serialUnit.findUnique({
        where: { serialNumber },
        include: { item: true },
      });
      const where =
        existing && existing.itemId !== itemId
          ? ` (recorded against ${existing.item.itemCode})`
          : existing?.status === "sold"
            ? " (already sold)"
            : "";
      return { error: `${serialNumber} is already recorded${where}.`, nonce };
    }
    throw error;
  }

  revalidatePath("/stock");
  revalidatePath("/items");
  return { added: serialNumber, nonce };
}

/**
 * Remove a serial from stock - for correcting a mistyped entry.
 * Refuses once the unit is attached to a bill, because that would erase the
 * record of which physical unit went to which customer.
 */
export async function removeSerial(id: number): Promise<{ error?: string }> {
  const unit = await prisma.serialUnit.findUnique({ where: { id } });
  if (!unit) return { error: "Serial not found." };

  if (unit.status !== "in_stock" || unit.invoiceLineId || unit.quoteLineId) {
    return {
      error: `${unit.serialNumber} is on a bill and cannot be removed.`,
    };
  }

  await prisma.serialUnit.delete({ where: { id } });
  revalidatePath("/stock");
  revalidatePath("/items");
  return {};
}
