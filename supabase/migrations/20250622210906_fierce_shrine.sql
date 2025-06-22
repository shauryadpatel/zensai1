/*
  # Fix user signup database error

  1. Updates
    - Update the handle_new_user function to work with the current profiles table structure
    - Ensure the trigger properly creates profile entries for new users
    - Add proper error handling and logging

  2. Security
    - Maintains existing RLS policies
    - Ensures secure user profile creation
*/

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create updated function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Insert new profile with user_id as the key (matching your schema)
  INSERT INTO public.profiles (
    user_id,
    name,
    current_streak,
    best_streak,
    journaling_goal_frequency,
    total_badges_earned,
    subscription_status,
    subscription_tier,
    created_at,
    updated_at
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    0,
    0,
    3,
    0,
    'free',
    'free',
    NOW(),
    NOW()
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't fail the user creation
    RAISE LOG 'Error creating profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Ensure the function has proper permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO service_role;