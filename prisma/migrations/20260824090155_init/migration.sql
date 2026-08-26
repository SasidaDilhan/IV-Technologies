-- CreateTable
CREATE TABLE "Customer" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "barcode" TEXT,
    "unitPrice" INTEGER NOT NULL,
    "tracksSerials" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SerialUnit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serialNumber" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_stock',
    "quoteLineId" INTEGER,
    "invoiceLineId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SerialUnit_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SerialUnit_quoteLineId_fkey" FOREIGN KEY ("quoteLineId") REFERENCES "QuoteLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "SerialUnit_invoiceLineId_fkey" FOREIGN KEY ("invoiceLineId") REFERENCES "InvoiceLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Quotation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quoteNo" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "issueDate" DATETIME NOT NULL,
    "validUntil" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "billDiscountType" TEXT NOT NULL DEFAULT 'fixed',
    "billDiscountValue" INTEGER NOT NULL DEFAULT 0,
    "termsText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Quotation_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quotationId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "lineDiscountType" TEXT NOT NULL DEFAULT 'fixed',
    "lineDiscountValue" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QuoteLine_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QuoteLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "invoiceNo" TEXT NOT NULL,
    "customerId" INTEGER NOT NULL,
    "quotationId" INTEGER,
    "issueDate" DATETIME NOT NULL,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "billDiscountType" TEXT NOT NULL DEFAULT 'fixed',
    "billDiscountValue" INTEGER NOT NULL DEFAULT 0,
    "advanceAmount" INTEGER NOT NULL DEFAULT 0,
    "termsText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Invoice_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "Quotation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "invoiceId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "lineDiscountType" TEXT NOT NULL DEFAULT 'fixed',
    "lineDiscountValue" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "InvoiceLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "invoiceId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reference" TEXT,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Item_itemCode_key" ON "Item"("itemCode");

-- CreateIndex
CREATE UNIQUE INDEX "Item_barcode_key" ON "Item"("barcode");

-- CreateIndex
CREATE INDEX "Item_name_idx" ON "Item"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SerialUnit_serialNumber_key" ON "SerialUnit"("serialNumber");

-- CreateIndex
CREATE INDEX "SerialUnit_itemId_idx" ON "SerialUnit"("itemId");

-- CreateIndex
CREATE INDEX "SerialUnit_status_idx" ON "SerialUnit"("status");

-- CreateIndex
CREATE INDEX "SerialUnit_quoteLineId_idx" ON "SerialUnit"("quoteLineId");

-- CreateIndex
CREATE INDEX "SerialUnit_invoiceLineId_idx" ON "SerialUnit"("invoiceLineId");

-- CreateIndex
CREATE UNIQUE INDEX "Quotation_quoteNo_key" ON "Quotation"("quoteNo");

-- CreateIndex
CREATE INDEX "Quotation_customerId_idx" ON "Quotation"("customerId");

-- CreateIndex
CREATE INDEX "Quotation_status_idx" ON "Quotation"("status");

-- CreateIndex
CREATE INDEX "Quotation_issueDate_idx" ON "Quotation"("issueDate");

-- CreateIndex
CREATE INDEX "QuoteLine_quotationId_idx" ON "QuoteLine"("quotationId");

-- CreateIndex
CREATE INDEX "QuoteLine_itemId_idx" ON "QuoteLine"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "Invoice"("invoiceNo");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_quotationId_key" ON "Invoice"("quotationId");

-- CreateIndex
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_issueDate_idx" ON "Invoice"("issueDate");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceLine_itemId_idx" ON "InvoiceLine"("itemId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_paidAt_idx" ON "Payment"("paidAt");
