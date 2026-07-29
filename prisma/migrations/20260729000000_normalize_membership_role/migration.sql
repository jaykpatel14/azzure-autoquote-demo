-- Normalize the membership role enum to the single customer access model.
-- Existing role values are mapped to CUSTOMER so previously seeded or migrated
-- databases continue to work after the app's access model simplification.

BEGIN;

CREATE TYPE "MembershipRole_new" AS ENUM ('CUSTOMER');

ALTER TABLE "Membership" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "Membership"
  ALTER COLUMN "role" TYPE "MembershipRole_new"
  USING ('CUSTOMER'::"MembershipRole_new");

ALTER TYPE "MembershipRole" RENAME TO "MembershipRole_old";
ALTER TYPE "MembershipRole_new" RENAME TO "MembershipRole";

ALTER TABLE "Membership" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';

DROP TYPE "MembershipRole_old";

COMMIT;
