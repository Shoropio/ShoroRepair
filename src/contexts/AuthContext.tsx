
import React, { useState, useEffect } from 'react';
import { AuthContext } from './AuthContextValue';
import { db } from '../offline/db';
import { AppUser } from '../types';
import { auth, googleProvider, createGoogleProvider, isFirebaseAuthAvailable } from '../firebase/auth';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, signInWithPopup, signInWithRedirect, getRedirectResult, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { syncManager } from '../offline/sync';
import { toast } from 'sonner';
import { verifyPassword, hashPassword, needsRehash, encryptSecret, decryptSecret } from '../lib/crypto';

// Logging solo en desarrollo para evitar fuga de información de auth en producción.
const DEBUG = import.meta.env.DEV;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dlog = (...args: any[]) => { if (DEBUG) console.log(...args); };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dwarn = (...args: any[]) => { if (DEBUG) console.warn(...args); };

dlog("AuthContext.tsx file loaded");

// --- Protección contra fuerza bruta en login local ---
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MS = 5 * 60 * 1000;

const getLoginLock = (key: string): { attempts: number; until: number } => {
	try {
		const raw = localStorage.getItem(key);
		return raw ? JSON.parse(raw) : { attempts: 0, until: 0 };
	} catch {
		return { attempts: 0, until: 0 };
	}
};

const recordLoginFailure = (key: string): { locked: boolean; remaining: number } => {
	const lock = getLoginLock(key);
	const attempts = lock.attempts + 1;
	if (attempts >= MAX_LOGIN_ATTEMPTS) {
		const until = Date.now() + LOGIN_LOCKOUT_MS;
		localStorage.setItem(key, JSON.stringify({ attempts, until }));
		return { locked: true, remaining: Math.ceil(LOGIN_LOCKOUT_MS / 60000) };
	}
	localStorage.setItem(key, JSON.stringify({ attempts, until: 0 }));
	return { locked: false, remaining: MAX_LOGIN_ATTEMPTS - attempts };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AppUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
    const completeGoogleLogin = React.useCallback(async (firebaseUser: any): Promise<boolean> => {
        const email = firebaseUser.email || '';
        let foundUser = await db.users.where('syncId').equals(firebaseUser.uid).first();

        if (!foundUser && email) {
            foundUser = await db.users.where('username').equals(email).first();

            if (foundUser) {
                dlog("AuthContext: Linking existing local user to Google Account");
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
        dlog("AuthProvider: Initializing...");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
        const restoreSession = async (firebaseUser?: any) => {
            try {
                const storedToken = localStorage.getItem('google_drive_token');
                if (storedToken) {
                    decryptSecret(storedToken).then(t => setGoogleAccessToken(t));
                }

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
                    dlog("AuthProvider: Restored session for", foundUser.fullName);
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
            if (auth) {
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
                    dlog("AuthProvider: Firebase State", firebaseUser ? `Connected: ${firebaseUser.email}` : "Disconnected");
                    await restoreSession(firebaseUser);
                });
            } else {
                dwarn("AuthProvider: Running in Offline Mode (Firebase Auth not available)");
                restoreSession(null); // Just restore local session
            }
        } catch (e) {
            dwarn("AuthProvider: Failed to subscribe to auth state", e);
            restoreSession(null);
        }

        // --- DYNAMIC INACTIVITY TIMEOUT ---
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        let timeoutId: any;

        const resetTimer = () => {
            if (timeoutId) clearTimeout(timeoutId);

            const storedTimeout = localStorage.getItem('system_inactivity_timeout');
            const timeoutMinutes = storedTimeout ? parseInt(storedTimeout) : 5;
            const INACTIVITY_LIMIT = timeoutMinutes * 60 * 1000;

            timeoutId = setTimeout(() => {
                const storedUserId = localStorage.getItem('shoro_user_id');
                if (storedUserId) {
                    dlog(`AuthProvider: Inactivity timeout reached (${timeoutMinutes} min). Logging out...`);
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
        // `logout` is a stable useCallback defined later in this hook, so it is
        // intentionally omitted from the dependency array.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [completeGoogleLogin]);

    const login = React.useCallback(async (usernameOrEmail: string, pass: string): Promise<boolean> => {
        try {
            const lockKey = `auth_lock_${usernameOrEmail}`;
            const lock = getLoginLock(lockKey);
            if (lock.until && lock.until > Date.now()) {
                const mins = Math.ceil((lock.until - Date.now()) / 60000);
                toast.error(`Cuenta bloqueada temporalmente. Reintente en ${mins} min.`);
                return false;
            }

            // First, try LOCAL authentication
            dlog("AuthContext: Attempting local authentication...");

            // Search by username OR email
            let localUser = await db.users
                .where('username')
                .equals(usernameOrEmail)
                .first();

            if (!localUser) {
                // Try finding by email alias if username match failed
                localUser = await db.users.filter(u => u.email === usernameOrEmail).first();
            }

            if (localUser) {
                const valid = localUser.active && (await verifyPassword(pass, localUser.password));
                if (valid) {
                    dlog("AuthContext: Local authentication successful");

                    // Migrar contraseñas heredadas (texto plano o formato bugeado) a PBKDF2.
                    if (needsRehash(localUser.password)) {
                        await db.users.update(localUser.id!, {
                            password: await hashPassword(pass),
                            updatedAt: Date.now(),
                            synced: 0
                        });
                        localUser.password = await hashPassword(pass);
                    }

                    // If this is the default admin, ensure role is Admin
                    if (localUser.username === 'admin') {
                        if (localUser.role !== 'Admin') {
                            await db.users.update(localUser.id!, { role: 'Admin' });
                            localUser.role = 'Admin';
                        }
                    }

                    setUser(localUser);
                    localStorage.setItem('shoro_user_id', localUser.id!.toString());
                    localStorage.removeItem(lockKey);
                    return true;
                }

                // Usuario local conocido pero credenciales inválidas -> registrar intento.
                const fail = recordLoginFailure(lockKey);
                toast.error(
                    fail.locked
                        ? `Demasiados intentos. Cuenta bloqueada ${fail.remaining} min.`
                        : 'Credenciales incorrectas o cuenta inactiva.'
                );
                return false;
            }

            // If local auth fails (or doesn't exist), try Firebase for cloud support
            // but ONLY if the input looks like an email.
            if (!usernameOrEmail.includes('@')) {
                dlog("AuthContext: Username login failed and no @ found, skipping Firebase.");
                return false;
            }

            if (!isFirebaseAuthAvailable()) {
                dwarn("AuthContext: Firebase sign in skipped because Firebase is not configured.");
                return false;
            }
            if (!auth) return false;

            dlog("AuthContext: Attempting Firebase Sign In for", usernameOrEmail);
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            console.error("AuthContext: Login error", e.code, e.message);
            return false;
        }
    }, []);

    const loginWithGoogle = React.useCallback(async (): Promise<boolean> => {
        try {
            dlog("AuthContext: Attempting Google Sign In...");

            if (!isFirebaseAuthAvailable()) {
                toast.error("Firebase no está configurado. Agrega las credenciales en .env y reinicia la app.");
                return false;
            }
            if (!auth) return false;

            const result = await signInWithPopup(auth, googleProvider);
            const success = await completeGoogleLogin(result.user);
            if (success) return true;
            return false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (e: any) {
            if (e.code === 'auth/popup-blocked') {
                dwarn("AuthContext: Google popup blocked, falling back to redirect.");
                await signInWithRedirect(auth, googleProvider);
                return false;
            }

            console.error("AuthContext: Google login error", e.code, e.message);
            // Handle popup closed by user or network error
            toast.error("Error de inicio de sesión con Google: " + e.message);
            return false;
        }
    }, [completeGoogleLogin]);

    const linkGoogleDrive = React.useCallback(async (): Promise<string | null> => {
        try {
            if (!isFirebaseAuthAvailable()) {
                toast.error("Firebase no está configurado. Agrega las credenciales en .env y reinicia la app.");
                return null;
            }
            if (!auth) return null;

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

                dlog("AuthContext: Link Google Account to current user");

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
                localStorage.setItem('google_drive_token', await encryptSecret(token));
            }
            return token;
        } catch (error) {
            console.error("Error linking Google Drive", error);
            return null;
        }
    }, [user, setUser, setGoogleAccessToken]);

    const unlinkGoogleDrive = React.useCallback(async () => {
        setGoogleAccessToken(null);
        localStorage.removeItem('google_drive_token');
        toast.info("Cuenta de Google Desvinculada");
    }, [setGoogleAccessToken]);

    const logout = React.useCallback(async () => {
        try {
            if (auth) {
                await signOut(auth);
            }
        } catch (e) {
            dwarn("Logout error (likely offline):", e);
        }
        setUser(null);
        setGoogleAccessToken(null);
        localStorage.removeItem('shoro_user_id');
        localStorage.removeItem('google_drive_token');
    }, []);

    const updateUser = React.useCallback((updatedUser: AppUser) => {
        setUser(updatedUser);
    }, []);

    const changePassword = React.useCallback(async (current: string, next: string): Promise<boolean> => {
        if (!user) return false;
        const ok = await verifyPassword(current, user.password || '');
        if (!ok) return false;
        const hashed = await hashPassword(next);
        await db.users.update(user.id!, { password: hashed, mustChangePassword: false, updatedAt: Date.now(), synced: 0 });
        setUser({ ...user, password: hashed, mustChangePassword: false });
        return true;
    }, [user]);

    const value = React.useMemo(() => ({
        user, login, loginWithGoogle, logout, isLoading, updateUser, changePassword, linkGoogleDrive, unlinkGoogleDrive, googleAccessToken
    }), [user, login, loginWithGoogle, logout, isLoading, updateUser, changePassword, linkGoogleDrive, unlinkGoogleDrive, googleAccessToken]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};


