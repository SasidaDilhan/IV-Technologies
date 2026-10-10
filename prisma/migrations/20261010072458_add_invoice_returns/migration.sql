-- Invoice returns. New tables only: no existing table is altered, copied or
-- dropped, so this is safe to apply to a live database.

-- CreateTable
CREATE TABLE "InvoiceReturn" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "returnNo" TEXT NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "returnDate" DATETIME NOT NULL,
    "reason" TEXT,
    "creditAmount" INTEGER NOT NULL,
    "refundAmount" INTEGER NOT NULL DEFAULT 0,
    "refundMethod" TEXT,
    "refundReference" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InvoiceReturn_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReturnLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "returnId" INTEGER NOT NULL,
    "invoiceLineId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "creditAmount" INTEGER NOT NULL,
    "costPrice" INTEGER NOT NULL DEFAULT 0,
    "restock" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "InvoiceReturn" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReturnLine_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "InvoiceLine" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReturnSerial" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "returnLineId" INTEGER NOT NULL,
    "serialUnitId" INTEGER NOT NULL,
    "serialNumber" TEXT NOT NULL,
    CONSTRAINT "ReturnSerial_returnLineId_fkey" FOREIGN KEY ("returnLineId") REFERENCES "ReturnLine" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReturnSerial_serialUnitId_fkey" FOREIGN KEY ("serialUnitId") REFERENCES "SerialUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "InvoiceReturn_returnNo_key" ON "InvoiceReturn"("returnNo");

-- CreateIndex
CREATE INDEX "InvoiceReturn_invoiceId_idx" ON "InvoiceReturn"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceReturn_returnDate_idx" ON "InvoiceReturn"("returnDate");

-- CreateIndex
CREATE INDEX "ReturnLine_returnId_idx" ON "ReturnLine"("returnId");

-- CreateIndex
CREATE INDEX "ReturnLine_invoiceLineId_idx" ON "ReturnLine"("invoiceLineId");

-- CreateIndex
CREATE INDEX "ReturnSerial_returnLineId_idx" ON "ReturnSerial"("returnLineId");

-- CreateIndex
CREATE INDEX "ReturnSerial_serialUnitId_idx" ON "ReturnSerial"("serialUnitId");
