import React, { createContext, useContext, useState, useEffect } from 'react';
import { db } from '../db';
import { AppUser } from '../types';
import { auth } from '../src/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { syncManager } from '../src/utils/SyncManager';
import { googleProvider } from '../src/firebase';
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
const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(localStorage.getItem('google_drive_token'));

    useEffect(() => {
        console.log("AuthProvider: Initializing...");

        const restoreSession = async (firebaseUser?: any) => {
            const storedUserId = localStorage.getItem('shoro_user_id');
            if (storedUserId) {
                try {
                    const foundUser = await db.users.get(parseInt(storedUserId));
                    if (foundUser) {
                        console.log("AuthProvider: Restored session for", foundUser.fullName);
                        setUser(foundUser);
                        if (firebaseUser) syncManager.startSync();
                    }
                } catch (err) {
                    console.error("AuthProvider: Error restoring session", err);
                }
            } else if (firebaseUser) {
                // If no local storage but Firebase exists, we might need to find/create user
                // (Already handled in login logic, but useful for persistence between different Firebase states)
                syncManager.startSync();
            } else {
                setUser(null);
                syncManager.stopSync();
            }
            setIsLoading(false);
        };

        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            console.log("AuthProvider: Firebase State", firebaseUser ? `Connected: ${firebaseUser.email}` : "Disconnected");
            await restoreSession(firebaseUser);
        });

        // --- DYNAMIC INACTIVITY TIMEOUT ---
        let timeoutId: any;

        const resetTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);

            const storedTimeout = localStorage.getItem('system_inactivity_timeout');
            const timeoutMinutes = storedTimeout ? parseInt(storedTimeout) : 5;
            const INACTIVITY_LIMIT = timeoutMinutes * 60 * 1000;

            timeoutId = setTimeout(() => {
                if (localStorage.getItem('shoro_user_id')) {
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
    }, []);

    const login = React.useCallback(async (usernameOrEmail: string, pass: string): Promise<boolean> => {
        try {
            // First, try LOCAL authentication (for admin/123 and local users)
            console.log("AuthContext: Attempting local authentication...");
            const localUser = await db.users
                .where('username')
                .equals(usernameOrEmail)
                .first();

            if (localUser && localUser.password === pass && localUser.active) {
                console.log("AuthContext: Local authentication successful");
                setUser(localUser);
                localStorage.setItem('shoro_user_id', localUser.id!.toString());
                // For local users, we don't start sync unless they have Firebase credentials
                return true;
            }

            // If local auth fails, try Firebase (for cloud users)
            console.log("AuthContext: Attempting Firebase Sign In...");
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
            const result = await signInWithPopup(auth, googleProvider);
            const firebaseUser = result.user;
            const email = firebaseUser.email || '';

            let foundUser = await db.users
                .where('syncId')
                .equals(firebaseUser.uid)
                .first();

            if (!foundUser) {
                // Try looking by email if syncId not found
                foundUser = await db.users
                    .where('username')
                    .equals(email)
                    .first();
            }

            if (!foundUser) {
                const newUserId = await db.users.add({
                    username: email,
                    fullName: firebaseUser.displayName || email.split('@')[0],
                    role: 'Technician',
                    active: true,
                    syncId: firebaseUser.uid
                });
                foundUser = await db.users.get(newUserId);
            } else if (!foundUser.syncId) {
                // Link syncId to existing account if missing
                await db.users.update(foundUser.id!, { syncId: firebaseUser.uid });
            }

            if (foundUser && foundUser.active) {
                setUser(foundUser);
                localStorage.setItem('shoro_user_id', foundUser.id!.toString());
                return true;
            }
            return false;
        } catch (e: any) {
            console.error("AuthContext: Google login error", e.code, e.message);
            return false;
        }
    }, []);

    const linkGoogleDrive = async (): Promise<string | null> => {
        try {
            const { createGoogleProvider } = await import('../src/firebase');
            const provider = createGoogleProvider(['https://www.googleapis.com/auth/drive.file']);
            const result = await signInWithPopup(auth, provider);
            const credential = GoogleAuthProvider.credentialFromResult(result);
            const token = credential?.accessToken || null;
            const firebaseUser = result.user;

            // Update user email to match Google account for sync consistency
            if (user && firebaseUser.email && user.username !== firebaseUser.email) {
                console.log("AuthContext: Updating user email to match Google Account");
                const updatedUser = {
                    ...user,
                    username: firebaseUser.email,
                    syncId: firebaseUser.uid
                };
                await db.users.update(user.id!, updatedUser);
                setUser(updatedUser);
                toast.success(`Cuenta actualizada a: ${firebaseUser.email}`);
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
        await signOut(auth);
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

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
