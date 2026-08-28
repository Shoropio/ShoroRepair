import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import type { Auth } from 'firebase/auth';
import app from './firebase';

export const auth: Auth | null = app ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();
export const isFirebaseAuthAvailable = () => Boolean(app && auth);

export const createGoogleProvider = (scopes: string[] = []) => {
    const provider = new GoogleAuthProvider();
    scopes.forEach(scope => provider.addScope(scope));
    return provider;
};
