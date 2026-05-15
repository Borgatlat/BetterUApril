-- Enable pgvector extension for vector similarity search
-- This extension allows us to store and search embeddings (vectors) in PostgreSQL
CREATE EXTENSION IF NOT EXISTS vector;

-- Create a table to store document embeddings
-- This table stores all the chunks of user data (workouts, PRs, goals, etc.) as embeddings
CREATE TABLE IF NOT EXISTS document_embeddings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- The original content (text) that was embedded
    -- Example: "Workout on 2025-01-01: Bench Press, 3 sets of 10 at 185lbs"
    content TEXT NOT NULL,
    
    -- The embedding vector (1536 dimensions for text-embedding-ada-002)
    -- This is the mathematical representation of the content
    embedding vector(1536) NOT NULL,
    
    -- Metadata to help categorize and filter results
    document_type TEXT NOT NULL, -- 'workout_log', 'pr', 'goal', 'preference', 'conversation'
    document_id TEXT, -- ID of the original document (e.g., workout log ID)
    document_date TIMESTAMP WITH TIME ZONE, -- When the original document was created
    
    -- Additional metadata stored as JSONB (flexible key-value storage)
    -- Example: {"workout_name": "Push Day", "exercises": ["Bench Press", "Shoulder Press"]}
    metadata JSONB DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create index for fast similarity search
-- This index uses "ivfflat" which is optimized for cosine similarity search
-- The 'vector_cosine_ops' operator class is specifically for cosine distance (<-> operator)
CREATE INDEX IF NOT EXISTS document_embeddings_embedding_idx 
ON document_embeddings 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100); -- 'lists' parameter: higher = more accurate but slower, lower = faster but less accurate
-- For small datasets (<100K rows), 100 is a good default
-- If you have millions of rows, increase to 200-500

-- Create index on user_id for filtering by user (required for RLS)
CREATE INDEX IF NOT EXISTS document_embeddings_user_id_idx 
ON document_embeddings(user_id);

-- Create index on document_type for filtering by type
CREATE INDEX IF NOT EXISTS document_embeddings_document_type_idx 
ON document_embeddings(document_type);

-- Create composite index for common queries (user + type + date)
CREATE INDEX IF NOT EXISTS document_embeddings_user_type_date_idx 
ON document_embeddings(user_id, document_type, document_date DESC);

-- Enable Row Level Security (RLS) - users can only see their own embeddings
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own embeddings
CREATE POLICY "Users can view own embeddings" 
ON document_embeddings 
FOR SELECT 
USING (auth.uid() = user_id);

-- Policy: Users can insert their own embeddings
CREATE POLICY "Users can insert own embeddings" 
ON document_embeddings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own embeddings
CREATE POLICY "Users can update own embeddings" 
ON document_embeddings 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Policy: Users can delete their own embeddings
CREATE POLICY "Users can delete own embeddings" 
ON document_embeddings 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create a function to search for similar embeddings
-- This function takes a query vector and finds the most similar embeddings
-- Returns the top K results (default 5) with similarity scores
CREATE OR REPLACE FUNCTION search_similar_embeddings(
    query_embedding vector(1536),
    query_user_id UUID,
    query_document_type TEXT DEFAULT NULL,
    match_count INTEGER DEFAULT 5,
    similarity_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    document_type TEXT,
    document_id TEXT,
    document_date TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        de.id,
        de.content,
        de.document_type,
        de.document_id,
        de.document_date,
        de.metadata,
        -- Calculate cosine similarity: 1 - cosine distance
        -- cosine distance (<=>) ranges from 0 (identical) to 2 (opposite)
        -- similarity ranges from 1 (identical) to -1 (opposite)
        -- We use 1 - distance so higher = more similar
        1 - (de.embedding <=> query_embedding) AS similarity
    FROM document_embeddings de
    WHERE de.user_id = query_user_id
        AND (query_document_type IS NULL OR de.document_type = query_document_type)
        AND (1 - (de.embedding <=> query_embedding)) >= similarity_threshold
    ORDER BY de.embedding <=> query_embedding  -- Order by cosine distance (ascending = most similar first)
    LIMIT match_count;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION search_similar_embeddings TO authenticated;

-- Create a helper function to delete embeddings for a specific document
-- Useful when you update a workout log and need to re-embed it
CREATE OR REPLACE FUNCTION delete_document_embeddings(
    p_user_id UUID,
    p_document_type TEXT,
    p_document_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM document_embeddings
    WHERE user_id = p_user_id
        AND document_type = p_document_type
        AND document_id = p_document_id;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION delete_document_embeddings TO authenticated;

-- Add comment explaining the table
COMMENT ON TABLE document_embeddings IS 'Stores embeddings (vectors) of user documents for RAG (Retrieval-Augmented Generation). Each row represents a chunk of user data (workout log, PR, goal, etc.) converted to a 1536-dimensional vector for similarity search.';

-- Add comment explaining the search function
COMMENT ON FUNCTION search_similar_embeddings IS 'Searches for similar embeddings using cosine similarity. Returns top K most similar documents with similarity scores.';
