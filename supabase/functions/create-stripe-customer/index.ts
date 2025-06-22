import { createClient } from 'npm:@supabase/supabase-js@2.38.4';
import Stripe from 'npm:stripe@13.2.0';

// Environment variables
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Validate environment variables
    if (!STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase credentials are not configured');
    }

    // Parse request body
    const { record } = await req.json();

    // Validate webhook payload
    if (!record || !record.id || !record.email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid webhook payload. Missing user data.',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check if user already has a Stripe customer ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('revenuecat_user_id')
      .eq('user_id', record.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching user profile:', profileError);
      throw new Error(`Failed to fetch user profile: ${profileError.message}`);
    }

    // If user already has a Stripe customer ID, return early
    if (profile?.revenuecat_user_id) {
      console.log(`User ${record.id} already has Stripe customer ID: ${profile.revenuecat_user_id}`);
      return new Response(
        JSON.stringify({
          success: true,
          message: 'User already has a Stripe customer ID',
          customerId: profile.revenuecat_user_id,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // Initialize Stripe
    const stripe = new Stripe(STRIPE_SECRET_KEY);

    // Create a new Stripe customer
    const customer = await stripe.customers.create({
      email: record.email,
      name: record.user_metadata?.name || record.email.split('@')[0],
      metadata: {
        supabase_user_id: record.id,
      },
    });

    console.log(`Created Stripe customer ${customer.id} for user ${record.id}`);

    // Save the Stripe customer ID to the user's profile
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ revenuecat_user_id: customer.id })
      .eq('user_id', record.id);

    if (updateError) {
      console.error('Error updating user profile with Stripe customer ID:', updateError);
      throw new Error(`Failed to update user profile: ${updateError.message}`);
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Stripe customer created and linked to user profile',
        customerId: customer.id,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in create-stripe-customer function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'An unexpected error occurred',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});