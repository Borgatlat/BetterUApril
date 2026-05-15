# How to Set OpenAI API Key for Food Photo Analysis

## Quick Setup (Choose One Method)

### Method 1: Supabase Dashboard (Recommended - Easiest)

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project (e.g., "BetterU_TestFlight_v7")

2. **Navigate to Edge Functions Settings**
   - Click **Settings** (gear icon) in left sidebar
   - Click **Edge Functions** in settings menu
   - Scroll down to **Secrets** section

3. **Add Your OpenAI API Key**
   - Click **"Add Secret"** button
   - **Key**: `OPENAI_API_KEY`
   - **Value**: Your OpenAI API key (starts with `sk-`)
   - Click **"Save"**

4. **Optional: Set Custom Model**
   - Click **"Add Secret"** again (if you want to use a different model)
   - **Key**: `OPENAI_VISION_MODEL`
   - **Value**: `gpt-4o-mini` (or `gpt-4o` for better accuracy)
   - Click **"Save"**

5. **Deploy/Redeploy Your Edge Function**
   - If you haven't deployed yet, deploy the `analyze-food-photo` function
   - If already deployed, redeploy it so it picks up the new secrets

---

### Method 2: Supabase CLI (For Advanced Users)

**Prerequisites**: You need the Supabase CLI installed and linked to your project.

1. **Install Supabase CLI** (if not already installed)
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**
   ```bash
   supabase login
   ```

3. **Link to Your Project** (if not already linked)
   ```bash
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   - Find your project ref in Supabase Dashboard → Settings → General

4. **Set Secrets**
   ```bash
   supabase secrets set OPENAI_API_KEY=sk-your-actual-key-here
   ```
   
   Optional:
   ```bash
   supabase secrets set OPENAI_VISION_MODEL=gpt-4o-mini
   ```

5. **Deploy the Edge Function**
   ```bash
   supabase functions deploy analyze-food-photo
   ```

---

## How to Get Your OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign in or create an account
3. Click **"Create new secret key"**
4. Copy the key (it starts with `sk-`)
5. **Important**: Save it somewhere safe - you won't see it again!

---

## Testing After Setup

1. Make sure your Edge Function is deployed
2. Test the food photo feature in your app
3. Check Supabase Dashboard → Edge Functions → Logs for any errors

---

## Troubleshooting

**Error: "OPENAI_API_KEY not configured"**
- Make sure you added the secret in Supabase Dashboard
- Make sure the secret name is exactly `OPENAI_API_KEY` (case-sensitive)
- Redeploy your Edge Function after adding secrets

**Error: "Invalid API key"**
- Check that your OpenAI API key is correct
- Make sure you haven't hit your OpenAI usage limits
- Verify the key starts with `sk-`

**Error: "Function not found"**
- Make sure you've deployed the `analyze-food-photo` Edge Function
- Check that it exists in `supabase/functions/analyze-food-photo/index.ts`
