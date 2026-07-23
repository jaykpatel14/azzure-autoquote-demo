export function canReserveUsage(usage: {
  limit: number;
  used: number;
  reserved: number;
}) {
  return usage.used + usage.reserved < usage.limit;
}
