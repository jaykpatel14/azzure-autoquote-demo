-- Account approval and pricing controls were added to the Prisma schema after
-- the initial Company migration. Preserve access for companies that already
-- exist, while keeping new companies pending until an administrator approves
-- them.
CREATE TYPE "AccountStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'SUSPENDED');
CREATE TYPE "PricingTier" AS ENUM ('TIER_1', 'TIER_2', 'TIER_3');

ALTER TABLE "Company"
ADD COLUMN "accountStatus" "AccountStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN "pricingTier" "PricingTier",
ADD COLUMN "approvedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "approvedBy" TEXT,
ADD COLUMN "tierChangedAt" TIMESTAMP(3),
ADD COLUMN "tierChangedBy" TEXT,
ADD COLUMN "suspendedAt" TIMESTAMP(3),
ADD COLUMN "suspendedReason" TEXT,
ADD COLUMN "adminNotes" TEXT;

ALTER TABLE "Company"
ALTER COLUMN "accountStatus" SET DEFAULT 'PENDING_APPROVAL',
ALTER COLUMN "approvedAt" DROP DEFAULT;
