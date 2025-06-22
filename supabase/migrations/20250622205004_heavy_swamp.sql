/*
  # Enable HTTP Extension for Webhook Functionality

  1. Database Changes
    - Enable the http extension for making HTTP requests from database triggers
    - This is required for the webhook functionality to work

  2. Security
    - Extension is enabled with proper permissions
    - Only used by security definer functions
*/

-- Enable the http extension if it's not already enabled
CREATE EXTENSION IF NOT EXISTS "http" WITH SCHEMA "extensions";

-- Grant usage to authenticated and anon roles
GRANT USAGE ON SCHEMA extensions TO authenticated, anon;

-- Create a wrapper schema for net functions
CREATE SCHEMA IF NOT EXISTS net;

-- Create a wrapper function for http_post in the net schema
CREATE OR REPLACE FUNCTION net.http_post(
  url text,
  body text DEFAULT NULL,
  params jsonb DEFAULT NULL,
  headers jsonb DEFAULT NULL,
  timeout_milliseconds integer DEFAULT 1000
)
RETURNS TABLE (
  status integer,
  content text,
  mimetype text,
  headers jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT
    *
  FROM
    extensions.http((
      'POST',
      url,
      COALESCE(params, '{}'::jsonb),
      COALESCE(headers, '{}'::jsonb),
      body,
      timeout_milliseconds
    )::extensions.http_request);
END;
$$;

-- Grant execute permission on the wrapper function
GRANT EXECUTE ON FUNCTION net.http_post TO authenticated, anon;

COMMENT ON FUNCTION net.http_post IS 'Wrapper for extensions.http_post with security definer';