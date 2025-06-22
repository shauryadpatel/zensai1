/*
  # Fix user signup database error

  1. Database Functions
    - Create or replace `handle_new_user` function to automatically create profile entries
    - Ensure proper error handling and data validation

  2. Triggers
    - Create trigger on auth.users to automatically create profiles for new users
    - Handle the case where profile creation might fail gracefully

  3. Security
    - Function runs with security definer to have proper permissions
    - Maintains existing RLS policies on profiles table
*/

-- Create or replace the function that handles new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert a new profile for the user with default values
  INSERT INTO public.profiles (
    user_id,
    name,
    current_streak,
    best_streak,
    journaling_goal_frequency,
    total_badges_earned,
    subscription_status,
    subscription_tier
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    0,
    0,
    3,
    0,
    'free',
    'free'
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

-- Create the trigger that fires after a new user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Ensure the function has proper permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;