/**
 * The payload the billing screen submits. Shared by the client form and the
 * server action so both agree on the shape without a schema library.
 *
 * Money crosses this boundary as CENTS and discounts in their stored form
 * (cents or basis points) - the client converts once, using the same helpers
 * the server would, so there is a single conversion path.
 */

export interface DraftLinePayload {
  itemId: number;
  /** Cents. Snapshot of the price agreed for this bill. */
  unitPrice: number;
  /** Ignored for serial-tracked items; serialIds.length wins. */
  quantity: number;
  discountType: string;
  discountValue: number;
  note: string;
  serialIds: number[];
}

export interface QuotationPayload {
  customerId: number;
  issueDate: string;
  validUntil: string;
  billDiscountType: string;
  billDiscountValue: number;
  termsText: string;
  lines: DraftLinePayload[];
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  quotationId?: number;
  quoteNo?: string;
}
