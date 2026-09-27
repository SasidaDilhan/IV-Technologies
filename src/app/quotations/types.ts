/**
 * The payload the billing screen submits. Shared by the client form and the
 * server action so both agree on the shape without a schema library.
 *
 * Money crosses this boundary as CENTS and discounts in their stored form
 * (cents or basis points) - the client converts once, using the same helpers
 * the server would, so there is a single conversion path.
 *
 * Note there are no serial numbers here. A quotation prices a MODEL and a
 * quantity; which physical units go out is decided when the customer confirms
 * and the quotation becomes an invoice.
 */

export interface DraftLinePayload {
  itemId: number;
  /** Cents. Snapshot of the price agreed for this bill. */
  unitPrice: number;
  /**
   * Cents. The buying price the operator was shown when the line was added -
   * from the catalogue for a new line, from the stored snapshot when a
   * quotation is reopened. Internal; never printed.
   */
  costPrice: number;
  quantity: number;
  discountType: string;
  discountValue: number;
  note: string;
}

export interface QuotationPayload {
  customerId: number;
  issueDate: string;
  validUntil: string;
  billDiscountType: string;
  billDiscountValue: number;
  termsText: string;
  /** Conditions specific to this job; printed as its own section. */
  extraTerms: string;
  lines: DraftLinePayload[];
}

export interface SaveResult {
  ok: boolean;
  error?: string;
  quotationId?: number;
  quoteNo?: string;
}
