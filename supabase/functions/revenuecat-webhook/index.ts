import { corsHeaders } from '../_shared/cors.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.38.4';
import * as crypto from 'https://deno.land/std@0.177.0/crypto/mod.ts';

// Environment variables
const REVENUECAT_SECRET_API_KEY = Deno.env.get('REVENUECAT_SECRET_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface RevenueCatEvent {
  event: {
    type: string;
    app_user_id: string;
    product_id: string;
    entitlement_id?: string;
    expires_date?: string;
    purchase_date?: string;
    original_purchase_date?: string;
    environment: 'PRODUCTION' | 'SANDBOX';
  };
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
    if (!REVENUECAT_SECRET_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Missing required environment variables');
    }

    // Only allow POST requests
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

    // Get the signature from the headers
    const signature = req.headers.get('X-Signature');
    if (!signature) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing RevenueCat signature',
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

    // Get the raw body
    const body = await req.text();

    // Verify the webhook signature
    const isValidSignature = await verifySignature(body, signature, REVENUECAT_SECRET_API_KEY);
    if (!isValidSignature) {
      console.error('Webhook signature verification failed');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Webhook signature verification failed',
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

    // Parse the event
    const event: RevenueCatEvent = JSON.parse(body);
    console.log('RevenueCat event received:', event.event.type);

    // Initialize Supabase client with service role key
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Handle the event
    switch (event.event.type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'RESTORE':
      case 'NON_RENEWING_PURCHASE': {
        const userId = event.event.app_user_id;
        const productId = event.event.product_id;
        const expiresDate = event.event.expires_date ? new Date(event.event.expires_date) : null;
        
        // Determine subscription tier based on the product ID
        // Assuming product IDs follow a pattern like 'monthly_premium' or 'yearly_premium'
        const isYearly = productId.includes('yearly') || productId.includes('annual');
        const tier = isYearly ? 'premium_plus' : 'premium';
        
        // Update the user's profile with subscription info
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_status: 'premium',
            subscription_tier: tier,
            subscription_expires_at: expiresDate?.toISOString() || null,
            revenuecat_user_id: userId,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
        
        if (updateError) {
          console.error('Error updating user profile with subscription info:', updateError);
          throw new Error('Failed to update user profile');
        }
        break;
      }
      
      case 'CANCELLATION':
      case 'EXPIRATION':
      case 'BILLING_ISSUE': {
        const userId = event.event.app_user_id;
        const expiresDate = event.event.expires_date ? new Date(event.event.expires_date) : null;
        
        // Update the user's profile to reflect the cancelled/expired subscription
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            subscription_status: event.event.type === 'CANCELLATION' ? 'cancelled' : 'expired',
            subscription_expires_at: expiresDate?.toISOString() || null,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
        
        if (updateError) {
          console.error('Error updating user profile after subscription cancellation:', updateError);
          throw new Error('Failed to update user profile');
        }
        break;
      }
    }

    // Return a success response
    return new Response(
      JSON.stringify({ success: true, received: true }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error handling webhook:', error);
    
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

/**
 * Verify the RevenueCat webhook signature
 * 
 * @param {string} payload - The raw request body
 * @param {string} signature - The signature from the X-Signature header
 * @param {string} secretKey - The RevenueCat webhook secret key
 * @returns {Promise<boolean>} Whether the signature is valid
 */
async function verifySignature(payload: string, signature: string, secretKey: string): Promise<boolean> {
  try {
    // Convert the secret key to a Uint8Array
    const encoder = new TextEncoder();
    const key = encoder.encode(secretKey);
    
    // Create HMAC using SHA-256
    const hmacKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
    
    // Sign the payload
    const payloadBytes = encoder.encode(payload);
    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      hmacKey,
      payloadBytes
    );
    
    // Convert the signature to hex
    const signatureArray = Array.from(new Uint8Array(signatureBytes));
    const calculatedSignature = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Compare signatures
    return calculatedSignature === signature;
  } catch (error) {
    console.error('Error verifying signature:', error);
    return false;
  }
}