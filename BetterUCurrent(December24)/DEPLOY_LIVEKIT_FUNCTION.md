# Deploy LiveKit Edge Function to Supabase

## Quick Start Guide

The edge function `generate-livekit-token` needs to be deployed to Supabase. Here are two methods:

---

## Method 1: Supabase CLI (Recommended)

### Step 1: Install Supabase CLI

**On Windows (PowerShell):**
```powershell
# Using npm (if you have Node.js installed)
npm install -g supabase

# OR using Scoop (Windows package manager)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Verify installation:**
```powershell
supabase --version
```

### Step 2: Login to Supabase

```powershell
supabase login
```

This will open your browser to authenticate. After logging in, you'll be able to deploy functions.

### Step 3: Link Your Project

```powershell
# Navigate to your project directory
cd "BetterUCurrent(December24)"

# Link to your Supabase project
# Your project ref is: kmpufblmilcvortrfilp (from the error URL)
supabase link --project-ref kmpufblmilcvortrfilp
```

**If you don't know your project ref:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to Settings → General
4. Copy the "Reference ID"

### Step 4: Set Environment Variables (Secrets)

**Important:** Your `.env` file is for local development only. Supabase Edge Functions need secrets set in Supabase.

```powershell
# Set LiveKit secrets (replace with your actual values from .env)
supabase secrets set LIVEKIT_URL=your-livekit-url-here
supabase secrets set LIVEKIT_API_KEY=your-api-key-here
supabase secrets set LIVEKIT_API_SECRET=your-api-secret-here

# Optional: Set WebSocket URL if you have one
supabase secrets set WEBSOCKET_URL=your-websocket-url-here
```

**To get your values from .env:**
1. Open your `.env` file
2. Find the LiveKit variables
3. Copy the values (without quotes)
4. Use them in the commands above

### Step 5: Deploy the Function

```powershell
supabase functions deploy generate-livekit-token
```

**Expected output:**
```
Deploying function generate-livekit-token...
Function generate-livekit-token deployed successfully!
```

### Step 6: Verify Deployment

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Edge Functions** in the left sidebar
4. You should see `generate-livekit-token` in the list

---

## Method 2: Supabase Dashboard (Alternative)

If you prefer using the web interface:

### Step 1: Go to Supabase Dashboard

1. Visit: https://supabase.com/dashboard
2. Select your project

### Step 2: Navigate to Edge Functions

1. Click **Edge Functions** in the left sidebar
2. Click **"Create a new function"** or **"Deploy function"**

### Step 3: Upload Function

1. **Option A: Use CLI from Dashboard**
   - The dashboard will show you CLI commands
   - Follow Method 1 above

2. **Option B: Manual Upload (if available)**
   - Create a zip file containing:
     - `index.ts` (from `supabase/functions/generate-livekit-token/`)
   - Upload via the dashboard interface

### Step 4: Set Secrets in Dashboard

1. Go to **Settings** → **Edge Functions**
2. Scroll to **Secrets** section
3. Click **"Add Secret"** for each:
   - **Key:** `LIVEKIT_URL` → **Value:** (your LiveKit URL)
   - **Key:** `LIVEKIT_API_KEY` → **Value:** (your API key)
   - **Key:** `LIVEKIT_API_SECRET` → **Value:** (your API secret)
4. Click **"Save"** for each secret

---

## Troubleshooting

### Error: "Function not found" (404)

**Cause:** Function not deployed yet.

**Solution:** Complete Step 5 (Deploy the Function) above.

### Error: "LiveKit configuration missing" (500)

**Cause:** Secrets not set in Supabase.

**Solution:** Complete Step 4 (Set Environment Variables) above.

### Error: "supabase: command not found"

**Cause:** Supabase CLI not installed.

**Solution:** Complete Step 1 (Install Supabase CLI) above.

### Error: "Project not linked"

**Cause:** Project not linked to local directory.

**Solution:** Complete Step 3 (Link Your Project) above.

---

## After Deployment

1. **Test the function:**
   - Try clicking the Voice Therapy button in your app
   - The 404 error should be gone
   - If you get a different error, check the logs

2. **Check function logs:**
   - Go to Supabase Dashboard → Edge Functions
   - Click on `generate-livekit-token`
   - View logs to see if there are any errors

3. **Verify secrets are set:**
   - Go to Settings → Edge Functions → Secrets
   - Confirm all three LiveKit secrets are present

---

## Quick Reference Commands

```powershell
# Install CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref kmpufblmilcvortrfilp

# Set secrets (replace values)
supabase secrets set LIVEKIT_URL=your-url
supabase secrets set LIVEKIT_API_KEY=your-key
supabase secrets set LIVEKIT_API_SECRET=your-secret

# Deploy function
supabase functions deploy generate-livekit-token

# View function logs
supabase functions logs generate-livekit-token
```

---

## Need Help?

- **Supabase CLI Docs:** https://supabase.com/docs/guides/cli
- **Edge Functions Docs:** https://supabase.com/docs/guides/functions
- **Your project URL:** https://kmpufblmilcvortrfilp.supabase.co
