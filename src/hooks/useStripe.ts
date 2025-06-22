import { useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { stripePromise } from '../lib/stripe';
import { ErrorCode, createAppError, getUserFriendlyErrorMessage } from '../types/errors';

/**
 * Custom hook for Stripe integration
 * 
 * @returns {Object} Stripe methods and state
 */
export function useStripe() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Create a checkout session for subscription
   * 
   * @param {string} priceId - Stripe price ID
   * @returns {Promise<string|null>} Checkout URL or null on failure
   */
  const createCheckoutSession = useCallback(async (priceId: string): Promise<string | null> => {
    if (!user) {
      setError('You must be logged in to subscribe');
      return null;
    }

    if (!priceId) {
      setError('Invalid price ID');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call the Supabase Edge Function to create a checkout session
      const { data, error: functionError } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          priceId,
          userId: user.id,
          email: user.email,
          name: user.name
        }
      });

      if (functionError) {
        console.error('Error creating checkout session:', functionError);
        throw createAppError(
          ErrorCode.NETWORK_REQUEST_FAILED,
          'Failed to create checkout session',
          { functionError }
        );
      }

      if (!data.success || !data.url) {
        throw createAppError(
          ErrorCode.UNKNOWN_ERROR,
          data.error || 'Failed to create checkout session',
          { data }
        );
      }

      return data.url;
    } catch (err) {
      console.error('Error in subscription process:', err);
      const errorMessage = getUserFriendlyErrorMessage(err);
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Handle subscription status check
   * 
   * @param {string} sessionId - Stripe checkout session ID
   * @returns {Promise<boolean>} Success status
   */
  const handleSubscriptionSuccess = useCallback(async (sessionId: string): Promise<boolean> => {
    if (!user) {
      setError('You must be logged in to verify subscription');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call the Supabase Edge Function to verify the subscription
      const { data, error: functionError } = await supabase.functions.invoke('verify-subscription', {
        body: {
          sessionId,
          userId: user.id
        }
      });

      if (functionError) {
        console.error('Error verifying subscription:', functionError);
        throw createAppError(
          ErrorCode.NETWORK_REQUEST_FAILED,
          'Failed to verify subscription',
          { functionError }
        );
      }

      if (!data.success) {
        throw createAppError(
          ErrorCode.UNKNOWN_ERROR,
          data.error || 'Failed to verify subscription',
          { data }
        );
      }

      return true;
    } catch (err) {
      console.error('Error verifying subscription:', err);
      const errorMessage = getUserFriendlyErrorMessage(err);
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  /**
   * Redirect to Stripe customer portal for subscription management
   * 
   * @returns {Promise<string|null>} Portal URL or null on failure
   */
  const redirectToCustomerPortal = useCallback(async (): Promise<string | null> => {
    if (!user) {
      setError('You must be logged in to manage your subscription');
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call the Supabase Edge Function to create a customer portal session
      const { data, error: functionError } = await supabase.functions.invoke('create-portal-session', {
        body: {
          userId: user.id
        }
      });

      if (functionError) {
        console.error('Error creating portal session:', functionError);
        throw createAppError(
          ErrorCode.NETWORK_REQUEST_FAILED,
          'Failed to create customer portal session',
          { functionError }
        );
      }

      if (!data.success || !data.url) {
        throw createAppError(
          ErrorCode.UNKNOWN_ERROR,
          data.error || 'Failed to create customer portal session',
          { data }
        );
      }

      return data.url;
    } catch (err) {
      console.error('Error creating portal session:', err);
      const errorMessage = getUserFriendlyErrorMessage(err);
      setError(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  return {
    createCheckoutSession,
    handleSubscriptionSuccess,
    redirectToCustomerPortal,
    isLoading,
    error,
    clearError: () => setError(null)
  };
}