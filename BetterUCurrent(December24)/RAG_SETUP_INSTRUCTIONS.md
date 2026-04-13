# RAG Setup Instructions

Follow these steps to set up RAG (Retrieval-Augmented Generation) in your BetterU app.

## Prerequisites

- Supabase project set up
- OpenAI API key
- Supabase CLI installed (for deploying Edge Functions)

## Step 1: Run Database Migration

The migration enables the `pgvector` extension and creates the `document_embeddings` table.

1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Open the file: `supabase/migrations/20250103000000_enable_pgvector_and_rag.sql`
5. Copy the entire SQL content
6. Paste it into the SQL Editor
7. Click **Run** (or press Cmd/Ctrl + Enter)

**What this does:**
- Enables `pgvector` extension (allows storing vectors in PostgreSQL)
- Creates `document_embeddings` table
- Creates indexes for fast similarity search
- Sets up Row Level Security (users can only see their own embeddings)
- Creates helper functions for searching embeddings

**Expected result:** You should see "Success. No rows returned" - this means it worked!

## Step 2: Install Supabase CLI (if not already installed)

```bash
npm install -g supabase
```

Or using other package managers:
- **Windows (Scoop):** `scoop install supabase`
- **Mac (Homebrew):** `brew install supabase/tap/supabase`

## Step 3: Login and Link Your Project

```bash
# Login to Supabase
supabase login

# Link to your project (get project ref from Dashboard → Settings → General)
supabase link --project-ref kmpufblmilcvortrfilp
```

## Step 4: Set Supabase Secrets

You need to set secrets for the Edge Functions:

```bash
# Set OpenAI API key (same one you use for other AI features)
supabase secrets set OPENAI_API_KEY=sk-your-actual-key-here

# Set Supabase Service Role Key (found in Dashboard → Settings → API → service_role key)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Alternative (Using Supabase Dashboard):**
1. Go to **Settings** → **Edge Functions**
2. Scroll to **Secrets** section
3. Click **Add Secret**
4. Key: `OPENAI_API_KEY`, Value: Your OpenAI API key
5. Click **Add Secret** again
6. Key: `SUPABASE_SERVICE_ROLE_KEY`, Value: Your service role key (from Settings → API)

## Step 5: Deploy Edge Functions

Deploy both Edge Functions:

```bash
# Deploy create-embedding function
supabase functions deploy create-embedding

# Deploy rag-query function
supabase functions deploy rag-query
```

**Expected output:**
```
Deploying function create-embedding...
Function create-embedding deployed successfully
```

## Step 6: Verify Installation

Test that everything works:

1. **Test database migration:**
   - Go to **Table Editor** in Supabase Dashboard
   - You should see a new table: `document_embeddings`

2. **Test Edge Functions:**
   - Go to **Edge Functions** in Supabase Dashboard
   - You should see `create-embedding` and `rag-query` functions
   - Click on one to see logs (will be empty until you use it)

## Step 7: Integrate RAG into Your App

See `RAG_INTEGRATION_EXAMPLE.js` for detailed examples.

**Quick start:**
1. Import RAG utilities:
   ```javascript
   import { queryRAGContext, chunkAndStoreWorkoutLog } from '../utils/ragUtils';
   ```

2. When workout is completed, store embeddings:
   ```javascript
   // After saving workout to database
   await chunkAndStoreWorkoutLog(workoutLog);
   ```

3. In your AI functions, use RAG instead of sending all data:
   ```javascript
   const ragResult = await queryRAGContext(userMessage, null, 5, 0.7);
   // Use ragResult.results in your AI prompt
   ```

## Step 8: Test RAG

1. Complete a workout in your app
2. Wait a few seconds (for embedding to be created)
3. Ask your AI trainer: "What workout should I do today?"
4. The AI should reference your recent workouts!

## Troubleshooting

### Error: "extension vector does not exist"
- The `pgvector` extension might not be enabled in your Supabase project
- Contact Supabase support or check if your plan supports extensions
- Alternative: Use Supabase's built-in vector search (if available)

### Error: "OPENAI_API_KEY not configured"
- Make sure you set the secret correctly
- Check: `supabase secrets list` (should show OPENAI_API_KEY)
- Or check in Dashboard → Settings → Edge Functions → Secrets

### Error: "SUPABASE_SERVICE_ROLE_KEY not configured"
- Set the service role key as a secret
- Find it in Dashboard → Settings → API → service_role key
- **IMPORTANT:** Never expose this key in your app code!

### Edge Functions fail to deploy
- Make sure you're logged in: `supabase login`
- Make sure project is linked: `supabase link --project-ref YOUR_REF`
- Check Supabase Dashboard for deployment logs

### RAG queries return no results
- Make sure embeddings are being stored (check `document_embeddings` table)
- Check similarity threshold (try lowering from 0.7 to 0.5)
- Check that user_id matches (RLS might be blocking)

### Embeddings not being stored
- Check browser/console logs for errors
- Verify user is authenticated
- Check that `document_embeddings` table exists
- Verify Edge Function is deployed and secrets are set

## Next Steps

1. **Start small:** Integrate RAG into one feature first (e.g., AI Trainer)
2. **Monitor usage:** Check OpenAI API usage (embeddings are cheap!)
3. **Optimize:** Adjust chunk size, similarity threshold, etc.
4. **Expand:** Add RAG to other features (Therapist, Meal Generator, etc.)

## Cost Estimate

**Embeddings API:**
- $0.0001 per 1,000 tokens
- Average document: ~500 tokens
- 1,000 documents = $0.05 to embed
- Very cheap!

**GPT API (with RAG):**
- Fewer tokens in prompt (saves money!)
- More accurate responses
- Overall: **SAVES money** compared to sending all data

## Support

If you run into issues:
1. Check Supabase Dashboard logs
2. Check browser console for errors
3. Review the RAG_IMPLEMENTATION_GUIDE.md for concepts
4. Check RAG_INTEGRATION_EXAMPLE.js for code examples
