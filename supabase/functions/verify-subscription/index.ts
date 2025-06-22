import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.38.4';
import Stripe from 'npm:stripe@13.2.0';

// Environment variables
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface VerifyRequest {
  sessionId: string;
  userId: string;
}

Deno.serve(async (req: Request) => {
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
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Stripe secret key is not configured',
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

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Supabase credentials are not configured',
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

    // Parse request body
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Method not allowed. Use POST.',
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const requestData: VerifyRequest = await req.json();
    const { sessionId, userId } = requestData;

    // Validate input
    if (!sessionId || !userId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Session ID and User ID are required',
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

    // Initialize Stripe
    const stripe = new Stripe(STRIPE_SECRET_KEY);

    // Initialize Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Retrieve the checkout session
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (!session) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid session ID',
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

      // Check if the session was successful
      if (session.payment_status !== 'paid' && session.status !== 'complete') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Payment not completed',
            session_status: session.status,
            payment_status: session.payment_status,
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

      // Get the subscription
      if (!session.subscription) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No subscription found in session',
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

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      
      // Determine subscription tier based on the price
      const priceId = subscription.items.data[0].price.id;
      const isMonthly = priceId === Deno.env.get('STRIPE_PRICE_ID_MONTHLY');
      const tier = isMonthly ? 'premium' : 'premium_plus';
      
      // Update the user's profile with subscription info
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          subscription_status: 'premium',
          subscription_tier: tier,
          subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
      
      if (updateError) {
        console.error('Error updating user profile with subscription info:', updateError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to update user profile with subscription info',
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

      // Return success
      return new Response(
        JSON.stringify({
          success: true,
          subscription_status: 'premium',
          subscription_tier: tier,
          subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    } catch (stripeError) {
      console.error('Error retrieving Stripe session:', stripeError);
      
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to verify subscription status',
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
  } catch (error) {
    console.error('Unexpected error in verify subscription function:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected error occurred',
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