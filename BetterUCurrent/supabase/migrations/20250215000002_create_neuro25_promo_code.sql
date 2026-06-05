-- Create the 'neuro25' promo code
-- This code awards 25 neuros to users who redeem it

INSERT INTO public.promo_codes (
  code,
  code_uppercase,
  reward_type,
  neuros_amount,
  badge_id,
  max_uses,
  max_uses_per_user,
  is_active,
  expires_at,
  description
)
VALUES (
  'neuro25',                    -- The actual code users will enter
  'NEURO25',                    -- Uppercase version for case-insensitive matching
  'neuros',                     -- Reward type: neuros only (not badge)
  25,                           -- Amount of neuros to award
  NULL,                         -- No badge for this code
  NULL,                         -- No maximum uses limit (unlimited)
  1,                            -- Each user can only redeem once
  true,                         -- Code is active
  NULL,                         -- No expiration date (never expires)
  'Redeem this code to receive 25 Neuros! Use Neuros to purchase exclusive profile themes and customize your workout posts.' -- Description of the reward
)
ON CONFLICT (code) DO NOTHING;  -- Don't error if code already exists

COMMENT ON TABLE public.promo_codes IS 'Promo code neuro25 created: Awards 25 neuros to users. Unlimited uses, one per user.';

