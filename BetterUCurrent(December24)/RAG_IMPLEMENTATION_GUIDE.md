# RAG Implementation Guide for BetterU App

## What is RAG? (Retrieval-Augmented Generation)

**RAG** is a technique that makes AI responses smarter by giving the AI model **relevant context** from your own data, rather than just relying on its training data.

### The Problem Without RAG

Currently, your app sends ALL user data to OpenAI in one big context message. This has problems:

1. **Token Limit**: OpenAI has token limits. If you send too much data, it gets cut off.
2. **Irrelevant Data**: Most of the user data isn't relevant to the current question.
3. **Cost**: Sending unnecessary data wastes tokens = wastes money.
4. **No Learning**: The AI can't "remember" patterns from past conversations or workouts.

### How RAG Solves This

Instead of sending everything, RAG:

1. **Stores** your data as "embeddings" (mathematical representations) in a database
2. **Searches** for the MOST RELEVANT pieces when the user asks a question
3. **Retrieves** only those relevant pieces (maybe 3-5 chunks)
4. **Augments** the AI prompt with just those chunks
5. **Generates** a response using the retrieved context

### Real-World Analogy

**Without RAG**: Imagine you're asking a librarian about a book, and they bring you THE ENTIRE LIBRARY to search through. Overwhelming!

**With RAG**: The librarian understands your question, goes to the right section, picks the 3-5 most relevant books, and gives you just those. Much better!

---

## RAG Architecture for Your App

```
┌─────────────────────────────────────────────────────────────┐
│                    USER ASKS QUESTION                       │
│           "What workout should I do today?"                 │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         STEP 1: EMBED THE QUESTION                          │
│  Convert question to vector using OpenAI Embeddings API     │
│  "What workout..." → [0.23, -0.45, 0.67, ...] (1536 nums)   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         STEP 2: SEARCH VECTOR DATABASE                      │
│  Find similar embeddings in your database                   │
│  Uses cosine similarity (measures how "close" vectors are)   │
│  Returns top 3-5 most relevant chunks                       │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         STEP 3: RETRIEVE CONTEXT CHUNKS                     │
│  Gets relevant workout logs, PRs, goals, preferences         │
│  Example: "User did Push/Pull/Legs, PR: 225lb bench..."    │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         STEP 4: AUGMENT PROMPT                              │
│  Build prompt with:                                          │
│  - System instructions                                       │
│  - Retrieved context (the 3-5 chunks)                       │
│  - User's current question                                   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────┐
│         STEP 5: GENERATE RESPONSE                           │
│  Send to OpenAI GPT with the augmented prompt               │
│  AI generates response using the relevant context           │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Concepts Explained (Like You're Learning from Scratch)

### 1. Embeddings (Vectors)

**What are they?** Numbers that represent meaning. 

Think of it like this:
- The word "apple" might be: `[0.2, -0.1, 0.8, ...]`
- The word "fruit" might be: `[0.19, -0.09, 0.79, ...]` (very similar!)
- The word "car" might be: `[-0.5, 0.3, -0.2, ...]` (very different!)

**Why similar numbers?** Words with similar meanings get similar numbers. "Apple" and "fruit" are related, so their vectors are close.

**What API does this?** OpenAI's `text-embedding-ada-002` (or `text-embedding-3-small`) takes text and returns a vector (array of 1536 numbers).

### 2. Vector Database (pgvector in Supabase)

**What is it?** A database that can store vectors and find similar ones quickly.

Supabase uses PostgreSQL with the `pgvector` extension. This lets you:
- Store vectors in a column
- Search for "similar" vectors using cosine similarity
- Get results ranked by relevance

**Example Query:**
```sql
-- Find the 5 most similar vectors to a given vector
SELECT content, similarity(embedding, query_vector) as score
FROM document_embeddings
ORDER BY embedding <=> query_vector
LIMIT 5;
```

The `<=>` operator measures cosine distance (smaller = more similar).

### 3. Chunking

**What is chunking?** Breaking long documents into smaller pieces.

**Why?** 
- Embeddings work better with smaller, focused text (100-500 words)
- You can retrieve specific parts instead of entire documents
- More precise matching

**Example:**
```
Long workout log (5000 words)
  ↓ CHUNK INTO
Chunk 1: "Monday workout - Chest exercises, 3 sets of bench press..."
Chunk 2: "Tuesday workout - Back exercises, deadlifts..."
Chunk 3: "User preferences: Prefers morning workouts, 45 min duration..."
```

### 4. Retrieval

**What is retrieval?** Finding the most relevant chunks for a question.

**How?**
1. Embed the user's question
2. Search the vector database for similar embeddings
3. Return top K results (usually 3-5)

**Why top 3-5?** More context isn't always better. Too much can confuse the AI or hit token limits.

---

## Implementation Strategy for BetterU

### Phase 1: Set Up Vector Storage (Database)

You'll need to:
1. Enable pgvector extension in Supabase
2. Create tables to store embeddings
3. Create indexes for fast searches

### Phase 2: Create Embedding Utility (Supabase Edge Function)

A server-side function that:
- Takes text input
- Calls OpenAI Embeddings API
- Returns the vector

**Why Edge Function?** Keeps your OpenAI API key secret (never in the app).

### Phase 3: Store Historical Data as Embeddings

When user data changes, create embeddings:
- Workout logs → embeddings
- PRs → embeddings
- Goals → embeddings
- Past conversations → embeddings

### Phase 4: RAG Query Function

A function that:
1. Takes user's question
2. Embeds it
3. Searches vector database
4. Returns relevant chunks

### Phase 5: Update AI Functions

Modify your existing AI functions (`generateAIResponse`, `generateWorkout`, etc.) to:
- Call RAG query function
- Use retrieved context instead of dumping all data
- Send augmented prompt to OpenAI

---

## What Data Should Be Indexed?

For BetterU, these are good candidates:

### 1. Workout Logs
- Each workout becomes chunks: exercise names, sets/reps, dates
- Enables: "What did I do for chest last week?"
- Enables: "What's my progression on bench press?"

### 2. Personal Records (PRs)
- Each PR as a chunk
- Enables: "What's my best deadlift?"
- Enables: "How much have I improved?"

### 3. Goals
- User's fitness goals
- Enables: "What should I do to reach my goal?"

### 4. Preferences
- Workout preferences, times, duration
- Enables: "Create a workout I'll enjoy"

### 5. Past Conversations (Optional)
- Previous AI trainer/therapist conversations
- Enables: Continuity in conversations
- Enables: "Remember when we discussed..."

### 6. Mental Session History (Optional)
- Past meditation/mindfulness sessions
- Enables therapist to reference past sessions

---

## Benefits for Your App

### 1. Better Personalization
- AI responds with SPECIFIC data from user's history
- "Last week you did 3 sets of 10 on bench press at 185lbs. Let's try 190lbs today."
- Instead of generic: "Do bench press with progressive overload."

### 2. Cost Savings
- Sending 3-5 relevant chunks vs ALL data = fewer tokens = less cost
- Embeddings API is cheap ($0.0001 per 1K tokens)

### 3. Scalability
- Works even when users have thousands of workout logs
- Only retrieves what's needed

### 4. Better Accuracy
- AI has focused, relevant context
- Less "hallucination" (making up data)
- More specific recommendations

---

## Implementation Files You'll Create

1. **Database Migration**: Enable pgvector, create embeddings table
2. **Supabase Edge Function**: `create-embedding` - Converts text to vector
3. **Supabase Edge Function**: `rag-query` - Searches and retrieves context
4. **Utility Function**: `storeDocumentEmbedding` - Stores embeddings in database
5. **Utility Function**: `queryRAGContext` - Client-side function to call RAG
6. **Updated AI Utils**: Modified `generateAIResponse` to use RAG

---

## Next Steps

1. Read through this guide to understand the concepts
2. Follow the implementation steps (see RAG_IMPLEMENTATION_STEPS.md)
3. Test with a simple example first
4. Gradually roll out to all AI features

---

## Questions to Think About

1. **How often to update embeddings?**
   - Option A: Update whenever data changes (real-time)
   - Option B: Batch update daily (cheaper, simpler)
   - Recommendation: Start with batch, optimize later

2. **How big should chunks be?**
   - Recommendation: 200-500 words per chunk
   - Too small: Loses context
   - Too large: Less precise matching

3. **How many chunks to retrieve?**
   - Recommendation: 3-5 chunks
   - More = more context but higher token cost
   - Fewer = faster but might miss important info

4. **Should conversations be indexed?**
   - Yes: Better continuity
   - But: Requires careful chunking (don't want to include unrelated old conversations)

---

## Common Mistakes to Avoid

1. **Not using Edge Functions for embeddings**
   - Don't expose API keys in the app
   - Always use server-side functions

2. **Creating embeddings for every API call**
   - Cache embeddings! Once you embed "Bench Press PR: 225lbs", store it
   - Only re-embed if the data changes

3. **Sending too many chunks**
   - More isn't always better
   - Start with 3-5, test, adjust

4. **Not chunking properly**
   - Long documents need to be split
   - Each chunk should be self-contained (understandable on its own)

5. **Ignoring metadata**
   - Store metadata (user_id, date, type) with embeddings
   - Helps filter results ("only show workouts from last month")

---

## Cost Analysis

**Embeddings API Cost:**
- $0.0001 per 1,000 tokens (very cheap!)
- Average document: ~500 tokens
- 1,000 documents = $0.05 to embed
- Stored once, queried many times = very efficient

**GPT API Cost (with RAG):**
- Fewer tokens in prompt (3-5 chunks vs all data)
- More accurate responses (fewer mistakes)
- Overall: **SAVES money** compared to sending all data

---

## Summary

RAG makes your AI smarter by:
1. Storing data as searchable vectors
2. Retrieving only relevant context
3. Using that context to generate better responses

Think of it as giving your AI a **smart filing system** instead of a **giant stack of papers**.
