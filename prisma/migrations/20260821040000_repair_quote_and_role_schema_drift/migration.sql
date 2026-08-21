-- This migration was never generated when these schema.prisma changes were
-- made (they were applied to dev databases via `prisma db push` instead of
-- `prisma migrate dev`), so any environment that only ever ran
-- `prisma migrate deploy` — e.g. a fresh Proxmox/Docker deploy — never
-- received these columns. That caused hard SQL errors on every Quote read
-- and write there ("column Quote.customerEmail does not exist").
-- This migration brings the migration history back in sync with schema.prisma.

-- AlterEnum
ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'MANUFACTURING';

-- DropIndex
DROP INDEX IF EXISTS "Order_companyId_submittedAt_idx";

-- AlterTable
ALTER TABLE "AppSetting" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Quote"
  ADD COLUMN IF NOT EXISTS "customerEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "customerPhone" TEXT,
  ALTER COLUMN "pdfContentType" DROP NOT NULL,
  ALTER COLUMN "makingPrice" SET DATA TYPE DOUBLE PRECISION;
