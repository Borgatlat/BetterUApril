# How to Remove Password Requirements in Supabase

## The Issue
Supabase is currently enforcing password requirements that require:
- At least one letter (uppercase or lowercase)
- At least one number
- Minimum 6 characters

## Solution: Update Supabase Dashboard Settings

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **Policies** (or **Settings** → **Auth**)
4. Find the **Password** section
5. Look for **Password Requirements** or **Password Policy**
6. Set it to **Empty** or **None** to remove all requirements except minimum length
7. You can keep `minimum_password_length = 6` (this is reasonable)

## Alternative: Update via SQL (if you have database access)

If you have direct database access, you can try updating the auth configuration, but this is typically managed through the dashboard.

## Note
The `supabase/config.toml` file shows `password_requirements = ""` which should disable requirements, but this only applies to **local development**. For your production/hosted Supabase instance, you need to update the settings in the dashboard.
