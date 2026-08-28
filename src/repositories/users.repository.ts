import { db } from '../offline/db';
import type { AppUser, UserRole } from '../types';
import { hashPassword } from '../lib/crypto';

/**
 * Data-access layer for users.
 *
 * Mirrors `clients.repository.ts`: centralises sync flags, soft delete and the
 * PBKDF2 password hashing so components don't repeat it (and can't accidentally
 * persist a plaintext password). `syncId`/`version` are still assigned by the
 * Dexie hooks in `offline/db.ts`.
 */

export type UserInput = {
	username: string;
	fullName: string;
	role: UserRole;
	active: boolean;
	password?: string;
};

export async function listActiveUsers(search = ''): Promise<AppUser[]> {
	const all = (await db.users.filter(u => u.deleted !== 1).toArray()) as AppUser[];
	if (!search) return all;
	const q = search.toLowerCase();
	return all.filter(u => u.fullName.toLowerCase().includes(q) || u.username.toLowerCase().includes(q));
}

export async function findByUsername(username: string): Promise<AppUser | undefined> {
	return db.users.where('username').equals(username).first() as Promise<AppUser | undefined>;
}

export async function createUser(data: UserInput): Promise<number> {
	const now = Date.now();
	const record = {
		username: data.username,
		fullName: data.fullName,
		role: data.role,
		active: data.active,
		password: data.password ? await hashPassword(data.password) : undefined,
		createdAt: now,
		updatedAt: now,
		synced: 0
	} as unknown as AppUser;
	return db.users.add(record);
}

export async function updateUser(id: number, data: Partial<UserInput>): Promise<void> {
	const updateData: Record<string, unknown> = { ...data, updatedAt: Date.now(), synced: 0 };
	if (data.password) updateData.password = await hashPassword(data.password);
	await db.users.update(id, updateData);
}

export async function setUserActive(id: number, active: boolean): Promise<void> {
	await db.users.update(id, { active, updatedAt: Date.now(), synced: 0 });
}

export async function softDeleteUser(id: number): Promise<void> {
	await db.users.update(id, { deleted: 1, active: false, synced: 0, updatedAt: Date.now() });
}
