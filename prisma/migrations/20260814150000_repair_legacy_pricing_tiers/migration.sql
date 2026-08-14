-- Approved tenants must always have a tier. Tier 2 is the neutral legacy default.
UPDATE "Company"
SET "pricingTier" = 'TIER_2',
    "tierChangedAt" = COALESCE("tierChangedAt", CURRENT_TIMESTAMP)
WHERE "accountStatus" = 'APPROVED' AND "pricingTier" IS NULL;

-- Preserve legacy customer totals while reconstructing the missing cost/tier snapshots.
UPDATE "Quote" AS q
SET "makingPrice" = q."estimatedPrice" *
      CASE c."pricingTier" WHEN 'TIER_1' THEN 0.60 WHEN 'TIER_2' THEN 0.70 ELSE 0.80 END / 2,
    "pricingTierSnapshot" = c."pricingTier",
    "tierDivisorSnapshot" = CASE c."pricingTier" WHEN 'TIER_1' THEN 0.60 WHEN 'TIER_2' THEN 0.70 ELSE 0.80 END,
    "estimatedSellingPrice" = COALESCE(q."estimatedSellingPrice", q."estimatedPrice")
FROM "Company" AS c
WHERE q."companyId" = c.id
  AND c."accountStatus" = 'APPROVED'
  AND q."makingPrice" IS NULL;

UPDATE "Quote" AS q
SET "pricingTierSnapshot" = COALESCE(q."pricingTierSnapshot", c."pricingTier"),
    "tierDivisorSnapshot" = COALESCE(q."tierDivisorSnapshot",
      CASE COALESCE(q."pricingTierSnapshot", c."pricingTier") WHEN 'TIER_1' THEN 0.60 WHEN 'TIER_2' THEN 0.70 ELSE 0.80 END),
    "estimatedSellingPrice" = COALESCE(q."estimatedSellingPrice", q."estimatedPrice")
FROM "Company" AS c
WHERE q."companyId" = c.id
  AND c."accountStatus" = 'APPROVED';
