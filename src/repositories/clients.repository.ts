import { db } from '../offline/db';
import type { Client } from '../types';

/**
 * Data-access layer for clients.
 *
 * Centralises the offline-first conventions (sync flags, soft delete,
 * `updatedAt`) so components don't repeat them and the logic is unit-testable
 * without rendering React. `syncId`/`version` are still assigned by the Dexie
 * hooks in `offline/db.ts`.
 */

export async function createClient(data: Partial<Client>): Promise<number> {
	const now = Date.now();
	return db.clients.add({
		...data,
		createdAt: now,
		updatedAt: now,
		synced: 0
	} as Client);
}

export async function updateClient(id: number, data: Partial<Client>): Promise<void> {
	await db.clients.update(id, {
		...data,
		updatedAt: Date.now(),
		synced: 0
	});
}

export async function softDeleteClient(id: number): Promise<void> {
	await db.clients.update(id, {
		deleted: 1,
		synced: 0,
		updatedAt: Date.now()
	});
}

export async function listActiveClients(): Promise<Client[]> {
	return db.clients.filter(c => c.deleted !== 1).toArray() as Promise<Client[]>;
}

export async function searchActiveClients(search: string): Promise<Client[]> {
	const q = (search || '').toLowerCase().trim();
	const list = (await db.clients
		.filter(c =>
			c.deleted !== 1 &&
			(!q ||
				c.name.toLowerCase().includes(q) ||
				(c.email || '').toLowerCase().includes(q) ||
				(c.phone || '').includes(q))
		)
		.toArray()) as Client[];
	// Newest activity first (mirrors the previous `reverse().sortBy('updatedAt')`).
	return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}
