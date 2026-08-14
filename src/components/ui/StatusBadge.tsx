import { Badge } from "./Badge";

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();

  if (normalized.includes("draft")) return <Badge variant="draft">{status}</Badge>;
  if (normalized.includes("sent")) return <Badge variant="sent">{status}</Badge>;
  if (normalized.includes("order")) return <Badge variant="ordered">{status}</Badge>;
  if (normalized.includes("expire")) return <Badge variant="expired">{status}</Badge>;

  return <Badge variant="neutral">{status}</Badge>;
}

