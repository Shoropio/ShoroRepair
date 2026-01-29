import { initializeApp } from 'firebase/app';
import { getAnalytics } from 'firebase/analytics';
import { db } from '../offline/db';

const getFirebaseConfig = async () => {
  try {
    const settings = await db.settings.toArray();
    if (settings.length > 0 && settings[0]) {
      const s = settings[0];
      if (s.firebaseApiKey && s.firebaseProjectId) {
        console.log("Using Firebase Config from DB Settings");
        return {
          apiKey: s.firebaseApiKey,
          authDomain: `${s.firebaseProjectId}.firebaseapp.com`,
          projectId: s.firebaseProjectId,
          storageBucket: `${s.firebaseProjectId}.appspot.com` || `${s.firebaseProjectId}.firebasestorage.app`,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId: import.meta.env.VITE_FIREBASE_APP_ID,
          measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
        };
      }
    }
  } catch (e) {
    console.warn("Failed to load settings from DB, falling back to env:", e);
  }

  console.log("Using Firebase Config from Environment Variables");
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

const firebaseConfig = await getFirebaseConfig();
console.log('Initializing Firebase with Project ID:', firebaseConfig.projectId);

let app: any;
let analytics: any;

try {
  if (!firebaseConfig.apiKey) {
    console.warn("No Firebase API Key found. Firebase services will be disabled.");
  } else {
    app = initializeApp(firebaseConfig);
    try {
      analytics = getAnalytics(app);
    } catch (e) {
      console.warn("Firebase Analytics failed to initialize", e);
    }
  }
} catch (error) {
  console.warn("Firebase initialization failed:", error);
}

export { app, analytics };
export default app;
