import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Keep the auto-sync hook from firing in the background during tests.
vi.mock('../offline/sync', async (importOriginal) => {
	const actual = (await importOriginal()) as any;
	const real = actual.syncManager;
	const proxied = new Proxy(real, {
		get: (target, prop) => (prop === 'syncOnChange' ? () => {} : target[prop as any])
	});
	return { ...actual, syncManager: proxied };
});

const mem = new Map<string, string>();
(globalThis as any).localStorage = {
	getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
	setItem: (k: string, v: string) => { mem.set(k, String(v)); },
	removeItem: (k: string) => { mem.delete(k); },
	clear: () => mem.clear()
};

const { db } = await import('../offline/db');
const {
	listActiveUsers,
	findByUsername,
	createUser,
	updateUser,
	setUserActive,
	softDeleteUser
} = await import('./users.repository');

beforeEach(async () => {
	localStorage.clear();
	await db.open().catch(() => {});
	await Promise.all(db.tables.map(t => t.clear()));
});

afterEach(() => {
	vi.restoreAllMocks();
});

const sample = {
	username: 'tech1',
	fullName: 'Técnico Uno',
	role: 'Technician' as const,
	active: true,
	password: 'secret123'
};

describe('users.repository', () => {
	it('creates a user with a hashed password (never plaintext) and sync metadata', async () => {
		const id = await createUser(sample);
		const created = await db.users.get(id);
		expect(created?.synced).toBe(0);
		expect(created?.password).toBeTruthy();
		expect(created?.password?.startsWith('pbkdf2$')).toBe(true);
	});

	it('finds a user by username', async () => {
		await createUser(sample);
		const found = await findByUsername('tech1');
		expect(found?.fullName).toBe('Técnico Uno');
	});

	it('rehashes the password on update only when one is provided', async () => {
		const id = await createUser(sample);
		const original = (await db.users.get(id))!.password;

		await updateUser(id, { fullName: 'Técnico Uno Edit' });
		const afterNoPw = (await db.users.get(id))!.password;
		expect(afterNoPw).toBe(original); // unchanged

		await updateUser(id, { password: 'newsecret' });
		const afterPw = (await db.users.get(id))!.password;
		expect(afterPw).not.toBe(original);
		expect(afterPw?.startsWith('pbkdf2$')).toBe(true);
		expect(afterPw).not.toBe('newsecret'); // not stored plaintext
	});

	it('toggles active status', async () => {
		const id = await createUser(sample);
		await setUserActive(id, false);
		expect((await db.users.get(id))?.active).toBe(false);
	});

	it('soft-deletes a user (tombstone, marked inactive) and excludes from active list', async () => {
		const id = await createUser(sample);
		await softDeleteUser(id);

		const raw = await db.users.get(id);
		expect(raw?.deleted).toBe(1);
		expect(raw?.active).toBe(false);

		const active = await listActiveUsers();
		expect(active.map(u => u.id)).not.toContain(id);
	});

	it('searches active users by name or username', async () => {
		await createUser(sample);
		await createUser({ username: 'rec1', fullName: 'Recepcionista', role: 'Receptionist', active: true, password: 'x' });

		expect((await listActiveUsers('técnico')).length).toBe(1);
		expect((await listActiveUsers('REC1')).map(u => u.username)).toContain('rec1');
	});
});
