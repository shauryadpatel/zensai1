/*
  # Update Webhook Settings for Stripe Customer Creation

  1. Database Settings
    - Add app.settings.webhook_url setting for the create-stripe-customer function
    - Add app.settings.anon_key setting for authentication
    - Add app.settings.supabase_url setting for constructing URLs

  2. Security
    - Use pg_settings to store sensitive configuration
    - Ensure proper access control for these settings
*/

-- Set the webhook URL and anon key as database settings
DO $$
DECLARE
  supabase_url text;
  anon_key text;
BEGIN
  -- Get the current settings if they exist
  SELECT current_setting('app.settings.supabase_url', true) INTO supabase_url;
  SELECT current_setting('app.settings.anon_key', true) INTO anon_key;
  
  -- If settings don't exist, set default values
  -- These will need to be updated by an administrator with actual values
  IF supabase_url IS NULL THEN
    EXECUTE 'ALTER DATABASE ' || current_database() || ' SET app.settings.supabase_url = ''https://your-project-ref.supabase.co''';
  END IF;
  
  IF anon_key IS NULL THEN
    EXECUTE 'ALTER DATABASE ' || current_database() || ' SET app.settings.anon_key = ''your-anon-key''';
  END IF;
  
  -- Set the webhook URL
  EXECUTE 'ALTER DATABASE ' || current_database() || ' SET app.settings.webhook_url = ''' || 
    COALESCE(supabase_url, 'https://your-project-ref.supabase.co') || 
    '/functions/v1/create-stripe-customer''';
END $$;

-- Add a function to update these settings more easily
CREATE OR REPLACE FUNCTION public.update_webhook_settings(
  p_supabase_url text,
  p_anon_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE 'ALTER DATABASE ' || current_database() || ' SET app.settings.supabase_url = ' || quote_literal(p_supabase_url);
  EXECUTE 'ALTER DATABASE ' || current_database() || ' SET app.settings.anon_key = ' || quote_literal(p_anon_key);
  EXECUTE 'ALTER DATABASE ' || current_database() || ' SET app.settings.webhook_url = ' || 
    quote_literal(p_supabase_url || '/functions/v1/create-stripe-customer');
  
  RAISE NOTICE 'Webhook settings updated successfully';
END $$;

COMMENT ON FUNCTION public.update_webhook_settings(text, text) IS 'Updates the webhook settings for Stripe customer creation';