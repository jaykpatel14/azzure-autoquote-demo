-- Persist the pricing inputs and result used when a quote is created. These
-- fields already exist in the Prisma model and are nullable so existing quotes
-- remain valid after this migration is deployed.
ALTER TABLE "Quote"
ADD COLUMN "makingPrice" DECIMAL(65,30),
ADD COLUMN "pricingTierSnapshot" "PricingTier",
ADD COLUMN "tierDivisorSnapshot" DECIMAL(65,30),
ADD COLUMN "estimatedSellingPrice" DECIMAL(65,30);
