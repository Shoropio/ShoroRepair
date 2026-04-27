import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import app from './firebase';

export const auth = app ? getAuth(app) : ({ currentUser: null } as any);
export const googleProvider = new GoogleAuthProvider();
export const isFirebaseAuthAvailable = () => Boolean(app && (auth as any).app);

export const createGoogleProvider = (scopes: string[] = []) => {
    const provider = new GoogleAuthProvider();
    scopes.forEach(scope => provider.addScope(scope));
    return provider;
};
