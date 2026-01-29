import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import app from './firebase';

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const createGoogleProvider = (scopes: string[] = []) => {
    const provider = new GoogleAuthProvider();
    scopes.forEach(scope => provider.addScope(scope));
    return provider;
};
