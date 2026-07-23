import { MembershipRole } from "@prisma/client";

export const ROLE_RANK: Record<MembershipRole, number> = {
  VIEWER: 1,
  ESTIMATOR: 2,
  ADMIN: 3,
  OWNER: 4
};

export function hasMinimumRole(role: MembershipRole, minimumRole: MembershipRole) {
  return ROLE_RANK[role] >= ROLE_RANK[minimumRole];
}

export function assertCompanyOwnership<T extends { companyId: string }>(
  record: T | null,
  companyId: string,
  label = "Record"
): T {
  if (!record) {
    throw new Error(`${label} not found.`);
  }

  if (record.companyId !== companyId) {
    throw new Error(`${label} does not belong to this company.`);
  }

  return record;
}
