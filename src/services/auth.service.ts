import { auth, googleProvider } from '../firebase/auth';
import { signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';

export const AuthService = {
    loginWithGoogle: async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            return result.user;
        } catch (error) {
            console.error("Login failed", error);
            throw error;
        }
    },

    logout: async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout failed", error);
            throw error;
        }
    },

    onAuthStateChange: (callback: (user: User | null) => void) => {
        return onAuthStateChanged(auth, callback);
    }
};
