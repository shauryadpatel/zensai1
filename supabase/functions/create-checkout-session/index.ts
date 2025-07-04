import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.38.4';
import Stripe from 'npm:stripe@13.2.0';

// Environment variables
const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const APP_URL = Deno.env.get('APP_URL') || 'http://localhost:5173'; // Default for local development

// Price IDs for subscription plans
const PRICE_IDS = {
  MONTHLY: Deno.env.get('STRIPE_PRICE_ID_MONTHLY'),
  YEARLY: Deno.env.get('STRIPE_PRICE_ID_YEARLY'),
};

interface CheckoutRequest {
  priceId: string;
  userId: string;
  email: string;
  name?: string;
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
    // Validate environment variables with specific error messages
    const missingVars = [];
    
    if (!STRIPE_SECRET_KEY) {
      missingVars.push('STRIPE_SECRET_KEY');
    }
    if (!SUPABASE_URL) {
      missingVars.push('SUPABASE_URL');
    }
    if (!SUPABASE_SERVICE_ROLE_KEY) {
      missingVars.push('SUPABASE_SERVICE_ROLE_KEY');
    }
    if (!PRICE_IDS.MONTHLY) {
      missingVars.push('STRIPE_PRICE_ID_MONTHLY');
    }
    if (!PRICE_IDS.YEARLY) {
      missingVars.push('STRIPE_PRICE_ID_YEARLY');
    }

    if (missingVars.length > 0) {
      console.error('Missing environment variables:', missingVars);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Missing required environment variables: ${missingVars.join(', ')}. Please configure these in your Supabase project settings.`,
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

    const requestData: CheckoutRequest = await req.json();
    const { priceId, userId, email, name } = requestData;

    // Validate input
    if (!priceId || !userId || !email) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: priceId, userId, and email are required',
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

    // Validate price ID
    if (priceId !== PRICE_IDS.MONTHLY && priceId !== PRICE_IDS.YEARLY) {
      console.error('Invalid price ID received:', priceId);
      console.error('Expected price IDs:', PRICE_IDS.MONTHLY, 'or', PRICE_IDS.YEARLY);
      console.error('Received price ID:', priceId);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid price ID: ${priceId}. Expected one of: ${PRICE_IDS.MONTHLY}, ${PRICE_IDS.YEARLY}`,
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

    // Look up the user's profile to check for existing Stripe customer ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('revenuecat_user_id')
      .eq('user_id', userId)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error fetching user profile:', profileError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch user profile from database',
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

    let customerId = profile?.revenuecat_user_id;

    // Create a new customer if one doesn't exist
    // Or if the existing customer ID is invalid
    let customerExists = false;
    
    if (customerId) {
      try {
        // Verify the customer exists in Stripe
        await stripe.customers.retrieve(customerId);
        customerExists = true;
      } catch (stripeError) {
        console.log(`Customer ID ${customerId} not found in Stripe, will create a new one:`, stripeError);
        customerExists = false;
      }
    }
    
    if (!customerExists) {
      try {
        const customer = await stripe.customers.create({
          email,
          name: name || email.split('@')[0],
          metadata: {
            userId,
          },
        });
        
        customerId = customer.id;
        
        // Update the user's profile with the Stripe customer ID
        const { error: updateError } = await supabase
          .from('profiles')
          .update({ revenuecat_user_id: customerId })
          .eq('user_id', userId);
        
        if (updateError) {
          console.error('Error updating profile with new Stripe customer ID:', updateError);
          // We'll continue anyway since we have a valid customer ID now
          console.log('Continuing with checkout using new customer ID:', customerId);
        }
        else {
          console.log(`Successfully created and saved Stripe customer ID ${customerId} for user ${userId}`);
        }
      } catch (stripeError) {
        console.error('Error creating Stripe customer:', stripeError);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to create Stripe customer',
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
    }

    // Create a checkout session
    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId, // Now we're sure this is a valid customer ID
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription' as const,
        subscription_data: {
          trial_period_days: 7,
          metadata: {
            userId: userId,
          },
        },
        success_url: `${APP_URL}/home?subscription=success&session_id={CHECKOUT_SESSION_ID}&t=${Date.now()}`,
        cancel_url: `${APP_URL}/premium?subscription=canceled&t=${Date.now()}`,
        metadata: {
          userId: userId,
        },
      });

      // Return the checkout session URL
      console.log('Checkout session created successfully for customer:', customerId, 'session ID:', session.id);
      return new Response(
        JSON.stringify({
          success: true,
          url: session.url,
          session_id: session.id,
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
      console.error('Error creating Stripe checkout session:', stripeError);
      
      // Get more detailed error information
      let errorMessage = 'Failed to create checkout session';
      if (stripeError instanceof Error) {
        errorMessage = stripeError.message;
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
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
    console.error('Unexpected error in checkout session function:', error);
    
    // Get more detailed error information
    let errorMessage = 'An unexpected error occurred';
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
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