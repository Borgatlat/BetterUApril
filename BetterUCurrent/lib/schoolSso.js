import { Platform } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { makeRedirectUri } from "expo-auth-session";
import Constants from "expo-constants";
import { supabase } from "./supabase";

WebBrowser.maybeCompleteAuthSession();

const EXPO_AUTH_REDIRECT = "https://auth.expo.io/@easbetteru/betterU_TestFlight_v7";
const NATIVE_REDIRECT = makeRedirectUri({ scheme: "betteru", path: "auth/callback" });

function getRedirectUri() {
  const isExpoGo = Constants.appOwnership === "expo";
  return isExpoGo ? EXPO_AUTH_REDIRECT : NATIVE_REDIRECT;
}

/**
 * Google or Microsoft (Azure) SSO for school accounts via Supabase OAuth.
 * IT must enable the provider in Supabase + org flags (sso_google_enabled / sso_azure_enabled).
 *
 * @param {'google'|'azure'} provider
 * @param {{ loginHint?: string, hd?: string }} [options] — hd = Google hosted domain (e.g. yourschool.edu)
 */
export async function signInWithSchoolSso(provider, options = {}) {
  const redirectTo = getRedirectUri();
  const queryParams = { prompt: "select_account" };
  if (options.loginHint) queryParams.login_hint = options.loginHint;
  if (options.hd && provider === "google") queryParams.hd = options.hd;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams,
    },
  });

  if (error) throw error;
  if (!data?.url) throw new Error("SSO did not return an authorization URL.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (result.type === "cancel") {
    throw new Error("Sign-in was cancelled.");
  }
  if (result.type !== "success") {
    throw new Error("Sign-in did not complete.");
  }

  // Supabase usually establishes session from callback; verify.
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!session) {
    throw new Error("No session after SSO — check Supabase redirect URLs.");
  }

  return session;
}

/** Domain hint for Google Workspace schools (restricts account picker). */
export function schoolDomainFromEmail(email) {
  const em = String(email || "").trim().toLowerCase();
  const at = em.indexOf("@");
  if (at < 1) return null;
  return em.slice(at + 1);
}
