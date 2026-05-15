-- Add reply from partner to a check-in (so the other person can respond after viewing)
ALTER TABLE accountability_check_ins
  ADD COLUMN IF NOT EXISTS reply_by_partner TEXT,
  ADD COLUMN IF NOT EXISTS reply_at TIMESTAMP WITH TIME ZONE;

-- Allow partner to update the row (so they can set reply_by_partner on the other's check-in)
DROP POLICY IF EXISTS "Users can update own check-in" ON accountability_check_ins;
CREATE POLICY "Users can update own check-in"
    ON accountability_check_ins FOR UPDATE TO authenticated
    USING (auth.uid() = user_id OR auth.uid() = partner_id)
    WITH CHECK (auth.uid() = user_id OR auth.uid() = partner_id);
