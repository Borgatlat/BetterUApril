-- Add 'photo_meal' to the ai_generation_usage feature_type enum
-- Used for daily limit: 5/day premium, 0/day free

ALTER TABLE ai_generation_usage DROP CONSTRAINT IF EXISTS ai_generation_usage_feature_type_check;
ALTER TABLE ai_generation_usage ADD CONSTRAINT ai_generation_usage_feature_type_check
  CHECK (feature_type IN ('workout', 'meal', 'mental_session', 'photo_meal'));
