/*
  # Add Webhook Trigger for User Creation

  1. New Features
    - Create a webhook trigger function that fires when a new user is created
    - This function will call the create-stripe-customer edge function
    - Ensures every new user automatically gets a Stripe customer record

  2. Security
    - Function uses security definer to ensure proper permissions
    - Only triggers on INSERT operations to auth.users
*/

-- Create a function to call the webhook when a new user is created
CREATE OR REPLACE FUNCTION public.handle_new_user_webhook()
RETURNS trigger AS $$
DECLARE
  webhook_url text;
BEGIN
  -- Set the webhook URL to the create-stripe-customer edge function
  webhook_url := current_setting('app.settings.webhook_url', true);
  
  -- If webhook URL is not set, use a default URL pattern based on Supabase project URL
  IF webhook_url IS NULL THEN
    webhook_url := current_setting('app.settings.supabase_url', true) || '/functions/v1/create-stripe-customer';
  END IF;
  
  -- Make an asynchronous HTTP request to the webhook
  PERFORM net.http_post(
    url := webhook_url,
    body := json_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', row_to_json(NEW)
    )::text,
    headers := json_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.anon_key', true)
    )
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to call the webhook function when a new user is created
DROP TRIGGER IF EXISTS on_auth_user_created_webhook ON auth.users;
CREATE TRIGGER on_auth_user_created_webhook
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_webhook();

-- Set the webhook URL and anon key as database settings
-- Note: These will need to be set by an administrator
COMMENT ON FUNCTION public.handle_new_user_webhook() IS 'Triggers a webhook when a new user is created';