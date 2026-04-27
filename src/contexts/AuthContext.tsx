
import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../offline/db';
import { AppUser } from '../types';
import { auth, googleProvider, createGoogleProvider, isFirebaseAuthAvailable } from '../firebase/auth';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { syncManager } from '../offline/sync';
import { toast } from 'sonner';

interface AuthContextType {
    user: AppUser | null;
    login: (email: string, pass: string) => Promise<boolean>;
    loginWithGoogle: () => Promise<boolean>;
    logout: () => void;
    isLoading: boolean;
    updateUser: (updatedUser: AppUser) => void;
    linkGoogleDrive: () => Promise<string | null>;
    unlinkGoogleDrive: () => Promise<void>;
    googleAccessToken: string | null;
}

console.log("AuthContext.tsx file loaded");
export const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(localStorage.getItem('google_drive_token'));

    const completeGoogleLogin = React.useCallback(async (firebaseUser: any): Promise<boolean> => {
        const email = firebaseUser.email || '';
        let foundUser = await db.users.where('syncId').equals(firebaseUser.uid).first();

        if (!foundUser && email) {
            foundUser = await db.users.where('username').equals(email).first();

            if (foundUser) {
                console.log("AuthContext: Linking existing local user to Google Account");
                await db.users.update(foundUser.id!, {
                    syncId: firebaseUser.uid,
                    fullName: firebaseUser.displayName || foundUser.fullName
                });
                foundUser = await db.users.get(foundUser.id!);
            }
        }

        if (!foundUser) {
            const count = await db.users.count();
            const defaultAdmin = await db.users.where('username').equals('admin').first();
            const role = (count === 0 || (count === 1 && defaultAdmin)) ? 'Admin' : 'Technician';

            const newUserId = await db.users.add({
                username: email,
                fullName: firebaseUser.displayName || email.split('@')[0],
                email,
                role,
                active: true,
                syncId: firebaseUser.uid
            });
            foundUser = await db.users.get(newUserId);
        }

        if (foundUser && foundUser.active) {
            setUser(foundUser);
            localStorage.setItem('shoro_user_id', foundUser.id!.toString());
            return true;
        }

        return false;
    }, []);

    useEffect(() => {
        console.log("AuthProvider: Initializing...");

        const restoreSession = async (firebaseUser?: any) => {
            try {
                const storedUserId = localStorage.getItem('shoro_user_id');
                let foundUser = null;

                if (storedUserId) {
                    foundUser = await db.users.get(parseInt(storedUserId));
                }

                // If local ID didn't work but we have Firebase, try matching by UID
                if (!foundUser && firebaseUser) {
                    foundUser = await db.users.where('syncId').equals(firebaseUser.uid).first();
                    if (foundUser) {
                        localStorage.setItem('shoro_user_id', foundUser.id!.toString());
                    }
                }

                if (foundUser) {
                    console.log("AuthProvider: Restored session for", foundUser.fullName);
                    setUser(foundUser);
                    if (firebaseUser) syncManager.startSync();
                } else {
                    setUser(null);
                    syncManager.stopSync();
                }
            } catch (err) {
                console.error("AuthProvider: Error restoring session", err);
                setUser(null);
            } finally {
                setIsLoading(false);
            }
        };

        let unsubscribe = () => { };

        try {
            // Check if auth is a real Firebase Auth instance (has 'app' property) or similar
            // If it's our mock { currentUser: null }, onAuthStateChanged might throw or fail
            if (auth && (auth as any).app) {
                getRedirectResult(auth).then(async result => {
                    if (result?.user) {
                        const success = await completeGoogleLogin(result.user);
                        if (success) {
                            toast.success("Inicio de sesión con Google exitoso.");
                            syncManager.startSync();
                        }
                    }
                }).catch(error => {
                    console.error("AuthProvider: Google redirect login error", error.code, error.message);
                    toast.error("Error de inicio de sesión con Google: " + error.message);
                });

                unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
                    console.log("AuthProvider: Firebase State", firebaseUser ? `Connected: ${firebaseUser.email}` : "Disconnected");
                    await restoreSession(firebaseUser);
                });
            } else {
                console.warn("AuthProvider: Running in Offline Mode (Firebase Auth not available)");
                restoreSession(null); // Just restore local session
            }
        } catch (e) {
            console.warn("AuthProvider: Failed to subscribe to auth state", e);
            restoreSession(null);
        }

        // --- DYNAMIC INACTIVITY TIMEOUT ---
        let timeoutId: any;

        const resetTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);

            const storedTimeout = localStorage.getItem('system_inactivity_timeout');
            const timeoutMinutes = storedTimeout ? parseInt(storedTimeout) : 5;
            const INACTIVITY_LIMIT = timeoutMinutes * 60 * 1000;

            timeoutId = setTimeout(() => {
                const storedUserId = localStorage.getItem('shoro_user_id');
                if (storedUserId) {
                    console.log(`AuthProvider: Inactivity timeout reached (${timeoutMinutes} min). Logging out...`);
                    logout();
                }
            }, INACTIVITY_LIMIT);
        };

        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
        events.forEach(name => document.addEventListener(name, resetTimer));
        resetTimer(); // Start initial timer

        return () => {
            unsubscribe();
            if (timeoutId) clearTimeout(timeoutId);
            events.forEach(name => document.removeEventListener(name, resetTimer));
        };
    }, [completeGoogleLogin]);

    const login = React.useCallback(async (usernameOrEmail: string, pass: string): Promise<boolean> => {
        try {
            // First, try LOCAL authentication
            console.log("AuthContext: Attempting local authentication...");

            // Search by username OR email
            let localUser = await db.users
                .where('username')
                .equals(usernameOrEmail)
                .first();

            if (!localUser) {
                // Try finding by email alias if username match failed
                localUser = await db.users.filter(u => u.email === usernameOrEmail).first();
            }

            if (localUser && localUser.password === pass && localUser.active) {
                console.log("AuthContext: Local authentication successful");

                // If this is the default admin, ensure role is Admin
                if (localUser.username === 'admin') {
                    if (localUser.role !== 'Admin') {
                        await db.users.update(localUser.id!, { role: 'Admin' });
                        localUser.role = 'Admin';
                    }
                }

                setUser(localUser);
                localStorage.setItem('shoro_user_id', localUser.id!.toString());
                return true;
            }

            // If local auth fails (or doesn't exist), try Firebase for cloud support
            // but ONLY if the input looks like an email.
            if (!usernameOrEmail.includes('@')) {
                console.log("AuthContext: Username login failed and no @ found, skipping Firebase.");
                return false;
            }

            if (!isFirebaseAuthAvailable()) {
                console.warn("AuthContext: Firebase sign in skipped because Firebase is not configured.");
                return false;
            }

            console.log("AuthContext: Attempting Firebase Sign In for", usernameOrEmail);
            await setPersistence(auth, browserLocalPersistence);
            const userCredential = await signInWithEmailAndPassword(auth, usernameOrEmail, pass);
            const firebaseUser = userCredential.user;

            let foundUser = await db.users
                .where('username')
                .equals(usernameOrEmail)
                .first();

            if (!foundUser) {
                const newUserId = await db.users.add({
                    username: usernameOrEmail,
                    fullName: usernameOrEmail.split('@')[0],
                    email: usernameOrEmail, // Ensure email field is populated
                    role: 'Technician',
                    active: true,
                    syncId: firebaseUser.uid
                });
                foundUser = await db.users.get(newUserId);
            }

            if (foundUser && foundUser.active) {
                setUser(foundUser);
                localStorage.setItem('shoro_user_id', foundUser.id!.toString());
                syncManager.startSync();
                return true;
            }
            return false;
        } catch (e: any) {
            console.error("AuthContext: Login error", e.code, e.message);
            return false;
        }
    }, []);

    const loginWithGoogle = React.useCallback(async (): Promise<boolean> => {
        try {
            console.log("AuthContext: Attempting Google Sign In...");

            if (!isFirebaseAuthAvailable()) {
                toast.error("Firebase no está configurado. Agrega las credenciales en .env y reinicia la app.");
                return false;
            }

            const result = await signInWithPopup(auth, googleProvider);
            const success = await completeGoogleLogin(result.user);
            if (success) return true;
            return false;

        } catch (e: any) {
            if (e.code === 'auth/popup-blocked') {
                console.warn("AuthContext: Google popup blocked, falling back to redirect.");
                await signInWithRedirect(auth, googleProvider);
                return false;
            }

            console.error("AuthContext: Google login error", e.code, e.message);
            // Handle popup closed by user or network error
            toast.error("Error de inicio de sesión con Google: " + e.message);
            return false;
        }
    }, [completeGoogleLogin]);

    const linkGoogleDrive = async (): Promise<string | null> => {
        try {
            if (!isFirebaseAuthAvailable()) {
                toast.error("Firebase no está configurado. Agrega las credenciales en .env y reinicia la app.");
                return null;
            }

            const provider = createGoogleProvider(['https://www.googleapis.com/auth/drive.file']);
            await setPersistence(auth, browserLocalPersistence); // Ensure persistence
            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential?.accessToken || null;
            const firebaseUser = result.user;

            // Update user email to match Google account for sync consistency
            // This is critical for converting the local "admin" user to a real Google Cloud user
            if (user && firebaseUser.email) {
                // Check if ANOTHER user already has this google account linked
                const conflictUser = await db.users.where('syncId').equals(firebaseUser.uid).first();
                if (conflictUser && conflictUser.id !== user.id) {
                    toast.error("Esta cuenta de Google ya está vinculada a otro usuario.");
                    await signOut(auth); // Sign out of the conflicting google account immediately
                    return null;
                }

                console.log("AuthContext: Link Google Account to current user");

                const updatedUser = { ...user };
                updatedUser.syncId = firebaseUser.uid;
                updatedUser.fullName = firebaseUser.displayName || user.fullName; // Adopt Google Name if available

                // CRITICAL: If the user is 'admin' (local default), KEEP 'admin' as username so local login persists.
                // Otherwise (for normal users), update username to email.
                if (user.username !== 'admin') {
                    updatedUser.username = firebaseUser.email;
                }

                // Always update the 'email' field to allow alternate login
                updatedUser.email = firebaseUser.email;

                await db.users.update(user.id!, updatedUser);
                setUser(updatedUser);
                toast.success(`Cuenta vinculada exitosamente: ${firebaseUser.email}`);
            }

            if (token) {
                setGoogleAccessToken(token);
                localStorage.setItem('google_drive_token', token);
            }
            return token;
        } catch (error) {
            console.error("Error linking Google Drive", error);
            return null;
        }
    };

    const unlinkGoogleDrive = async () => {
        setGoogleAccessToken(null);
        localStorage.removeItem('google_drive_token');
        toast.info("Cuenta de Google Desvinculada");
    };

    const logout = React.useCallback(async () => {
        try {
            if (auth && (auth as any).app) {
                await signOut(auth);
            }
        } catch (e) {
            console.warn("Logout error (likely offline):", e);
        }
        setUser(null);
        setGoogleAccessToken(null);
        localStorage.removeItem('shoro_user_id');
        localStorage.removeItem('google_drive_token');
    }, []);

    const updateUser = React.useCallback((updatedUser: AppUser) => {
        setUser(updatedUser);
    }, []);

    const value = React.useMemo(() => ({
        user, login, loginWithGoogle, logout, isLoading, updateUser, linkGoogleDrive, unlinkGoogleDrive, googleAccessToken
    }), [user, login, loginWithGoogle, logout, isLoading, updateUser, linkGoogleDrive, unlinkGoogleDrive, googleAccessToken]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};


