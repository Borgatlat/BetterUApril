# RAG Quick Start Guide

**TL;DR:** This guide gives you the fastest path to getting RAG working in your BetterU app.

## What You Just Got

I've created a complete RAG (Retrieval-Augmented Generation) system for your app. Here's what was added:

### 📁 Files Created

1. **RAG_IMPLEMENTATION_GUIDE.md** - Complete explanation of RAG concepts (read this to understand what RAG is)
2. **RAG_SETUP_INSTRUCTIONS.md** - Step-by-step setup instructions
3. **RAG_INTEGRATION_EXAMPLE.js** - Code examples showing how to use RAG
4. **supabase/migrations/20250103000000_enable_pgvector_and_rag.sql** - Database setup
5. **supabase/functions/create-embedding/index.ts** - Edge Function to create embeddings
6. **supabase/functions/rag-query/index.ts** - Edge Function to search embeddings
7. **utils/ragUtils.js** - Helper functions for your app

## Quick Setup (5 Steps)

### 1. Run Database Migration (2 minutes)

1. Open Supabase Dashboard → SQL Editor
2. Copy/paste content from `supabase/migrations/20250103000000_enable_pgvector_and_rag.sql`
3. Click Run

✅ **Check:** You should see a new table `document_embeddings` in Table Editor

### 2. Deploy Edge Functions (3 minutes)

```bash
# If not already installed
npm install -g supabase

# Login and link
supabase login
supabase link --project-ref kmpufblmilcvortrfilp

# Set secrets (get keys from Supabase Dashboard)
supabase secrets set OPENAI_API_KEY=sk-your-key-here
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Deploy functions
supabase functions deploy create-embedding
supabase functions deploy rag-query
```

✅ **Check:** Functions appear in Dashboard → Edge Functions

### 3. Test Basic Usage (2 minutes)

Add this to any component to test:

```javascript
import { queryRAGContext, chunkAndStoreWorkoutLog } from '../utils/ragUtils';

// Test: Store a workout log
const testWorkout = {
  id: 'test-123',
  workout_name: 'Test Workout',
  exercises: [{ name: 'Bench Press', sets: [{ weight: 185, reps: 10 }] }],
  completed_at: new Date().toISOString()
};

await chunkAndStoreWorkoutLog(testWorkout);

// Test: Query RAG
const result = await queryRAGContext('What did I do for bench press?');
console.log('RAG Results:', result.results);
```

### 4. Integrate into Workout Completion (5 minutes)

Find where workouts are saved (probably in `workout.js` or workout completion handler):

```javascript
// After saving workout to database, add:
import { chunkAndStoreWorkoutLog } from '../utils/ragUtils';

// ... your existing code to save workout ...
const { data: workoutLog } = await supabase.from('user_workout_logs').insert(...);

// NEW: Store as embedding for RAG
if (workoutLog) {
  await chunkAndStoreWorkoutLog(workoutLog);
}
```

### 5. Update AI Functions (10 minutes)

See `RAG_INTEGRATION_EXAMPLE.js` for the full example. Quick version:

```javascript
import { queryRAGContext } from '../utils/ragUtils';

// In your generateAIResponse function, replace the context building:
const ragResult = await queryRAGContext(userMessage, null, 5, 0.7);

// Use ragResult.results in your AI prompt instead of sending all user data
const ragContext = ragResult.results.map(doc => doc.content).join('\n\n');
```

## What RAG Does For You

**Before RAG:**
- Sends ALL user data to AI (expensive, hits token limits)
- Generic responses ("Do progressive overload")
- Doesn't reference specific user history

**After RAG:**
- Sends only RELEVANT chunks (cheaper, more focused)
- Specific responses ("Last week you did 185lbs bench press, try 190lbs today")
- References actual user data

## Example Questions That Work Better With RAG

1. "What workout should I do today?" → Returns recent workouts, PRs, goals
2. "What did I do for chest last week?" → Returns specific chest exercises
3. "How much should I increase my bench press?" → Returns current PR and progression
4. "What's my best deadlift?" → Returns PR data

## Troubleshooting

**"Extension vector does not exist"**
→ Your Supabase plan might not support pgvector. Contact support.

**"OPENAI_API_KEY not configured"**
→ Set it as a secret: `supabase secrets set OPENAI_API_KEY=sk-...`

**No results from RAG queries**
→ Make sure embeddings are stored first (complete a workout, then query)

**Edge Functions fail to deploy**
→ Make sure you're logged in and project is linked

## Next Steps

1. ✅ Read `RAG_IMPLEMENTATION_GUIDE.md` to understand concepts
2. ✅ Follow `RAG_SETUP_INSTRUCTIONS.md` for detailed setup
3. ✅ Use `RAG_INTEGRATION_EXAMPLE.js` as a reference
4. ✅ Start with one feature (AI Trainer), then expand

## Cost

- **Embeddings:** $0.0001 per 1K tokens (very cheap!)
- **GPT API:** Saves tokens = saves money
- **Overall:** RAG **reduces** costs compared to sending all data

## Need Help?

- Check Supabase Dashboard logs
- Check browser console for errors
- Review the detailed guides in the files mentioned above

---

**You're all set!** 🎉 Start with Step 1 and work through the setup. RAG will make your AI features much smarter and more personalized!
