import { promises as dns } from "node:dns";
import { validateEmail, type EmailValidationResult } from "./email-validation";

/**
 * Known disposable and temporary MX host patterns.
 * Even if a disposable service uses a custom vanity domain, its MX record will point to these hostnames.
 */
const DISPOSABLE_MX_PATTERNS = [
  "mailinator.com",
  "guerrillamail",
  "sharklasers.com",
  "grr.la",
  "trashmail",
  "dispostable",
  "tempmail",
  "temp-mail",
  "yopmail",
  "mytemp.email",
  "inboxkitten",
  "maildrop.cc",
  "burnermail",
  "fakeinbox",
  "crazymailing",
  "mohmal",
  "dropmail",
  "throwawaymail"
];

export interface ValidateEmailMxOptions {
  timeoutMs?: number;
}

/**
 * Asynchronously validates that an email:
 * 1. Passes standard syntax, length, and static blocklist checks.
 * 2. Has an existing domain that resolves with valid DNS Mail Exchange (MX) records.
 * 3. Does not route through known disposable or temporary mail exchange hosts.
 */
export async function validateEmailDomainMx(
  email: string | null | undefined,
  options?: ValidateEmailMxOptions
): Promise<EmailValidationResult> {
  const basic = validateEmail(email);
  if (!basic.valid) {
    return basic;
  }

  const parts = basic.normalizedEmail!.split("@");
  if (parts.length !== 2) {
    return { valid: false, error: "Please enter a valid email address." };
  }

  const domain = parts[1].toLowerCase();
  const timeoutMs = options?.timeoutMs ?? 3500;

  try {
    const resolveMxPromise = dns.resolveMx(domain);
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("DNS_TIMEOUT")), timeoutMs)
    );

    const mxRecords = await Promise.race([resolveMxPromise, timeoutPromise]);

    if (!Array.isArray(mxRecords) || mxRecords.length === 0) {
      // Some domains don't configure explicit MX records but rely on an A/AAAA record fallback (RFC 5321)
      try {
        const aRecords = await dns.resolve4(domain);
        if (!aRecords || aRecords.length === 0) {
          return {
            valid: false,
            error: `The email domain '@${domain}' does not have active mail exchange (MX) servers and cannot receive email. Please enter a genuine email address.`
          };
        }
      } catch {
        return {
          valid: false,
          error: `The email domain '@${domain}' does not have active mail exchange (MX) servers and cannot receive email. Please enter a genuine email address.`
        };
      }
    } else {
      // Check if any MX exchange hostname matches known disposable providers
      for (const record of mxRecords) {
        const exchange = (record.exchange || "").toLowerCase();
        for (const pattern of DISPOSABLE_MX_PATTERNS) {
          if (exchange.includes(pattern)) {
            return {
              valid: false,
              error: `The email domain '@${domain}' uses a temporary or disposable mail exchanger (${exchange}) which is not permitted. Please provide a genuine business email.`
            };
          }
        }
      }
    }

    return { valid: true, normalizedEmail: basic.normalizedEmail };
  } catch (error: any) {
    if (
      error?.code === "ENOTFOUND" ||
      error?.code === "ENODATA" ||
      error?.code === "NXDOMAIN" ||
      error?.code === "EREFUSED"
    ) {
      return {
        valid: false,
        error: `The email domain '@${domain}' does not exist or has no active mail servers. Please enter a genuine email address.`
      };
    }

    // In case of network timeout or unexpected resolution errors, log warning and allow graceful fallback
    if (error?.message === "DNS_TIMEOUT") {
      console.warn(`[validateEmailDomainMx] DNS MX lookup timed out for domain: ${domain}`);
      return { valid: true, normalizedEmail: basic.normalizedEmail };
    }

    console.warn(`[validateEmailDomainMx] DNS MX resolution warning for ${domain}:`, error?.message || error);
    return { valid: true, normalizedEmail: basic.normalizedEmail };
  }
}
