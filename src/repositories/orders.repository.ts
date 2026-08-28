import { db } from '../offline/db';
import type { ServiceOrder } from '../types';

/**
 * Data-access layer for service orders.
 *
 * Only the `orders` table is touched here; the inventory/settings side-effects
 * that surround order updates (stock diffing, invoice-number generation) live in
 * the calling feature because they span other domains. This module centralises
 * the sync flags (`synced: 0`, `updatedAt`) and the soft-delete convention.
 */

export type OrderListFilter = {
	status?: string;
	search?: string;
};

export async function listOrders(filter: OrderListFilter = {}): Promise<ServiceOrder[]> {
	const all = (await db.orders.orderBy('createdAt').reverse().toArray()) as ServiceOrder[];
	return all.filter(o => {
		if (o.deleted === 1) return false;
		if (filter.status && filter.status !== 'all' && o.status !== filter.status) return false;
		if (!filter.search) return true;
		const q = filter.search.toLowerCase();
		return (
			(o.orderNumber?.toLowerCase().includes(q)) ||
			(o.brand?.toLowerCase().includes(q)) ||
			(o.model?.toLowerCase().includes(q))
		);
	});
}

export async function getOrder(id: number): Promise<ServiceOrder | undefined> {
	return db.orders.get(id) as Promise<ServiceOrder | undefined>;
}

export async function createOrder(order: ServiceOrder): Promise<number> {
	return db.orders.add(order as unknown as ServiceOrder);
}

export async function updateOrderData(id: number, data: Partial<ServiceOrder>): Promise<void> {
	await db.orders.update(id, { ...data, updatedAt: Date.now(), synced: 0 });
}

export async function softDeleteOrder(id: number): Promise<void> {
	await db.orders.update(id, { deleted: 1, synced: 0 });
}
