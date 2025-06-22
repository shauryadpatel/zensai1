/*
  # Fix user signup trigger

  1. New Functions
    - `handle_new_user()` - Creates a profile entry when a new user signs up
  
  2. Security
    - Trigger fires on auth.users INSERT to automatically create profile
    - Ensures every new user gets a corresponding profile entry
  
  3. Changes
    - Creates or replaces the handle_new_user function
    - Ensures trigger is properly configured on auth.users table
*/

-- Create or replace the function that handles new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'name', new.email)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop the trigger if it exists and recreate it
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();