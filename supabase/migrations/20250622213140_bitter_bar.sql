/*
  # Fix handle_new_user function to prevent signup failures
  
  1. Changes
    - Recreate the handle_new_user function with proper error handling
    - Ensure the function has the correct column names matching the profiles table
    - Add EXCEPTION block to prevent transaction rollback on profile creation failure
    - Make sure the function is SECURITY DEFINER to run with elevated privileges
  
  2. Purpose
    - Fix the "Database error saving new user" error during signup
    - Ensure user creation succeeds even if profile creation fails
    - Log any errors for debugging without breaking the signup flow
*/

-- Recreate the handle_new_user function with proper error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
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
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();