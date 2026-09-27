-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "revisionNo" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN "revisionOfId" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN "rootInvoiceId" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN "supersededAt" DATETIME;

-- AlterTable
ALTER TABLE "InvoiceLine" ADD COLUMN "serialSnapshot" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "movedFromInvoiceId" INTEGER;
