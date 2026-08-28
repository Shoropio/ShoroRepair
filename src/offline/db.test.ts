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

const { db, initializeData } = await import('./db');

beforeEach(async () => {
	localStorage.clear();
	await db.open().catch(() => {});
	await Promise.all(db.tables.map(t => t.clear()));
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('RepairDB seed / migration', () => {
	it('seeds a default admin, company settings and demo inventory on first run', async () => {
		await initializeData();

		const admin = await db.users.where('username').equals('admin').first();
		expect(admin).toBeDefined();
		expect(admin?.role).toBe('Admin');
		expect(admin?.mustChangePassword).toBe(true);
		// Password must be a PBKDF2 hash, never plaintext.
		expect(admin?.password?.startsWith('pbkdf2$')).toBe(true);

		const settingsCount = await db.settings.count();
		expect(settingsCount).toBe(1);

		const inventoryCount = await db.inventory.count();
		expect(inventoryCount).toBeGreaterThanOrEqual(2);
	});

	it('assigns syncId and version on create (needed for sync conflict detection)', async () => {
		const id = await db.clients.add({ name: 'Bob', phone: '123' } as any);
		const created = await db.clients.get(id);
		expect(created?.syncId).toBeTruthy();
		expect(created?.version).toBe(1);
	});

	it('soft-deletes keep the record (so it can be synced as a tombstone)', async () => {
		const id = await db.clients.add({ name: 'Carla', phone: '9' } as any);
		await db.clients.update(id, { deleted: 1, synced: 0, updatedAt: Date.now() });
		const after = await db.clients.get(id);
		expect(after).toBeDefined();
		expect(after?.deleted).toBe(1);
	});
});
