-- Prioritas 2 Labtech: tender (checklist, TKDN), jaminan, agen & komisi, nota kredit, target penjualan (idempotent).
-- Dijalankan lewat: node scripts/apply-sql.cjs prisma/sql/2026-11-10-sales-p2.sql

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "agentId" TEXT;

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "tkdnCertNo" TEXT,
ADD COLUMN IF NOT EXISTS "tkdnPercent" DOUBLE PRECISION;

ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "tenderChecklistJson" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN IF NOT EXISTS "tkdnRequired" DOUBLE PRECISION;

ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "agentId" TEXT,
ADD COLUMN IF NOT EXISTS "commissionPaidAt" TEXT,
ADD COLUMN IF NOT EXISTS "commissionPaidRef" TEXT,
ADD COLUMN IF NOT EXISTS "commissionPercent" DOUBLE PRECISION;

CREATE TABLE IF NOT EXISTS "CreditNote" (
    "id" TEXT NOT NULL,
    "creditNoteNo" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "taxAmount" DOUBLE PRECISION NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "paymentId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "CreditNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Guarantee" (
    "id" TEXT NOT NULL,
    "guaranteeNo" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "issueDate" TEXT NOT NULL,
    "expiryDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "customerId" TEXT NOT NULL,
    "opportunityId" TEXT,
    "salesOrderId" TEXT,
    "fileUrl" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "historyJson" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "Guarantee_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Agent" (
    "id" TEXT NOT NULL,
    "agentNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "countries" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "commissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "notes" TEXT,
    "createdAt" TEXT NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SalesTarget" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "salesName" TEXT NOT NULL DEFAULT '',
    "amount" DOUBLE PRECISION NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TEXT,

    CONSTRAINT "SalesTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CreditNote_creditNoteNo_key" ON "CreditNote"("creditNoteNo");

CREATE UNIQUE INDEX IF NOT EXISTS "Agent_agentNo_key" ON "Agent"("agentNo");

CREATE UNIQUE INDEX IF NOT EXISTS "SalesTarget_year_month_salesName_key" ON "SalesTarget"("year", "month", "salesName");

DO $$ BEGIN ALTER TABLE "Customer" ADD CONSTRAINT "Customer_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "Guarantee" ADD CONSTRAINT "Guarantee_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "Guarantee" ADD CONSTRAINT "Guarantee_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN ALTER TABLE "Guarantee" ADD CONSTRAINT "Guarantee_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
