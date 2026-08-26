import { createHash, randomBytes, randomInt } from "node:crypto";

export function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function generateOtp(): string {
  return randomInt(100000, 1000000).toString();
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokenExpiresIn(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
