@@ .. @@
 import { PREMIUM } from '../constants/uiStrings';
 import { supabase } from '../lib/supabase';
 import Logo from './Logo';
+import { useStripe } from '../hooks/useStripe';
 
 // Import memoized components
@@ .. @@
 export default function PremiumPage({ onBack }: PremiumPageProps) {
   const { user } = useAuth();
   const { profile } = useJournal();
+  const { createCheckoutSession, isLoading: isStripeLoading, error: stripeError } = useStripe();
   const [isLoading, setIsLoading] = useState(false);
   const [priceIDs, setPriceIDs] = useState({
     monthly: '',
@@ .. @@
   /**
    * Handles subscription process by creating a Stripe checkout session
    * @param {string} priceId - The Stripe price ID for the selected plan
    */
-  const handleSubscribe = useCallback(async (priceId: string) => {
+  const handleSubscribe = useCallback(async () => {
     if (!user) return;
     
+    const priceId = selectedPlan === 'monthly' 
+      ? import.meta.env.VITE_STRIPE_PRICE_ID_MONTHLY 
+      : import.meta.env.VITE_STRIPE_PRICE_ID_YEARLY;
+    
     if (!priceId) {
       setError('Price ID is missing. Please check your environment configuration.');
       return;
     }
     
     setIsLoading(true);
     setError('');
     
     try {
-      console.log('Creating checkout session for price ID:', priceId, 'with user ID:', user.id);
-      
-      // Call the Supabase Edge Function to create a checkout session
-      const { data, error: functionError } = await supabase.functions.invoke('create-checkout-session', {
-        body: {
-          priceId,
-          userId: user.id,
-          email: user.email,
-          name: user.name
-        }
-      });
-      
-      if (functionError) {
-        console.error('Error creating checkout session:', functionError);
-        setError(`Failed to create checkout session: ${functionError.message || 'Unknown error'}`);
-        return;
-      }
-      
-      if (!data.success || !data.url) {
-        console.error('Checkout session creation failed:', data, data.error);
-        setError(data.error || 'Failed to create checkout session. Please try again.');
-        return;
-      }
-      
-      console.log('Redirecting to Stripe checkout URL:', data.url);
-      
-      // Redirect to Stripe Checkout
-      // Use a small timeout to ensure console logs are visible
-      setTimeout(() => {
-        console.log('Executing redirect now...');
-        window.location.href = data.url;
-      }, 100);
+       const checkoutUrl = await createCheckoutSession(priceId);
+       
+       if (checkoutUrl) {
+         // Redirect to Stripe Checkout
+         window.location.href = checkoutUrl;
+       } else {
+         setError('Failed to create checkout session. Please try again.');
+       }
     } catch (err) {
       console.error('Error in subscription process:', err);
       const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
@@ .. @@
   // Determine if we can enable the subscribe button
   const canSubscribe = priceIDs.monthly && priceIDs.yearly;
   
+  // Use combined error state
+  const errorMessage = error || stripeError;
+  
   const expiryDate = profile?.subscription_expires_at 
     ? new Date(profile.subscription_expires_at).toLocaleDateString('en-US', {
         year: 'numeric',
@@ .. @@
 
       {/* Error Message */}
       <AnimatePresence>
-        {error && (
+        {errorMessage && (
           <motion.div
             className="mb-8 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4"
             initial={{ opacity: 0, y: -10 }}
@@ .. @@
           >
             <div className="flex items-center space-x-2">
               <AlertCircle className="w-5 h-5 text-red-500" aria-hidden="true" />
-              <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
+              <p className="text-red-700 dark:text-red-300 text-sm">{errorMessage}</p>
             </div>
           </motion.div>
         )}
@@ .. @@
           selectedPlan={selectedPlan}
           onSelectPlan={setSelectedPlan}
-          onSubscribe={() => handleSubscribe(
-            selectedPlan === 'monthly' 
-              ? import.meta.env.VITE_STRIPE_PRICE_ID_MONTHLY 
-              : import.meta.env.VITE_STRIPE_PRICE_ID_YEARLY
-          )}
-          isLoading={isLoading}
+          onSubscribe={handleSubscribe}
+          isLoading={isLoading || isStripeLoading}
           isSubscribed={isSubscribed}
         />