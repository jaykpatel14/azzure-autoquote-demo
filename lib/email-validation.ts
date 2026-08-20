/**
 * Email validation utility to reject disposable, temporary, placeholder, and dummy email addresses.
 * Protects both B2B jeweler accounts and B2C showroom / quote customer databases.
 */

// ── Disposable & Temporary Email Domains ──
const DISPOSABLE_DOMAINS = new Set([
  // Popular throwaway / temporary inboxes
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "guerrillamail.biz",
  "guerrillamail.de",
  "guerrillamail.net",
  "guerrillamail.org",
  "grr.la",
  "sharklasers.com",
  "10minutemail.com",
  "10minutemail.net",
  "10minutemail.org",
  "10minemail.com",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempmail.net",
  "tempmail.ninja",
  "tempmailaddress.com",
  "yopmail.com",
  "yopmail.fr",
  "yopmail.net",
  "trashmail.com",
  "trashmail.net",
  "trashmail.org",
  "trashmail.me",
  "getairmail.com",
  "dispostable.com",
  "fakemailgenerator.com",
  "throwawaymail.com",
  "mohmal.com",
  "crazymailing.com",
  "maildrop.cc",
  "inboxkitten.com",
  "generator.email",
  "emailondeck.com",
  "mytemp.email",
  "tempail.com",
  "burnermail.io",
  "mailnesia.com",
  "nada.ltd",
  "getnada.com",
  "abacusmail.net",
  "inboxbear.com",
  "dropmail.me",
  "tempinbox.com",
  "mytempemail.com",
  "disposablemail.com",
  "instantemailaddress.com",
  "mohmal.im",
  "mohmal.in",
  "fakeinbox.com",
  "armyspy.com",
  "cuvox.de",
  "dayrep.com",
  "fleckens.hu",
  "gustr.com",
  "jourrapide.com",
  "rhyta.com",
  "superrito.com",
  "teleworm.us",
  "einrot.com",
  "harakirimail.com",
  "trash-mail.com",
  "mailcatch.com",
  "deadaddress.com",
  "spambog.com",
  "spam4.me",
  "binkmail.com",
  "bobmail.info",
  "chammy.info",
  "devnullmail.com",
  "letthemeatspam.com",
  "mailinater.com",
  "mintemail.com",
  "sofort-mail.de",
  "spamavert.com",
  "uggsrock.com",
  "zoemail.org",
  "throwawayemailaddress.com",
  "crazymailing.com",
  "tempmailgen.com",
  "throwawayemail.com",
  "tmail.ws",
  "tmpmail.org",
  "tmpmail.net"
]);

// ── Dummy, Placeholder, & Keyboard-Mashing Domains ──
const DUMMY_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "test.org",
  "test.net",
  "testing.com",
  "dummy.com",
  "dummy.org",
  "dummy.net",
  "fake.com",
  "fake.org",
  "fake.net",
  "fakeemail.com",
  "sample.com",
  "sample.org",
  "sample.net",
  "none.com",
  "noemail.com",
  "nomail.com",
  "invalid.com",
  "invalid.org",
  "invalid.net",
  "asdf.com",
  "dsaf.com",
  "asdfg.com",
  "qwerty.com",
  "qwert.com",
  "zxcv.com",
  "abc.com",
  "xyz.com",
  "123.com",
  "1234.com",
  "aaa.com",
  "bbb.com",
  "ccc.com",
  "ddd.com",
  "domain.com",
  "somedomain.com",
  "yourcompany.com",
  "mycompany.com",
  "company.com",
  "email.com",
  "mysite.com",
  "myshop.com",
  "local.host",
  "localhost.com"
]);

// ── Obvious Dummy / Nonsense Usernames ──
const DUMMY_USERNAMES = new Set([
  "test",
  "testing",
  "test1",
  "test2",
  "tester",
  "dummy",
  "fake",
  "fakeuser",
  "sample",
  "asdf",
  "asdfa",
  "asdfasdf",
  "dsaf",
  "dsafa",
  "dsafdsaf",
  "qwerty",
  "qwert",
  "zxcv",
  "1234",
  "12345",
  "123456",
  "none",
  "noemail",
  "nomail",
  "na",
  "n/a",
  "null",
  "undefined",
  "placeholder",
  "abc",
  "xyz",
  "aaa",
  "aaaa",
  "aaaaa"
]);

// ── Standard RFC-compliant strict email format ──
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export type EmailValidationResult = {
  valid: boolean;
  error?: string;
  normalizedEmail?: string;
};

/**
 * Validates whether an email is valid and is not a disposable or dummy address.
 */
export function validateEmail(email: string | null | undefined, options?: { allowEmpty?: boolean }): EmailValidationResult {
  const trimmed = (email ?? "").trim();

  if (!trimmed) {
    if (options?.allowEmpty) {
      return { valid: true, normalizedEmail: "" };
    }
    return { valid: false, error: "Please enter an email address." };
  }

  if (trimmed.length > 254) {
    return { valid: false, error: "Email address is too long (maximum 254 characters)." };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: "Please enter a valid email address." };
  }

  const parts = trimmed.toLowerCase().split("@");
  if (parts.length !== 2) {
    return { valid: false, error: "Please enter a valid email address." };
  }

  const [username, domain] = parts;

  // 1. Validate domain structure and TLD
  const domainParts = domain.split(".");
  if (domainParts.length < 2) {
    return { valid: false, error: "Email domain is invalid." };
  }

  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2 || !/^[a-z]+$/.test(tld)) {
    return { valid: false, error: "Email domain has an invalid top-level domain (TLD)." };
  }

  // Reject reserved / local test TLDs
  if (["test", "example", "invalid", "localhost", "local", "internal"].includes(tld)) {
    return { valid: false, error: "Please enter a real, active email domain." };
  }

  // 2. Reject known disposable email providers
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      valid: false,
      error: "Temporary or disposable email addresses (e.g. mailinator, temp-mail) are not accepted. Please provide a permanent email."
    };
  }

  // 3. Reject known dummy / placeholder domains
  if (DUMMY_DOMAINS.has(domain)) {
    return {
      valid: false,
      error: "Please enter a real email address. Placeholder and dummy domains (e.g. dsaf.com, example.com) are not allowed."
    };
  }

  // 4. Reject keyboard-mashing dummy domains (e.g. asdfghj.com, dsafsaf.com, 1234567.com)
  if (
    /^(asdf|dsaf|qwerty|zxcv|12345|aaaa|bbbb|cccc|dddd)+/i.test(domainParts[0]) ||
    /^(.)\1{3,}/.test(domainParts[0]) // e.g. aaaa.com, zzzz.com
  ) {
    return {
      valid: false,
      error: "Please enter a genuine, active email address."
    };
  }

  // 5. Reject dummy username with dummy-like local part
  if (DUMMY_USERNAMES.has(username) || /^(.)\1{3,}$/.test(username)) {
    // Single character repeated like aaaa@... or test@...
    return {
      valid: false,
      error: "Please enter a genuine email address instead of a placeholder."
    };
  }

  // 6. Check for consecutive dots in username or domain
  if (username.includes("..") || domain.includes("..")) {
    return { valid: false, error: "Email address cannot contain consecutive dots." };
  }

  return { valid: true, normalizedEmail: `${username}@${domain}` };
}

/**
 * Returns true if the email is valid and not disposable/dummy.
 */
export function isValidEmail(email: string | null | undefined, options?: { allowEmpty?: boolean }): boolean {
  return validateEmail(email, options).valid;
}
