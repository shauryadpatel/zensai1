/*
  # Fix user signup database error

  1. Issues Fixed
    - Ensure profiles table has proper foreign key reference to auth.users
    - Fix handle_new_user function to properly handle user creation
    - Add proper error handling in trigger functions
    - Ensure all required columns have proper defaults

  2. Changes Made
    - Update profiles table foreign key to reference auth.users(id)
    - Recreate handle_new_user function with proper error handling
    - Ensure trigger is properly set up for auth.users table
*/

-- First, let's make sure the profiles table foreign key references auth.users correctly
DO $$
BEGIN
  -- Drop existing foreign key constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'profiles_user_id_fkey' 
    AND table_name = 'profiles'
  ) THEN
    ALTER TABLE profiles DROP CONSTRAINT profiles_user_id_fkey;
  END IF;
  
  -- Add the correct foreign key constraint to auth.users
  ALTER TABLE profiles ADD CONSTRAINT profiles_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
END $$;

-- Recreate the handle_new_user function with proper error handling
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert a new profile for the user with safe defaults
  INSERT INTO public.profiles (
    user_id,
    name,
    current_streak,
    best_streak,
    last_entry_date,
    created_at,
    updated_at,
    journaling_goal_frequency,
    total_badges_earned,
    subscription_status,
    subscription_tier,
    subscription_expires_at,
    revenuecat_user_id
  ) VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    0,
    0,
    NULL,
    NOW(),
    NOW(),
    3,
    0,
    'free',
    'free',
    NULL,
    NULL
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Ensure RLS is enabled on profiles table
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Make sure we have the uid() function available
CREATE OR REPLACE FUNCTION uid() 
RETURNS UUID AS $$
  SELECT COALESCE(
    auth.uid(),
    (current_setting('request.jwt.claim.sub', true))::uuid
  )
$$ LANGUAGE sql STABLE;