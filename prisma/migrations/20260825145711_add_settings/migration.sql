-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "businessName" TEXT NOT NULL DEFAULT 'IV Technology',
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "regNo" TEXT,
    "logoDataUrl" TEXT,
    "defaultTerms" TEXT NOT NULL DEFAULT '',
    "quotePrefix" TEXT NOT NULL DEFAULT '',
    "quoteNextNumber" INTEGER NOT NULL DEFAULT 1,
    "quoteNumberPadding" INTEGER NOT NULL DEFAULT 6,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV-',
    "invoiceNextNumber" INTEGER NOT NULL DEFAULT 1,
    "invoiceNumberPadding" INTEGER NOT NULL DEFAULT 6,
    "updatedAt" DATETIME NOT NULL
);
