-- Add CK verification fields to Company
ALTER TABLE "Company"
ADD COLUMN IF NOT EXISTS "ckCustomerVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "ckCustomerVerifiedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "ckCustomerVerifiedBy" TEXT,
ADD COLUMN IF NOT EXISTS "ckCustomerRevokedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "ckCustomerNotes" TEXT;

-- Extend order status enum for the CK workflow
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CK_ORDER_PLACED';
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

-- Add CK order tracking fields
ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "ckOrderId" TEXT,
ADD COLUMN IF NOT EXISTS "ckOrderUrl" TEXT,
ADD COLUMN IF NOT EXISTS "ckOrderPlacedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "ckOrderPlacedBy" TEXT,
ADD COLUMN IF NOT EXISTS "completedBy" TEXT,
ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "cancelledBy" TEXT,
ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Order_ckOrderId_key" ON "Order"("ckOrderId");
CREATE INDEX IF NOT EXISTS "Order_companyId_submittedAt_idx" ON "Order"("companyId", "submittedAt");

-- Workflow timeline events
CREATE TABLE IF NOT EXISTS "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "note" TEXT,
    "internalNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT NOT NULL,
    "isAdminAction" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

ALTER TABLE "OrderEvent"
ADD CONSTRAINT "OrderEvent_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
