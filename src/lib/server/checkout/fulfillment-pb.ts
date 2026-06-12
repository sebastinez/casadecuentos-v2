import type PocketBase from 'pocketbase';
import { ClientResponseError } from 'pocketbase';
import type { FulfillmentOrder, OrdersPort, StockPort } from './fulfillment';

// Production implementations of the fulfilment ports, backed by PocketBase.
// Thin I/O wrappers (integration-tested, not unit-tested, per the PRD) — all the
// fulfilment *logic* lives in `fulfillment.ts` behind these interfaces. The
// webhook route wires these to a superuser-authenticated client.

// Human-readable order numbers start here, so the first real order reads as a
// four-digit number rather than `1`.
const ORDER_NUMBER_START = 1000;

// The order persistence port. Reads the `pending` snapshot, allocates the next
// order number, and flips to `paid`.
export function createOrdersPort(pb: PocketBase): OrdersPort {
	return {
		async getById(id: string): Promise<FulfillmentOrder | null> {
			try {
				const record = await pb.collection('orders').getOne(id);
				return {
					id: record.id,
					status: record.status,
					// `items` is a JSON column; it round-trips as the `OrderLine[]` the
					// checkout snapshot wrote.
					items: record.items ?? [],
					items_total: record.items_total ?? 0,
					shipping_total: record.shipping_total ?? 0,
					total: record.total ?? 0,
					currency: record.currency ?? 'CHF'
				};
			} catch (err) {
				if (err instanceof ClientResponseError && err.status === 404) {
					return null;
				}
				throw err;
			}
		},

		// Allocate the next number as max(existing) + 1. The partial unique index on
		// `order_number` (WHERE > 0) backstops a race by erroring the save; the v1
		// single-instance BFF won't hit it. Filter to populated rows so abandoned
		// `pending` orders (number 0) don't skew the max.
		async nextOrderNumber(): Promise<number> {
			const list = await pb.collection('orders').getList(1, 1, {
				filter: 'order_number > 0',
				sort: '-order_number',
				fields: 'order_number'
			});
			const top = list.items[0]?.order_number ?? ORDER_NUMBER_START - 1;
			return top + 1;
		},

		async markPaid(id, patch): Promise<void> {
			await pb.collection('orders').update(id, {
				status: 'paid',
				order_number: patch.orderNumber,
				email: patch.email ?? '',
				shipping_address: patch.shippingAddress ?? null,
				stripe_event_id: patch.eventId
			});
		}
	};
}

// The stock port. Best-effort per-line decrement (read current, write
// `max(0, stock - qty)`). Overselling is tolerated in v1 — no reservation, no
// transaction — so a clamp at zero is enough to avoid negative stock.
export function createStockPort(pb: PocketBase): StockPort {
	return {
		async decrement(lines): Promise<void> {
			for (const line of lines) {
				const book = await pb.collection('books').getOne(line.id, { fields: 'id,stock' });
				const next = Math.max(0, (book.stock ?? 0) - line.qty);
				await pb.collection('books').update(line.id, { stock: next });
			}
		}
	};
}
