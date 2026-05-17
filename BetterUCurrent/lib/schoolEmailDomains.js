/**
 * Consumer email domains blocked when user selects "School partner" sign-up / login.
 * Partner flows expect a school-issued address (domain matched server-side).
 */
export const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "msn.com",
]);

/** @param {string} email */
export function consumerDomainFromEmail(email) {
  if (!email || typeof email !== "string") return "";
  return email.trim().split("@")[1]?.toLowerCase() ?? "";
}

/** True if the address uses a known personal inbox domain (Gmail, iCloud, etc.). */
export function isPersonalConsumerEmail(email) {
  const d = consumerDomainFromEmail(email);
  return d !== "" && PERSONAL_EMAIL_DOMAINS.has(d);
}
