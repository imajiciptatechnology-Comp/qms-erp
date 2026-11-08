-- Modul Labtech: Contract & Shipping, Training & Customer Service (idempotent).
-- Sudah dijalankan ke Supabase pada 2026-11-08 lewat Prisma Client karena prisma db push
-- menggantung di session pooler. Aman dijalankan ulang.

ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "tenderNo" TEXT;

ALTER TABLE "Opportunity" ADD COLUMN IF NOT EXISTS "tenderDeadline" TEXT;

ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "productionStatus" TEXT NOT NULL DEFAULT 'Not Started';

ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "productionStart" TEXT;

ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "productionTarget" TEXT;

ALTER TABLE "SalesOrder" ADD COLUMN IF NOT EXISTS "productionNotes" TEXT;

CREATE TABLE IF NOT EXISTS "SalesShipment" (
    "id" TEXT NOT NULL,
    "shipmentNo" TEXT NOT NULL,
    "salesOrderId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "incoterm" TEXT,
    "mode" TEXT NOT NULL,
    "forwarder" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'Batam',
    "destination" TEXT NOT NULL,
    "etd" TEXT,
    "eta" TEXT,
    "awbNo" TEXT,
    "vessel" TEXT,
    "containerNo" TEXT,
    "packagesJson" TEXT NOT NULL DEFAULT '[]',
    "docsJson" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL,
    "exceptionStatus" TEXT,
    "exceptionReason" TEXT,
    "exceptionRequestedBy" TEXT,
    "exceptionDecidedBy" TEXT,
    "exceptionDecidedAt" TEXT,
    "exceptionNote" TEXT,
    "shippedAt" TEXT,
    "arrivedAt" TEXT,
    "receivedBy" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "historyJson" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "SalesShipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ServiceJob" (
    "id" TEXT NOT NULL,
    "jobNo" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "customerId" TEXT NOT NULL,
    "shipmentId" TEXT,
    "type" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'Onsite',
    "location" TEXT,
    "startDate" TEXT,
    "endDate" TEXT,
    "technicians" TEXT,
    "trainerName" TEXT,
    "topics" TEXT,
    "status" TEXT NOT NULL,
    "checklistJson" TEXT NOT NULL DEFAULT '[]',
    "participantsJson" TEXT NOT NULL DEFAULT '[]',
    "feedbackScore" INTEGER,
    "feedbackNote" TEXT,
    "bastNo" TEXT,
    "bastDate" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TEXT,
    "decisionNote" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "historyJson" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "ServiceJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ServiceTicket" (
    "id" TEXT NOT NULL,
    "ticketNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "productName" TEXT,
    "serialNumber" TEXT,
    "underWarranty" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "assignedTo" TEXT,
    "reportedBy" TEXT,
    "contactPhone" TEXT,
    "responseDueAt" TEXT NOT NULL,
    "firstResponseAt" TEXT,
    "resolvedAt" TEXT,
    "resolution" TEXT,
    "complaintId" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TEXT NOT NULL,
    "historyJson" TEXT NOT NULL DEFAULT '[]',

    CONSTRAINT "ServiceTicket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SalesShipment_shipmentNo_key" ON "SalesShipment"("shipmentNo");

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceJob_jobNo_key" ON "ServiceJob"("jobNo");

CREATE UNIQUE INDEX IF NOT EXISTS "ServiceTicket_ticketNo_key" ON "ServiceTicket"("ticketNo");

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesShipment_salesOrderId_fkey') THEN ALTER TABLE "SalesShipment" ADD CONSTRAINT "SalesShipment_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SalesShipment_customerId_fkey') THEN ALTER TABLE "SalesShipment" ADD CONSTRAINT "SalesShipment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ServiceJob_salesOrderId_fkey') THEN ALTER TABLE "ServiceJob" ADD CONSTRAINT "ServiceJob_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ServiceJob_customerId_fkey') THEN ALTER TABLE "ServiceJob" ADD CONSTRAINT "ServiceJob_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ServiceJob_shipmentId_fkey') THEN ALTER TABLE "ServiceJob" ADD CONSTRAINT "ServiceJob_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "SalesShipment"("id") ON DELETE SET NULL ON UPDATE CASCADE; END IF; END $$;

DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ServiceTicket_customerId_fkey') THEN ALTER TABLE "ServiceTicket" ADD CONSTRAINT "ServiceTicket_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE; END IF; END $$;
