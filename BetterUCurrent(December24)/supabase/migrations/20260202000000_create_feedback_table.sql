-- Create feedback table for AI workouts, AI responses, and workout quality
-- Stores user feedback to improve product and AI features

CREATE TABLE IF NOT EXISTS feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('ai-workout', 'ai-response', 'workout-quality', 'general')),
    context_id TEXT,
    rating TEXT NOT NULL CHECK (rating IN ('positive', 'negative')),
    reason TEXT[],
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for faster lookups by user and type
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback(type);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at DESC);

-- Enable Row Level Security
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Users can only insert their own feedback (no reading others' feedback)
CREATE POLICY "Users can insert their own feedback"
    ON feedback FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Service role / admins may need SELECT for analytics - add policy for users to read their own
CREATE POLICY "Users can view their own feedback"
    ON feedback FOR SELECT
    USING (auth.uid() = user_id);
