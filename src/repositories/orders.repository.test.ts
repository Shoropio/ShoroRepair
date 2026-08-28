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
const { listOrders, createOrder, updateOrderData, softDeleteOrder } = await import('./orders.repository');
const { ServiceOrder } = await import('../types') as any;

function makeOrder(): ServiceOrder {
	return {
		orderNumber: 'OS-123456',
		status: 'received',
		brand: 'Samsung',
		model: 'Galaxy',
		createdAt: Date.now(),
		updatedAt: Date.now(),
		synced: 0
	} as ServiceOrder;
}

beforeEach(async () => {
	localStorage.clear();
	await db.open().catch(() => {});
	await Promise.all(db.tables.map(t => t.clear()));
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('orders.repository', () => {
	it('lists active orders, filtering by status and search', async () => {
		await createOrder({ ...makeOrder(), orderNumber: 'OS-AAA', brand: 'Samsung', model: 'S21' });
		await createOrder({ ...makeOrder(), orderNumber: 'OS-BBB', brand: 'Apple', model: 'iPhone', status: 'ready' });

		expect((await listOrders()).length).toBe(2);

		const ready = await listOrders({ status: 'ready' });
		expect(ready.length).toBe(1);
		expect(ready[0].orderNumber).toBe('OS-BBB');

		const bySearch = await listOrders({ search: 'samsung' });
		expect(bySearch.length).toBe(1);
		expect(bySearch[0].orderNumber).toBe('OS-AAA');
	});

	it('excludes soft-deleted orders from the active list', async () => {
		const id = await createOrder(makeOrder());
		await softDeleteOrder(id);

		const list = await listOrders();
		expect(list.map(o => o.id)).not.toContain(id);

		const raw = await db.orders.get(id);
		expect(raw?.deleted).toBe(1);
	});

	it('updates order data and marks it pending (synced:0)', async () => {
		const id = await createOrder(makeOrder());
		await updateOrderData(id, { status: 'in_repair' });

		const updated = await db.orders.get(id);
		expect(updated?.status).toBe('in_repair');
		expect(updated?.synced).toBe(0);
	});
});
