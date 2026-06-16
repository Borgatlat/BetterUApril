import * as AppleAuthentication from 'expo-apple-authentication';

/** User dismissed the Apple sheet — not an error we should alert on. */
export function isAppleSignInCanceled(error) {
  const code = String(error?.code ?? '');
  return code === 'ERR_CANCELED' || code === 'ERR_REQUEST_CANCELED';
}

/** Turn Supabase / native errors into something actionable in the UI. */
export function formatAppleSignInError(error, action = 'sign in with Apple') {
  const raw = String(error?.message ?? error ?? '');
  const lower = raw.toLowerCase();

  const rateMatch = lower.match(/after (\d+) seconds?/);
  if (rateMatch) {
    return `Too many attempts. Wait ${rateMatch[1]} seconds before you ${action}.`;
  }

  if (lower.includes('unacceptable audience') || lower.includes('audience in id_token')) {
    return 'Apple Sign In is not linked to this app in Supabase. In Supabase → Authentication → Apple, add Client ID: com.enriqueortiz.betteru (and host.exp.Exponent if using Expo Go).';
  }

  if (lower.includes('invalid jwt') || lower.includes('invalid id token') || lower.includes('unable to validate')) {
    return 'Apple token rejected by Supabase. Regenerate the Apple provider secret in Supabase (Apple secrets expire every 6 months) and confirm Client IDs include com.enriqueortiz.betteru.';
  }

  if (lower.includes('authorization attempt failed') || lower.includes('unknown reason')) {
    return 'Sign in with Apple is disabled in this build. Rebuild the iOS app (npx expo run:ios) — Debug must use BetterU.entitlements, not the empty personal-dev entitlements file. TestFlight/Release builds work.';
  }

  if (lower.includes('email not confirmed')) {
    return 'Confirm your email first, then try Apple Sign In again.';
  }

  return raw || `Could not ${action}. Please try again.`;
}

/**
 * Native Apple sheet → Supabase session (no nonce — matches Supabase Expo native docs).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function signInWithAppleNative(supabase) {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error('Apple did not return a sign-in token. Use a TestFlight/dev build with Sign in with Apple enabled (not IOS_PERSONAL_DEV=1).');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });

  if (error) throw error;

  if (!data?.user?.id) {
    throw new Error('Supabase accepted Apple but returned no user. Check Supabase Auth logs.');
  }

  // Ensure JWT is attached before any RLS profile reads.
  if (!data.session) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      throw new Error('Sign-in succeeded but the session was not saved on this device. Try again.');
    }
  }

  return { data, credential };
}

/** Apple sends name/email only once — save when present; always ensure profiles row exists. */
export async function persistAppleProfileFields(supabase, userId, credential) {
  const parts = [];
  if (credential.fullName?.givenName) parts.push(credential.fullName.givenName);
  if (credential.fullName?.familyName) parts.push(credential.fullName.familyName);
  const full_name = parts.length ? parts.join(' ').trim() : null;
  const email = credential.email || null;

  const payload = { id: userId };
  if (full_name) payload.full_name = full_name;
  if (email) payload.email = email;

  const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
  if (error) console.warn('[AppleAuth] profiles upsert:', error.message);
}
