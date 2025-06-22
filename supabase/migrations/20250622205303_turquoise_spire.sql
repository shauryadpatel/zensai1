/*
  # Fix User Signup Database Trigger

  1. Database Functions
    - Update or create `handle_new_user()` function to properly create user profiles
    - Ensure the function handles all required fields and potential conflicts

  2. Triggers
    - Create trigger to automatically create profile when new user signs up
    - Ensure trigger fires after user creation in auth.users table

  3. Security
    - Function runs with SECURITY DEFINER to have proper permissions
    - Handles edge cases and prevents duplicate profile creation
*/

-- Drop existing function and trigger if they exist to recreate them properly
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create the function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert new profile for the user
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
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    0,
    0,
    3,
    0,
    'free',
    'free',
    NOW(),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING; -- Prevent duplicate profiles
  
  RETURN NEW;
END;
$$
LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger to automatically call the function when a new user is created
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;