import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Replace with your Firebase project configuration
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

console.log('Initializing Firebase with Project ID:', firebaseConfig.projectId);

if (!firebaseConfig.apiKey) {
    console.error('Firebase API Key is missing! Check your .env.local file and ensure variables start with VITE_');
}

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/**
 * Creates a configured Google provider with optional scopes
 */
export const createGoogleProvider = (scopes: string[] = []) => {
    const provider = new GoogleAuthProvider();
    scopes.forEach(scope => provider.addScope(scope));
    return provider;
};

export const firestore = getFirestore(app);
export const storage = getStorage(app);
export default app;
