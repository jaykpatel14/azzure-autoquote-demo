import { isIP } from "node:net";

export function normalizeIpAddress(value: string | null | undefined) {
  if (!value) return null;

  let candidate = value.split(",")[0]?.trim().toLowerCase() || "";
  if (!candidate || candidate === "unknown") return null;

  const bracketedIpv6 = candidate.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketedIpv6) {
    candidate = bracketedIpv6[1];
  }

  const ipv4WithPort = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) {
    candidate = ipv4WithPort[1];
  }

  if (candidate.startsWith("::ffff:") && isIP(candidate.slice(7)) === 4) {
    candidate = candidate.slice(7);
  }

  return isIP(candidate) ? candidate : null;
}
