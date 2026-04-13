-- Create custom_mental_sessions table for storing user-created and AI-generated mental wellness sessions
-- This table stores both manually created sessions and AI-generated sessions

CREATE TABLE custom_mental_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  
  -- Basic session information
  title TEXT NOT NULL,
  description TEXT,
  session_type TEXT NOT NULL CHECK (session_type IN ('meditation', 'breathing', 'mindfulness', 'relaxation')),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 120),
  
  -- Session content
  steps JSONB, -- Array of step objects with instructions
  benefits TEXT[], -- Array of benefit descriptions
  prerequisites TEXT[], -- Array of prerequisites or requirements
  
  -- Metadata
  is_ai_generated BOOLEAN DEFAULT FALSE,
  ai_prompt TEXT, -- The prompt used to generate AI sessions
  difficulty_level TEXT CHECK (difficulty_level IN ('beginner', 'intermediate', 'advanced')) DEFAULT 'beginner',
  
  -- User preferences and customization
  tags TEXT[], -- User-defined tags for categorization
  is_favorite BOOLEAN DEFAULT FALSE,
  is_public BOOLEAN DEFAULT FALSE, -- Whether user wants to share this session
  
  -- Usage statistics
  times_completed INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2) CHECK (average_rating >= 0 AND average_rating <= 5),
  total_rating_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_completed_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better performance
CREATE INDEX idx_custom_mental_sessions_profile_id ON custom_mental_sessions(profile_id);
CREATE INDEX idx_custom_mental_sessions_type ON custom_mental_sessions(session_type);
CREATE INDEX idx_custom_mental_sessions_ai_generated ON custom_mental_sessions(is_ai_generated);
CREATE INDEX idx_custom_mental_sessions_public ON custom_mental_sessions(is_public);
CREATE INDEX idx_custom_mental_sessions_created_at ON custom_mental_sessions(created_at DESC);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_custom_mental_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_custom_mental_sessions_updated_at
  BEFORE UPDATE ON custom_mental_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_custom_mental_sessions_updated_at();

-- Enable Row Level Security (RLS)
ALTER TABLE custom_mental_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view their own sessions and public sessions
CREATE POLICY "Users can view own and public custom sessions"
  ON custom_mental_sessions FOR SELECT
  TO authenticated
  USING (
    profile_id = auth.uid() OR 
    is_public = true
  );

-- Users can insert their own sessions
CREATE POLICY "Users can create own custom sessions"
  ON custom_mental_sessions FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

-- Users can update their own sessions
CREATE POLICY "Users can update own custom sessions"
  ON custom_mental_sessions FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

-- Users can delete their own sessions
CREATE POLICY "Users can delete own custom sessions"
  ON custom_mental_sessions FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());

-- Grant necessary permissions
GRANT ALL ON custom_mental_sessions TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Create a view for session statistics
CREATE VIEW custom_mental_sessions_stats AS
SELECT 
  profile_id,
  COUNT(*) as total_sessions,
  COUNT(*) FILTER (WHERE is_ai_generated = true) as ai_generated_sessions,
  COUNT(*) FILTER (WHERE is_ai_generated = false) as manual_sessions,
  COUNT(*) FILTER (WHERE session_type = 'meditation') as meditation_sessions,
  COUNT(*) FILTER (WHERE session_type = 'breathing') as breathing_sessions,
  COUNT(*) FILTER (WHERE session_type = 'mindfulness') as mindfulness_sessions,
  COUNT(*) FILTER (WHERE session_type = 'relaxation') as relaxation_sessions,
  AVG(duration_minutes) as average_duration,
  SUM(times_completed) as total_completions,
  AVG(average_rating) as overall_average_rating
FROM custom_mental_sessions
GROUP BY profile_id;

-- Grant access to the view
GRANT SELECT ON custom_mental_sessions_stats TO authenticated;

-- Create a function to increment session completion count
CREATE OR REPLACE FUNCTION increment_session_completion(session_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE custom_mental_sessions
  SET 
    times_completed = times_completed + 1,
    last_completed_at = NOW()
  WHERE id = session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION increment_session_completion(UUID) TO authenticated;

-- Create a function to update session rating
CREATE OR REPLACE FUNCTION update_session_rating(
  session_id UUID,
  new_rating DECIMAL(3,2)
)
RETURNS VOID AS $$
DECLARE
  current_avg DECIMAL(3,2);
  current_count INTEGER;
  new_avg DECIMAL(3,2);
BEGIN
  -- Get current average and count
  SELECT average_rating, total_rating_count
  INTO current_avg, current_count
  FROM custom_mental_sessions
  WHERE id = session_id;
  
  -- Calculate new average
  new_avg := ((current_avg * current_count) + new_rating) / (current_count + 1);
  
  -- Update the session
  UPDATE custom_mental_sessions
  SET 
    average_rating = new_avg,
    total_rating_count = total_rating_count + 1
  WHERE id = session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION update_session_rating(UUID, DECIMAL) TO authenticated;

-- Insert some example data (optional - for testing)
-- INSERT INTO custom_mental_sessions (
--   profile_id,
--   title,
--   description,
--   session_type,
--   duration_minutes,
--   steps,
--   benefits,
--   difficulty_level,
--   is_ai_generated
-- ) VALUES (
--   'your-profile-id-here',
--   'Morning Energy Boost',
--   'A quick 5-minute breathing exercise to energize your morning',
--   'breathing',
--   5,
--   '[
--     {"step": 1, "instruction": "Sit comfortably with your back straight"},
--     {"step": 2, "instruction": "Take 3 deep breaths through your nose"},
--     {"step": 3, "instruction": "Hold each breath for 2 seconds"},
--     {"step": 4, "instruction": "Exhale slowly through your mouth"},
--     {"step": 5, "instruction": "Repeat for 5 minutes"}
--   ]'::jsonb,
--   ARRAY['Increased energy', 'Better focus', 'Reduced stress'],
--   'beginner',
--   false
-- );

COMMENT ON TABLE custom_mental_sessions IS 'Stores user-created and AI-generated mental wellness sessions';
COMMENT ON COLUMN custom_mental_sessions.steps IS 'JSON array of step objects with instructions';
COMMENT ON COLUMN custom_mental_sessions.benefits IS 'Array of benefit descriptions';
COMMENT ON COLUMN custom_mental_sessions.is_ai_generated IS 'Whether this session was generated by AI';
COMMENT ON COLUMN custom_mental_sessions.ai_prompt IS 'The prompt used to generate AI sessions';
COMMENT ON COLUMN custom_mental_sessions.tags IS 'User-defined tags for categorization';
COMMENT ON COLUMN custom_mental_sessions.is_public IS 'Whether user wants to share this session with others';
