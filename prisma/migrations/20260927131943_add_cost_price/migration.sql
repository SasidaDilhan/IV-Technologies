-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_InvoiceLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "invoiceId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "costPrice" INTEGER NOT NULL DEFAULT 0,
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
INSERT INTO "new_InvoiceLine" ("createdAt", "id", "invoiceId", "itemId", "lineDiscountType", "lineDiscountValue", "note", "quantity", "sortOrder", "unitPrice", "updatedAt") SELECT "createdAt", "id", "invoiceId", "itemId", "lineDiscountType", "lineDiscountValue", "note", "quantity", "sortOrder", "unitPrice", "updatedAt" FROM "InvoiceLine";
DROP TABLE "InvoiceLine";
ALTER TABLE "new_InvoiceLine" RENAME TO "InvoiceLine";
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");
CREATE INDEX "InvoiceLine_itemId_idx" ON "InvoiceLine"("itemId");
CREATE TABLE "new_Item" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "itemCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "barcode" TEXT,
    "unitPrice" INTEGER NOT NULL,
    "costPrice" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "tracksSerials" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Item" ("barcode", "createdAt", "description", "id", "itemCode", "name", "tracksSerials", "unitPrice", "updatedAt") SELECT "barcode", "createdAt", "description", "id", "itemCode", "name", "tracksSerials", "unitPrice", "updatedAt" FROM "Item";
DROP TABLE "Item";
ALTER TABLE "new_Item" RENAME TO "Item";
CREATE UNIQUE INDEX "Item_itemCode_key" ON "Item"("itemCode");
CREATE UNIQUE INDEX "Item_barcode_key" ON "Item"("barcode");
CREATE INDEX "Item_name_idx" ON "Item"("name");
CREATE TABLE "new_QuoteLine" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "quotationId" INTEGER NOT NULL,
    "itemId" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "costPrice" INTEGER NOT NULL DEFAULT 0,
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
INSERT INTO "new_QuoteLine" ("createdAt", "id", "itemId", "lineDiscountType", "lineDiscountValue", "note", "quantity", "quotationId", "sortOrder", "unitPrice", "updatedAt") SELECT "createdAt", "id", "itemId", "lineDiscountType", "lineDiscountValue", "note", "quantity", "quotationId", "sortOrder", "unitPrice", "updatedAt" FROM "QuoteLine";
DROP TABLE "QuoteLine";
ALTER TABLE "new_QuoteLine" RENAME TO "QuoteLine";
CREATE INDEX "QuoteLine_quotationId_idx" ON "QuoteLine"("quotationId");
CREATE INDEX "QuoteLine_itemId_idx" ON "QuoteLine"("itemId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
