-- Ban Disputes System
-- Allows banned users to dispute their ban and admins to review disputes

-- Create ban_disputes table
CREATE TABLE IF NOT EXISTS public.ban_disputes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ban_id UUID NOT NULL REFERENCES public.bans(id) ON DELETE CASCADE,
  
  -- Dispute content
  dispute_message TEXT NOT NULL,
  
  -- Status: 'pending', 'approved' (unbanned), 'rejected' (ignored)
  status VARCHAR(20) DEFAULT 'pending' NOT NULL,
  
  -- Admin who reviewed (if reviewed)
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT, -- Optional notes from admin
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Note: We enforce one active dispute per user via the create_ban_dispute function

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_ban_disputes_user_id ON public.ban_disputes(user_id);
CREATE INDEX IF NOT EXISTS idx_ban_disputes_ban_id ON public.ban_disputes(ban_id);
CREATE INDEX IF NOT EXISTS idx_ban_disputes_status ON public.ban_disputes(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_ban_disputes_reviewed_by ON public.ban_disputes(reviewed_by);

-- Enable Row Level Security
ALTER TABLE public.ban_disputes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can view their own disputes" ON public.ban_disputes;
DROP POLICY IF EXISTS "Users can create disputes for their bans" ON public.ban_disputes;
DROP POLICY IF EXISTS "Admins can view all disputes" ON public.ban_disputes;
DROP POLICY IF EXISTS "Admins can update disputes" ON public.ban_disputes;

-- RLS Policy: Users can view their own disputes
CREATE POLICY "Users can view their own disputes" ON public.ban_disputes
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS Policy: Users can create disputes for their own bans
CREATE POLICY "Users can create disputes for their bans" ON public.ban_disputes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Admins can view all disputes
CREATE POLICY "Admins can view all disputes" ON public.ban_disputes
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- RLS Policy: Admins can update disputes (review them)
CREATE POLICY "Admins can update disputes" ON public.ban_disputes
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Function to check if user has active dispute
CREATE OR REPLACE FUNCTION public.has_active_dispute(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.ban_disputes
    WHERE user_id = p_user_id AND status = 'pending'
  );
END;
$$;

-- Function to create dispute (with validation)
CREATE OR REPLACE FUNCTION public.create_ban_dispute(
  p_user_id UUID,
  p_ban_id UUID,
  p_dispute_message TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_dispute_id UUID;
  v_has_active BOOLEAN;
BEGIN
  -- Check if user already has an active dispute
  SELECT has_active_dispute(p_user_id) INTO v_has_active;
  
  IF v_has_active THEN
    RAISE EXCEPTION 'You already have an active dispute. Please wait for it to be reviewed.';
  END IF;
  
  -- Verify the ban belongs to the user
  IF NOT EXISTS (
    SELECT 1 FROM public.bans
    WHERE id = p_ban_id AND user_id = p_user_id AND is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'Invalid ban or ban does not belong to you.';
  END IF;
  
  -- Create the dispute
  INSERT INTO public.ban_disputes (user_id, ban_id, dispute_message)
  VALUES (p_user_id, p_ban_id, p_dispute_message)
  RETURNING id INTO v_dispute_id;
  
  RETURN v_dispute_id;
END;
$$;

-- Function for admins to review disputes (approve = unban, reject = ignore)
CREATE OR REPLACE FUNCTION public.review_ban_dispute(
  p_dispute_id UUID,
  p_action VARCHAR, -- 'approve' or 'reject'
  p_admin_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_ban_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- Check if current user is admin
  SELECT is_admin INTO v_is_admin
  FROM public.profiles
  WHERE id = auth.uid();
  
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can review disputes.';
  END IF;
  
  -- Get dispute info
  SELECT user_id, ban_id INTO v_user_id, v_ban_id
  FROM public.ban_disputes
  WHERE id = p_dispute_id AND status = 'pending';
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Dispute not found or already reviewed.';
  END IF;
  
  -- Update dispute status
  UPDATE public.ban_disputes
  SET 
    status = CASE WHEN p_action = 'approve' THEN 'approved' ELSE 'rejected' END,
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    admin_notes = p_admin_notes,
    updated_at = NOW()
  WHERE id = p_dispute_id;
  
  -- If approved, unban the user
  IF p_action = 'approve' THEN
    UPDATE public.bans
    SET is_active = FALSE
    WHERE id = v_ban_id;
    
    -- Note: Profile ban status is automatically updated by the trigger_update_profile_ban_status trigger
    -- when is_active changes to FALSE, so we don't need to manually update profiles here
  END IF;
  
  RETURN TRUE;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.has_active_dispute(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_ban_dispute(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_ban_dispute(UUID, VARCHAR, TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE public.ban_disputes IS 'Stores ban disputes submitted by users and reviewed by admins';
COMMENT ON COLUMN public.ban_disputes.status IS 'pending: awaiting review, approved: user unbanned, rejected: ban upheld';
COMMENT ON COLUMN public.ban_disputes.admin_notes IS 'Optional notes from admin explaining their decision';

