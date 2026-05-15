-- Create subscriptions table if it doesn't exist
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    subscription_id TEXT NOT NULL,
    status TEXT NOT NULL,
    plan_type TEXT NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id)
);

-- Create function to handle subscription creation/update
CREATE OR REPLACE FUNCTION handle_subscription()
RETURNS TRIGGER AS $$
BEGIN
    -- If a subscription already exists for this user, update it
    IF EXISTS (SELECT 1 FROM subscriptions WHERE user_id = NEW.user_id) THEN
        UPDATE subscriptions
        SET 
            subscription_id = NEW.subscription_id,
            status = NEW.status,
            plan_type = NEW.plan_type,
            start_date = NEW.start_date,
            end_date = NEW.end_date,
            updated_at = timezone('utc'::text, now())
        WHERE user_id = NEW.user_id;
        RETURN NULL;
    END IF;
    
    -- Otherwise, insert the new subscription
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to handle subscription updates
DROP TRIGGER IF EXISTS on_subscription_change ON subscriptions;
CREATE TRIGGER on_subscription_change
    BEFORE INSERT ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION handle_subscription();

-- Add RLS policies
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own subscription
CREATE POLICY "Users can view own subscription"
    ON subscriptions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy for users to update their own subscription
CREATE POLICY "Users can update own subscription"
    ON subscriptions
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy for service role to manage subscriptions
CREATE POLICY "Service role can manage subscriptions"
    ON subscriptions
    USING (auth.role() = 'service_role'); 