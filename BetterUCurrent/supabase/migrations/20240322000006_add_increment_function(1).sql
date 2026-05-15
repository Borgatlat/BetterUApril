-- Create the increment function
CREATE OR REPLACE FUNCTION increment(x integer)
RETURNS integer AS $$
BEGIN
    RETURN COALESCE(x, 0) + 1;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment(integer) TO authenticated; 