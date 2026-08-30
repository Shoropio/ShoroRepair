import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Neutralize the Dexie "create/update" hook that auto-schedules a sync 1s later:
// keep the real SyncManager.sync() for our tests, but make syncOnChange() a no-op
// so a write in one test can't trigger a background sync that contaminates another.
vi.mock('../offline/sync', async (importOriginal) => {
	const actual = (await importOriginal()) as any;
	const real = actual.syncManager;
	const proxied = new Proxy(real, {
		get: (target, prop) => (prop === 'syncOnChange' ? () => {} : target[prop as any])
	});
	return { ...actual, syncManager: proxied };
});

// Minimal browser globals so sync.ts (touches window/navigator/localStorage) runs
// under the node test environment without pulling in jsdom.
const listeners: Record<string, Array<(...a: any[]) => void>> = {};
(globalThis as any).window = {
	addEventListener: (type: string, cb: (...a: any[]) => void) => { (listeners[type] ||= []).push(cb); },
	removeEventListener: () => {}
};
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
	getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
	setItem: (k: string, v: string) => { mem.set(k, String(v)); },
	removeItem: (k: string) => { mem.delete(k); },
	clear: () => mem.clear()
};

// --- In-memory Firestore mock (shared via hoist so the factory can see it) ---
const h = vi.hoisted(() => {
	const store = new Map<string, Map<string, any>>();
	const pathOf = (...parts: string[]) => parts.join('/');
	return { store, pathOf };
});

vi.mock('../firebase/firestore', () => ({ firestore: {} }));

vi.mock('firebase/firestore', () => {
	const collection = (_fs: any, ...parts: string[]) => ({ __path: h.pathOf(...parts) });
	const doc = (colRef: any, id: string) => ({ __path: colRef.__path, __id: id });
	const setDoc = async (docRef: any, data: any) => {
		const m = h.store.get(docRef.__path) || new Map();
		m.set(docRef.__id, data);
		h.store.set(docRef.__path, m);
	};
	const where = (field: string, op: string, value: any) => ({ field, op, value });
	const query = (colRef: any, ...clauses: any[]) => ({ __path: colRef.__path, clauses });
	const getDocs = async (q: any) => {
		const m = h.store.get(q.__path) || new Map();
		let docs = [...m.entries()].map(([id, data]) => ({ id, data: () => data }));
		for (const c of q.clauses) {
			if (c.op === '>') docs = docs.filter(d => (d.data()[c.field] ?? 0) > c.value);
		}
		return { docs };
	};
	const writeBatch = () => ({ set: () => {}, update: () => {}, delete: () => {}, commit: async () => {} });
	const Timestamp = class {};
	const getDoc = async () => ({ exists: () => false, data: () => undefined });
	const serverTimestamp = () => ({});
	return {
		collection, doc, setDoc, getDocs, query, where, writeBatch, Timestamp, getDoc, serverTimestamp
	};
});

vi.mock('../firebase/auth', () => ({
	auth: { currentUser: { uid: 'u1', email: 'tester@example.com' } }
}));

// Import AFTER mocks + globals are registered.
const { db } = await import('./db');
const { syncManager, sanitizeForFirestore } = await import('./sync');

function seedRemote(collection: string, data: any) {
	const path = h.pathOf('users_data', 'u1', collection);
	const m = h.store.get(path) || new Map();
	m.set(data.syncId, data);
	h.store.set(path, m);
}

beforeEach(async () => {
	h.store.clear();
	localStorage.clear();
	await db.open().catch(() => {});
	await Promise.all(db.tables.map(t => t.clear()));
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('SyncManager (firebase mocked, indexeddb mocked)', () => {
	it('pushes local changes, strips password, and marks records synced', async () => {
		const id = await db.clients.add({
			name: 'Ana', phone: '8888', email: 'ana@x.com',
			password: 'supersecret-hash', synced: 0
		} as any);

		await syncManager.sync();

		const local = await db.clients.get(id);
		expect(local?.synced).toBe(1);
		expect(local?.password).toBe('supersecret-hash'); // untouched locally

		const remote = h.store.get(h.pathOf('users_data', 'u1', 'clients'))?.get(local!.syncId);
		expect(remote).toBeDefined();
		expect(remote.password).toBeUndefined(); // never uploaded
		expect(remote.synced).toBe(1);
	});

	it('pulls and applies a newer remote record when local has no pending changes', async () => {
		const id = await db.clients.add({ name: 'Old', phone: '1', updatedAt: 100, synced: 1 } as any);
		const local = await db.clients.get(id);
		seedRemote('clients', { syncId: local!.syncId, name: 'New', phone: '2', updatedAt: 200, synced: 1 });

		await syncManager.sync();

		const after = await db.clients.get(id);
		expect(after?.name).toBe('New');
		expect(after?.synced).toBe(1);
	});

	it('flags a conflict (keeps local) when local is pending and remote is newer, and logs it', async () => {
		const id = await db.clients.add({ name: 'Local', phone: '1', updatedAt: 100, synced: 0 } as any);
		const local = await db.clients.get(id);
		seedRemote('clients', { syncId: local!.syncId, name: 'Remote', phone: '9', updatedAt: 200, synced: 1 });

		await syncManager.sync();

		const after = await db.clients.get(id);
		expect(after?.name).toBe('Local'); // local kept
		expect(after?.conflict).toBe(1);

		const logs = (await db.activity_logs.toArray())
			.filter(l => l.action === 'Conflicto de sincronización');
		expect(logs.length).toBe(1);
		expect(logs[0].entityId).toBe(local!.syncId);
	});

	it('applies a remote tombstone (deleted:1) to an existing local record', async () => {
		const id = await db.clients.add({ name: 'ToDelete', phone: '1', updatedAt: 100, synced: 1 } as any);
		const local = await db.clients.get(id);
		seedRemote('clients', { syncId: local!.syncId, name: 'ToDelete', phone: '1', updatedAt: 200, deleted: 1, synced: 1 });

		await syncManager.sync();

		const after = await db.clients.get(id);
		expect(after?.deleted).toBe(1);
	});

	it('push strips undefined values so Firestore never rejects the document', async () => {
		const id = await db.clients.add({
			name: 'Demo', phone: '8888', email: undefined, taxId: undefined, touched: undefined, synced: 0
		} as any);

		await syncManager.sync();

		const local = await db.clients.get(id);
		const remote = h.store.get(h.pathOf('users_data', 'u1', 'clients'))?.get(local!.syncId);
		expect(remote).toBeDefined();
		expect(remote).not.toHaveProperty('taxId');
		expect(remote).not.toHaveProperty('email');
		expect(remote).not.toHaveProperty('touched');
		expect(remote.name).toBe('Demo');
		expect(remote.synced).toBe(1);
	});
});

describe('sanitizeForFirestore', () => {
	it('deep-strips undefined values from objects and arrays', () => {
		const input = {
			taxId: undefined,
			name: 'Ana',
			parts: [
				{ price: 10, qty: undefined },
				{ price: undefined, tag: 'x' }
			],
			logs: [{ status: 'OK', note: undefined, tech: 't1' }],
			meta: { a: 1, b: undefined, arr: [1, undefined, 2] }
		};
		const out = sanitizeForFirestore(input) as any;

		expect(out).not.toHaveProperty('taxId');
		expect(out.name).toBe('Ana');
		expect(out.parts[0]).toEqual({ price: 10 });
		expect(out.parts[1]).toEqual({ tag: 'x' });
		expect(out.logs[0]).toEqual({ status: 'OK', tech: 't1' });
		expect(out.meta).toEqual({ a: 1, arr: [1, 2] });
	});
});
