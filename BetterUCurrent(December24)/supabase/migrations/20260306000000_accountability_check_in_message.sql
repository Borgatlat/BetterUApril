-- Add optional "message to partner" and "how you can help" fields to check-ins
ALTER TABLE accountability_check_ins
  ADD COLUMN IF NOT EXISTS message_to_partner TEXT,
  ADD COLUMN IF NOT EXISTS how_you_can_help TEXT;
