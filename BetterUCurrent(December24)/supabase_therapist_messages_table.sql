-- Create therapist_messages table
CREATE TABLE therapist_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_user BOOLEAN DEFAULT false,
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for efficient querying
CREATE INDEX idx_therapist_messages_user_date ON therapist_messages(user_id, date);

-- Enable Row Level Security
ALTER TABLE therapist_messages ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own therapist messages" ON therapist_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own therapist messages" ON therapist_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_therapist_messages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_therapist_messages_updated_at
  BEFORE UPDATE ON therapist_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_therapist_messages_updated_at(); 