/**
 * Demo account for testing the onboarding flow without creating a new account.
 * No confirmation email is sent when signing in with this account.
 *
 * Setup (one-time in Supabase):
 * 1. Dashboard → Authentication → Users → Add user
 * 2. Email: DEMO_EMAIL below, Password: DEMO_PASSWORD
 * 3. (Optional) In Table Editor → profiles: for this user set onboarding_completed = false
 *    so the full onboarding flow is shown. If no profile exists, onboarding will create it.
 */
export const DEMO_CONFIG = {
  EMAIL: 'demo@betteru.demo',
  PASSWORD: 'DemoOnboarding123!',
};
