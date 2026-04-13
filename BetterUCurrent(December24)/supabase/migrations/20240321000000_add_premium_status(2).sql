-- Add isPremium column to profiles
ALTER TABLE profiles ADD COLUMN is_premium BOOLEAN DEFAULT false;

-- Create a function to update premium status
CREATE OR REPLACE FUNCTION update_premium_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the profile's premium status based on active subscriptions
    UPDATE profiles
    SET is_premium = EXISTS (
        SELECT 1
        FROM subscriptions
        WHERE subscriptions.user_id = profiles.id
        AND subscriptions.status = 'active'
        AND subscriptions.end_date > NOW()
    )
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for subscription changes
CREATE TRIGGER update_premium_on_subscription_change
AFTER INSERT OR UPDATE OR DELETE ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_premium_status();

-- Create a function to refresh all premium statuses
CREATE OR REPLACE FUNCTION refresh_all_premium_statuses()
RETURNS void AS $$
BEGIN
    UPDATE profiles
    SET is_premium = EXISTS (
        SELECT 1
        FROM subscriptions
        WHERE subscriptions.user_id = profiles.id
        AND subscriptions.status = 'active'
        AND subscriptions.end_date > NOW()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION update_premium_status() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_all_premium_statuses() TO authenticated;

-- Set up RLS policies for the is_premium column
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Allow users to read is_premium status of other users
CREATE POLICY "Users can read premium status of other users"
ON profiles FOR SELECT
TO authenticated
USING (true);

-- Only allow the system to update is_premium
CREATE POLICY "Only system can update premium status"
ON profiles FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- Initial update of all premium statuses
SELECT refresh_all_premium_statuses(); 