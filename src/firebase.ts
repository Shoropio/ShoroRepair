import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

import { getAnalytics } from "firebase/analytics";

import { db } from "../db";

// Helper to get configuration
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
                    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID, // Usually static
                    appId: import.meta.env.VITE_FIREBASE_APP_ID, // Usually static
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
let auth: any;
let googleProvider: any;
let firestore: any;
let storage: any;
let analytics: any;

try {
    if (!firebaseConfig.apiKey) {
        throw new Error("Missing Firebase API Key");
    }
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    firestore = getFirestore(app);
    storage = getStorage(app);
    try {
        analytics = getAnalytics(app);
    } catch (e) {
        console.warn("Firebase Analytics failed to initialize", e);
    }
} catch (error) {
    console.warn("Firebase initialization failed (Running in Offline Mode):", error);
    // Mock objects to prevent crashes in imports
    const mockAuth = { currentUser: null };
    const mockStorage = {};
    const mockFirestore = {};

    app = null;
    auth = mockAuth;
    storage = mockStorage;
    firestore = mockFirestore;
}

export const createGoogleProvider = (scopes: string[] = []) => {
    if (!app) return null;
    const provider = new GoogleAuthProvider();
    scopes.forEach(scope => provider.addScope(scope));
    return provider;
};

export { auth, googleProvider, firestore, storage, analytics };
export default app;
