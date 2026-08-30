
import React, { useState, useEffect } from 'react';
import { AuthContext } from './AuthContextValue';
import { db } from '../offline/db';
import { AppUser } from '../types';
import { auth, googleProvider, isFirebaseAuthAvailable } from '../firebase/auth';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, signInWithPopup, setPersistence, browserLocalPersistence, type User } from 'firebase/auth';
import { syncManager } from '../offline/sync';
import { toast } from 'sonner';
import { verifyPassword, hashPassword, needsRehash } from '../lib/crypto';

// Logging solo en desarrollo para evitar fuga de información de auth en producción.
const DEBUG = import.meta.env.DEV;
const dlog = (...args: unknown[]) => { if (DEBUG) console.log(...args); };
const dwarn = (...args: unknown[]) => { if (DEBUG) console.warn(...args); };

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
    const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

    const completeGoogleLogin = React.useCallback(async (firebaseUser: User): Promise<boolean> => {
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

        const restoreSession = async (firebaseUser?: User | null) => {
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
                unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
                    dlog("AuthProvider: Firebase State", firebaseUser ? `Connected: ${firebaseUser.email}` : "Disconnected");
                    setFirebaseUser(firebaseUser);
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
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

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
        } catch (e: unknown) {
            const err = e as { code?: string; message?: string };
            console.error("AuthContext: Login error", err.code, err.message);
            return false;
        }
    }, []);

    const loginWithGoogle = React.useCallback(async (): Promise<boolean> => {
        try {
            dlog("AuthContext: Attempting Google Sign In (popup)...");

            if (!isFirebaseAuthAvailable()) {
                toast.error("Firebase no está configurado. Agrega las credenciales en .env y reinicia la app.");
                return false;
            }
            if (!auth) return false;

            await setPersistence(auth, browserLocalPersistence);
            const result = await signInWithPopup(auth, googleProvider);
            const success = await completeGoogleLogin(result.user);
            if (success) {
                toast.success("Inicio de sesión con Google exitoso.");
                // Import local data into Firebase so the cloud stays in sync.
                syncManager.startSync();
            }
            return success;
        } catch (e: unknown) {
            const err = e as { code?: string; message?: string };
            console.error("AuthContext: Google login error", err.code, err.message);
            toast.error("Error de inicio de sesión con Google: " + err.message);
            return false;
        }
    }, [completeGoogleLogin]);



    const unlinkGoogle = React.useCallback(async () => {
        try {
            if (auth) await signOut(auth);
        } catch (e) {
            dwarn("Google unlink error", e);
        }
    }, []);

    const logout = React.useCallback(async () => {
        try {
            if (auth) {
                await signOut(auth);
            }
        } catch (e) {
            dwarn("Logout error (likely offline):", e);
        }
        setUser(null);
        localStorage.removeItem('shoro_user_id');
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
        user, login, loginWithGoogle, logout, isLoading, updateUser, changePassword, firebaseUser, unlinkGoogle
    }), [user, login, loginWithGoogle, logout, isLoading, updateUser, changePassword, firebaseUser, unlinkGoogle]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};


