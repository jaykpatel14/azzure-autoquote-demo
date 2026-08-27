INSERT INTO "Plan" (
  "id",
  "code",
  "name",
  "monthlyPriceCents",
  "monthlyLimit",
  "isConfigurable",
  "stripeProductId",
  "stripePriceId"
) VALUES
  ('plan_starter', 'starter', 'Starter', 9900, 300, false, NULL, NULL),
  ('plan_professional', 'professional', 'Professional', 19900, 1200, false, NULL, NULL),
  ('plan_enterprise', 'enterprise', 'Enterprise', 29900, 2500, true, NULL, NULL)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "monthlyPriceCents" = EXCLUDED."monthlyPriceCents",
  "monthlyLimit" = EXCLUDED."monthlyLimit",
  "isConfigurable" = EXCLUDED."isConfigurable",
  "stripeProductId" = EXCLUDED."stripeProductId",
  "stripePriceId" = EXCLUDED."stripePriceId";

INSERT INTO "Company" (
  "id",
  "name",
  "slug",
  "logoUrl",
  "quoteSequence",
  "accountStatus",
  "pricingTier",
  "ckCustomerVerified",
  "ckCustomerVerifiedAt",
  "approvedAt",
  "updatedAt"
) VALUES (
  'company_demo_jewelry',
  'Demo Jewelry',
  'demo-jewelry',
  NULL,
  0,
  'APPROVED',
  'TIER_2',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "slug" = EXCLUDED."slug",
  "logoUrl" = EXCLUDED."logoUrl",
  "quoteSequence" = EXCLUDED."quoteSequence",
  "accountStatus" = EXCLUDED."accountStatus",
  "pricingTier" = EXCLUDED."pricingTier",
  "ckCustomerVerified" = EXCLUDED."ckCustomerVerified",
  "ckCustomerVerifiedAt" = EXCLUDED."ckCustomerVerifiedAt",
  "approvedAt" = EXCLUDED."approvedAt",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "PricingProfile" (
  "id",
  "companyId",
  "goldSpotPerOz",
  "platinumSpotPerOz",
  "silverSpotPerOz",
  "cadCharge",
  "centerSettingPerCarat",
  "sideSettingPerStone",
  "sellingMarginDivisor",
  "finalMultiplier"
) VALUES (
  'pricingprofile_demo_jewelry',
  'company_demo_jewelry',
  4500,
  2000,
  100,
  25,
  15,
  3,
  0.70,
  2
)
ON CONFLICT ("companyId") DO UPDATE SET
  "companyId" = EXCLUDED."companyId",
  "goldSpotPerOz" = EXCLUDED."goldSpotPerOz",
  "platinumSpotPerOz" = EXCLUDED."platinumSpotPerOz",
  "silverSpotPerOz" = EXCLUDED."silverSpotPerOz",
  "cadCharge" = EXCLUDED."cadCharge",
  "centerSettingPerCarat" = EXCLUDED."centerSettingPerCarat",
  "sideSettingPerStone" = EXCLUDED."sideSettingPerStone",
  "sellingMarginDivisor" = EXCLUDED."sellingMarginDivisor",
  "finalMultiplier" = EXCLUDED."finalMultiplier";

INSERT INTO "User" (
  "id",
  "email",
  "name",
  "passwordHash",
  "emailVerifiedAt",
  "sessionVersion",
  "updatedAt"
) VALUES
  (
    'user_demo_owner',
    'owner@demojewelry.test',
    'Demo Owner',
    '7dd34c8cd885790b56c89a4d4eda22dd:f4b1ded26c019d2a327c084e13437ec8041f6e6ddfbf67c88f9b4739ebbbfd7327e768e666b3a25a31d4d8f761af3688e8db7b021e525b6ce2b4904b4dabbd83',
    TIMESTAMP '2026-07-01 00:00:00+00',
    0,
    CURRENT_TIMESTAMP
  ),
  (
    'user_demo_acme',
    'test@acme.com',
    'Demo User',
    'e670f7a82b393545024525be3c5ec092:09c6f41bf0be0ab16576dd40fc454565ab2600d759323aa9663767d0cbe85837bd6d4dfd0b6ff7e03c8295c0cec35d1f5fb646264fa85d5701d7074296cd109d',
    TIMESTAMP '2026-07-01 00:00:00+00',
    0,
    CURRENT_TIMESTAMP
  ),
  (
    'user_internal_admin',
    'admin@azzure.com',
    'Azzure Admin',
    '7603d10c39caf55e3d04af208ac5ea9b:cfd932f709951629734f03cffa662d523baf420851b82b5486a3acb09f848def7a3b12ad19280d6252dc3611125505388288c50c363b07ed8a484d0fa6527ded',
    TIMESTAMP '2026-07-01 00:00:00+00',
    0,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("id") DO UPDATE SET
  "email" = EXCLUDED."email",
  "name" = EXCLUDED."name",
  "passwordHash" = EXCLUDED."passwordHash",
  "emailVerifiedAt" = EXCLUDED."emailVerifiedAt",
  "sessionVersion" = EXCLUDED."sessionVersion",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "Membership" (
  "id",
  "role",
  "companyId",
  "userId"
) VALUES
  ('membership_demo_owner', 'CUSTOMER', 'company_demo_jewelry', 'user_demo_owner'),
  ('membership_demo_acme', 'CUSTOMER', 'company_demo_jewelry', 'user_demo_acme'),
  ('membership_internal_admin', 'OWNER', 'company_demo_jewelry', 'user_internal_admin')
ON CONFLICT ("companyId","userId") DO UPDATE SET
  "role" = EXCLUDED."role";

INSERT INTO "Subscription" (
  "id",
  "companyId",
  "planId",
  "status",
  "currentPeriodStart",
  "currentPeriodEnd",
  "cancelAtPeriodEnd",
  "overageEnabled",
  "overagePriceCents"
) VALUES (
  'subscription_demo_jewelry',
  'company_demo_jewelry',
  'plan_enterprise',
  'ACTIVE',
  date_trunc('month', CURRENT_TIMESTAMP),
  date_trunc('month', CURRENT_TIMESTAMP) + INTERVAL '1 month',
  false,
  false,
  NULL
)
ON CONFLICT ("companyId") DO UPDATE SET
  "planId" = EXCLUDED."planId",
  "status" = EXCLUDED."status",
  "currentPeriodStart" = EXCLUDED."currentPeriodStart",
  "currentPeriodEnd" = EXCLUDED."currentPeriodEnd",
  "cancelAtPeriodEnd" = EXCLUDED."cancelAtPeriodEnd",
  "overageEnabled" = EXCLUDED."overageEnabled",
  "overagePriceCents" = EXCLUDED."overagePriceCents";

INSERT INTO "UsagePeriod" (
  "id",
  "companyId",
  "periodStart",
  "periodEnd",
  "limit",
  "used",
  "reserved"
) VALUES (
  'usageperiod_demo_jewelry',
  'company_demo_jewelry',
  date_trunc('month', CURRENT_TIMESTAMP),
  date_trunc('month', CURRENT_TIMESTAMP) + INTERVAL '1 month',
  2500,
  0,
  0
)
ON CONFLICT ("id") DO UPDATE SET
  "companyId" = EXCLUDED."companyId",
  "periodStart" = EXCLUDED."periodStart",
  "periodEnd" = EXCLUDED."periodEnd",
  "limit" = EXCLUDED."limit",
  "used" = EXCLUDED."used",
  "reserved" = EXCLUDED."reserved";

INSERT INTO "GemstoneRate" (
  "id",
  "stone",
  "displayName",
  "commercialLowPerCt",
  "commercialHighPerCt",
  "fineLowPerCt",
  "fineHighPerCt",
  "premiumLowPerCt",
  "premiumHighPerCt",
  "sources",
  "refreshedAt",
  "isActive"
) VALUES
  ('gem_ruby', 'ruby', 'Ruby (Corundum)', 100, 400, 800, 2500, 3000, 10000, 'GIA market report; Pricescope trade data', CURRENT_TIMESTAMP, true),
  ('gem_sapphire', 'sapphire', 'Sapphire (Corundum)', 100, 500, 800, 3000, 2500, 12000, 'GIA market report; Pricescope trade data', CURRENT_TIMESTAMP, true),
  ('gem_emerald', 'emerald', 'Emerald (Beryl)', 200, 1000, 1000, 5000, 4000, 20000, 'GIA market report; trade data', CURRENT_TIMESTAMP, true),
  ('gem_tsavorite', 'tsavorite', 'Tsavorite (Garnet)', 300, 1200, 1200, 6000, 5000, 20000, 'GIA market report; trade data', CURRENT_TIMESTAMP, true),
  ('gem_alexandrite', 'alexandrite', 'Alexandrite (Chrysoberyl)', 500, 3000, 3000, 15000, 12000, 50000, 'GIA market report; trade data', CURRENT_TIMESTAMP, true),
  ('gem_tanzanite', 'tanzanite', 'Tanzanite (Zoisite)', 150, 800, 800, 4000, 3000, 12000, 'GIA market report; trade data', CURRENT_TIMESTAMP, true),
  ('gem_aquamarine', 'aquamarine', 'Aquamarine (Beryl)', 50, 300, 300, 1200, 1000, 5000, 'GIA market report; trade data', CURRENT_TIMESTAMP, true),
  ('gem_amethyst', 'amethyst', 'Amethyst (Quartz)', 20, 100, 100, 500, 400, 2000, 'GIA market report; trade data', CURRENT_TIMESTAMP, true),
  ('gem_peridot', 'peridot', 'Peridot (Olivine)', 50, 250, 250, 1000, 800, 4000, 'GIA market report; trade data', CURRENT_TIMESTAMP, true),
  ('gem_spinel', 'spinel', 'Spinel', 200, 1000, 1000, 5000, 4000, 18000, 'GIA market report; trade data', CURRENT_TIMESTAMP, true),
  ('gem_tourmaline', 'tourmaline', 'Tourmaline', 50, 400, 400, 2000, 1500, 8000, 'GIA market report; trade data', CURRENT_TIMESTAMP, true),
  ('gem_opal', 'opal', 'Opal', 50, 300, 300, 1500, 1000, 5000, 'GIA market report; trade data', CURRENT_TIMESTAMP, true)
ON CONFLICT ("stone") DO UPDATE SET
  "displayName" = EXCLUDED."displayName",
  "commercialLowPerCt" = EXCLUDED."commercialLowPerCt",
  "commercialHighPerCt" = EXCLUDED."commercialHighPerCt",
  "fineLowPerCt" = EXCLUDED."fineLowPerCt",
  "fineHighPerCt" = EXCLUDED."fineHighPerCt",
  "premiumLowPerCt" = EXCLUDED."premiumLowPerCt",
  "premiumHighPerCt" = EXCLUDED."premiumHighPerCt",
  "sources" = EXCLUDED."sources",
  "refreshedAt" = EXCLUDED."refreshedAt",
  "isActive" = EXCLUDED."isActive";
