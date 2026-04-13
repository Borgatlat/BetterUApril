/**
 * Helpers for sign-up when the email is already registered in Supabase Auth.
 *
 * When does this run?
 * Only after your app calls `supabase.auth.signUp()` — usually when the user taps "Sign Up".
 * There is no check "as you type the email" unless you add a custom backend (Supabase hides existence of emails on purpose).
 *
 * How GoTrue (Supabase Auth) behaves (simplified):
 * - Email confirmations ON, user already exists and is confirmed → HTTP 200 + a fake `user` with `identities: []`
 *   (no error), so we detect duplicates via empty identities + no session.
 * - Autoconfirm ON → often HTTP 422 + error code `user_already_exists` / message "User already registered".
 * - Existing user never finished email confirmation → GoTrue may resend confirmation instead of treating it as
 *   "duplicate"; you can still see a "success" path. That is server behavior, not something the client can fix
 *   without a custom RPC/Edge Function.
 */

/** Shown in alerts and inline error text when someone tries to register an existing email. */
export const SIGNUP_EMAIL_IN_USE_MESSAGE =
  'This email is already in use. Please sign in or use a different email.';

/**
 * `error` here is usually a Supabase AuthError: it has `.message` and often `.code` (a string like 'email_exists').
 * We use optional chaining (`error?.code`) so this is safe if something else threw a plain Error.
 */
const DUPLICATE_AUTH_CODES = new Set([
  'user_already_exists',
  'email_exists',
  'identity_already_exists',
]);

export function isDuplicateSignupAuthError(error) {
  if (!error) return false;
  if (DUPLICATE_AUTH_CODES.has(error.code)) return true;
  const m = String(error.message || '').toLowerCase();
  return (
    m.includes('already registered') ||
    m.includes('already been registered') ||
    m.includes('user already exists') ||
    m.includes('email address is already') ||
    m.includes('email already') ||
    m.includes('email is already') ||
    m.includes('already signed up') ||
    (m.includes('duplicate') && m.includes('user'))
  );
}

/**
 * After a "successful" signUp, Supabase may return `user` with `identities: []` for an existing email.
 * A normal new signup (with confirm-email ON) still returns `session: null` but includes ≥1 identity.
 * If there is a session, the user was logged in by signup — not the obfuscated-duplicate case.
 */
export function isDuplicateSignupUserObfuscated(user, session) {
  if (session) return false;
  return !!(user && Array.isArray(user.identities) && user.identities.length === 0);
}
