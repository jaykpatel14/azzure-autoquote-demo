import { createHash, randomBytes } from "node:crypto";

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenExpiresIn(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
