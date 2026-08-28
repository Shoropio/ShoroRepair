import { initializeApp, getApps } from 'firebase/app';
import type { FirebaseApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import type { Analytics } from 'firebase/analytics';
import { db } from '../offline/db';

const getFirebaseConfig = async () => {
  try {
    const settings = await db.settings.toArray();
    if (settings.length > 0 && settings[0]) {
      const s = settings[0];
      if (s.firebaseApiKey && s.firebaseProjectId) {
        console.log("System: Using Firebase Config from DB Settings");
        return {
          apiKey: s.firebaseApiKey,
          authDomain: s.firebaseAuthDomain || `${s.firebaseProjectId}.firebaseapp.com`,
          projectId: s.firebaseProjectId,
          storageBucket: s.firebaseStorageBucket || `${s.firebaseProjectId}.firebasestorage.app`,
          messagingSenderId: s.firebaseMessagingSenderId || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: s.firebaseAppId || import.meta.env.VITE_FIREBASE_APP_ID,
          measurementId: s.firebaseMeasurementId || import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
        };
      }
    }
  } catch (e) {
    console.warn("System: Failed to load settings from DB, falling back to env:", e);
  }

  console.log("System: Using Firebase Config from Environment Variables");
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
  };
};

// Initialize Firebase only if we have an API key
let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;

const initFirebase = async () => {
  const firebaseConfig = await getFirebaseConfig();

  if (!firebaseConfig.apiKey) {
    console.warn("System: No Firebase API Key found. Cloud services will remain disabled.");
    return { app: null, analytics: null };
  }

  try {
    // Prevent double initialization
    const existingApp = getApps().length > 0 ? getApps()[0] : null;
    const initializedApp = existingApp || initializeApp(firebaseConfig);

    // Initialize Analytics with error handling
    let initializedAnalytics = null;
    if (firebaseConfig.measurementId && typeof window !== 'undefined') {
      try {
        initializedAnalytics = getAnalytics(initializedApp);
        console.log("System: Google Analytics initialized successfully");
      } catch (e: unknown) {
        const err = e as { message?: string };
        console.warn("System: Analytics initialization failed (this is normal in development):", err.message);
      }
    }

    return { app: initializedApp, analytics: initializedAnalytics };
  } catch (error) {
    console.error("System: Firebase initialization failed:", error);
    return { app: null, analytics: null };
  }
};

// Start initialization
const result = await initFirebase();
app = result.app;
analytics = result.analytics;

export { app, analytics };
export default app;
