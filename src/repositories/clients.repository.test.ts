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
	createClient,
	updateClient,
	softDeleteClient,
	listActiveClients,
	searchActiveClients
} = await import('./clients.repository');

beforeEach(async () => {
	localStorage.clear();
	await db.open().catch(() => {});
	await Promise.all(db.tables.map(t => t.clear()));
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('clients.repository', () => {
	it('creates a client with sync metadata and lists it as active', async () => {
		const id = await createClient({ name: 'Ana', phone: '8888', email: 'ana@x.com' });
		expect(id).toBeTruthy();

		const created = await db.clients.get(id);
		expect(created?.createdAt).toBeTruthy();
		expect(created?.updatedAt).toBeTruthy();
		expect(created?.synced).toBe(0);

		const active = await listActiveClients();
		expect(active.map(c => c.id)).toContain(id);
	});

	it('updates a client and marks it pending (synced:0)', async () => {
		const id = await createClient({ name: 'Bob', phone: '1' });
		await updateClient(id, { name: 'Bobby' });

		const updated = await db.clients.get(id);
		expect(updated?.name).toBe('Bobby');
		expect(updated?.synced).toBe(0);
	});

	it('soft-deletes a client so it disappears from active/search results', async () => {
		const id = await createClient({ name: 'Carla', phone: '9' });
		await softDeleteClient(id);

		const active = await listActiveClients();
		expect(active.map(c => c.id)).not.toContain(id);

		const search = await searchActiveClients('Carla');
		expect(search.map(c => c.id)).not.toContain(id);

		// The row is retained (tombstone), not physically removed.
		const raw = await db.clients.get(id);
		expect(raw?.deleted).toBe(1);
	});

	it('searches active clients case-insensitively by name/email/phone', async () => {
		await createClient({ name: 'Zoe', phone: '555', email: 'zoe@x.com' });
		await createClient({ name: 'Ana', phone: '111', email: 'ana@x.com' });

		const byName = await searchActiveClients('zoe');
		expect(byName.length).toBe(1);
		expect(byName[0].name).toBe('Zoe');

		const byEmail = await searchActiveClients('ANA@X.COM');
		expect(byEmail.length).toBe(1);
		expect(byEmail[0].name).toBe('Ana');

		const byPhone = await searchActiveClients('555');
		expect(byPhone.length).toBe(1);
		expect(byPhone[0].name).toBe('Zoe');
	});
});
