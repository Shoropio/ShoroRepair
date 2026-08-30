import { createContext } from 'react';
import { AppUser } from '../types';
import { User } from 'firebase/auth';

export interface AuthContextType {
	user: AppUser | null;
	login: (email: string, pass: string) => Promise<boolean>;
	loginWithGoogle: () => Promise<boolean>;
	logout: () => void;
	isLoading: boolean;
	updateUser: (updatedUser: AppUser) => void;
	changePassword: (current: string, next: string) => Promise<boolean>;
	firebaseUser: User | null;
	unlinkGoogle: () => Promise<void>;
}

// Kept in its own module so AuthContext.tsx only exports components/hooks and
// Fast Refresh keeps working (react-refresh/only-export-components).
export const AuthContext = createContext<AuthContextType | null>(null);
