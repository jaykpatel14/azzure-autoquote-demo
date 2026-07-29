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
