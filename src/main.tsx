import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import * as Purchases from '@revenuecat/purchases-js';
import App from './App.tsx';
import './index.css';

// Initialize RevenueCat SDK
const REVENUECAT_PUBLIC_API_KEY = import.meta.env.VITE_REVENUECAT_PUBLIC_API_KEY;

if (REVENUECAT_PUBLIC_API_KEY) {
  Purchases.configure({
    apiKey: REVENUECAT_PUBLIC_API_KEY,
    appUserID: null // Will be set after user authentication
  });
  console.log('RevenueCat SDK initialized');
} else {
  console.warn('RevenueCat public API key not found. Subscription features will be disabled.');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
