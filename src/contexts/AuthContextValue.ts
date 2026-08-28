import { createContext } from 'react';
import { AppUser } from '../types';

export interface AuthContextType {
	user: AppUser | null;
	login: (email: string, pass: string) => Promise<boolean>;
	loginWithGoogle: () => Promise<boolean>;
	logout: () => void;
	isLoading: boolean;
	updateUser: (updatedUser: AppUser) => void;
	changePassword: (current: string, next: string) => Promise<boolean>;
	linkGoogleDrive: () => Promise<string | null>;
	unlinkGoogleDrive: () => Promise<void>;
	googleAccessToken: string | null;
}

// Kept in its own module so AuthContext.tsx only exports components/hooks and
// Fast Refresh keeps working (react-refresh/only-export-components).
export const AuthContext = createContext<AuthContextType | null>(null);
