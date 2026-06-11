/**
 * Where to send someone after we know they have a Supabase session.
 * Mirrors login.js / signup.js so cold start matches sign-in flows.
 */
export function resolvePostAuthRoute(workspace, profile) {
  if (workspace === "staff") {
    return "/(school)/dashboard";
  }
  if (workspace === "parent") {
    return "/(parent)/dashboard";
  }
  if (profile?.onboarding_completed === true) {
    if (workspace === "student") {
      return "/(tabs)/spiritual";
    }
    return "/(tabs)/home";
  }
  return "/(auth)/onboarding/welcome";
}
