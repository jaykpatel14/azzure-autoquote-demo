-- Add the role tiers required by the backend prompt.
ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'OWNER';
ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'ESTIMATOR';
ALTER TYPE "MembershipRole" ADD VALUE IF NOT EXISTS 'VIEWER';
