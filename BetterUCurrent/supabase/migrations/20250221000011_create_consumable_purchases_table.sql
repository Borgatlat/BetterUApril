-- Create consumable_purchases table
-- This table tracks consumable in-app purchases (like Neuros) for analytics and duplicate prevention
-- Unlike subscriptions, consumables are one-time purchases that don't expire

CREATE TABLE IF NOT EXISTS public.consumable_purchases (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- User identification
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- Product information
    product_id TEXT NOT NULL, -- The product identifier (e.g., 'neuros_10000')
    neuros_amount INTEGER NOT NULL, -- Amount of neuros credited for this purchase
    
    -- Transaction tracking
    transaction_id TEXT NOT NULL, -- RevenueCat transaction ID or fallback ID
    original_transaction_id TEXT, -- Apple's original transaction ID if available
    
    -- Platform
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'mock')),
    
    -- Timestamps
    purchase_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Prevent duplicate credits for the same transaction
    UNIQUE(transaction_id, user_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_consumable_purchases_user_id ON public.consumable_purchases(user_id);
CREATE INDEX IF NOT EXISTS idx_consumable_purchases_product_id ON public.consumable_purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_consumable_purchases_transaction_id ON public.consumable_purchases(transaction_id);
CREATE INDEX IF NOT EXISTS idx_consumable_purchases_purchase_date ON public.consumable_purchases(purchase_date);

-- Enable Row Level Security
ALTER TABLE public.consumable_purchases ENABLE ROW LEVEL SECURITY;

-- Create policies
-- Users can view their own consumable purchases
CREATE POLICY "Users can view their own consumable purchases"
    ON public.consumable_purchases FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own consumable purchases (when purchase completes)
CREATE POLICY "Users can insert their own consumable purchases"
    ON public.consumable_purchases FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_consumable_purchase_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update the updated_at timestamp
CREATE TRIGGER update_consumable_purchase_updated_at
    BEFORE UPDATE ON public.consumable_purchases
    FOR EACH ROW
    EXECUTE FUNCTION update_consumable_purchase_updated_at();

-- Add comments for documentation
COMMENT ON TABLE public.consumable_purchases IS 'Tracks consumable in-app purchases (like Neuros currency purchases). Used for analytics and preventing duplicate credits.';
COMMENT ON COLUMN public.consumable_purchases.product_id IS 'The product identifier from App Store Connect (e.g., "neuros_10000")';
COMMENT ON COLUMN public.consumable_purchases.neuros_amount IS 'Amount of Neuros credited to the user for this purchase';
COMMENT ON COLUMN public.consumable_purchases.transaction_id IS 'Unique transaction identifier from RevenueCat or Apple. Used to prevent duplicate credits.';
