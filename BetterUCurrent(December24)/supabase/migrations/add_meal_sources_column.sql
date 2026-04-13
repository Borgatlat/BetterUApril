-- Migration: Add sources column to meals table
-- This migration adds a sources column to store the approved health sources used by the AI meal generator

-- Add sources column to meals table
-- This column stores an array of source URLs that the AI used to generate the meal
-- It's a JSONB array to allow flexible storage of source information
ALTER TABLE meals 
ADD COLUMN IF NOT EXISTS sources JSONB DEFAULT '[]'::jsonb;

-- Add a comment to document the column
COMMENT ON COLUMN meals.sources IS 'Array of approved health source URLs used by the AI to generate this meal';

