UPDATE "Company"
SET "customerMarginPct" = 50
WHERE "customerMarginPct" < 50;

UPDATE "Subscription"
SET "planId" = 'plan_enterprise'
WHERE "planId" = 'plan_ultra';

UPDATE "Subscription"
SET "pendingPlanId" = 'plan_enterprise'
WHERE "pendingPlanId" = 'plan_ultra';

DELETE FROM "Plan" WHERE "id" = 'plan_ultra' OR "code" = 'ultra';
