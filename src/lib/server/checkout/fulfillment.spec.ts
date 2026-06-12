import { describe, it, expect, vi } from 'vitest';
import {
	fulfillCheckout,
	type CompletedCheckout,
	type FulfillmentDeps,
	type FulfillmentOrder
} from './fulfillment';
import type { MailMessage } from '$lib/server/mail';

// A stateful fake `orders` port. Crucially, `markPaid` *mutates* the stored
// order so a second `getById` reflects the flip — that is what makes the
// idempotency test meaningful (a redelivery must observe the already-`paid`
// state). Records call counts so we can assert "exactly once".
function fakeOrders(initial: FulfillmentOrder) {
	const store = new Map<string, FulfillmentOrder>([[initial.id, { ...initial }]]);
	let counter = 1041;
	const calls = { markPaid: [] as { id: string; orderNumber: number }[], nextOrderNumber: 0 };
	return {
		calls,
		getById: vi.fn(async (id: string) => {
			const found = store.get(id);
			return found ? { ...found } : null;
		}),
		nextOrderNumber: vi.fn(async () => {
			calls.nextOrderNumber++;
			return ++counter;
		}),
		markPaid: vi.fn(async (id: string, patch: { orderNumber: number }) => {
			const order = store.get(id);
			if (order) {
				order.status = 'paid';
			}
			calls.markPaid.push({ id, orderNumber: patch.orderNumber });
		})
	};
}

function fakeDeps(initial: FulfillmentOrder) {
	const orders = fakeOrders(initial);
	const decrement = vi.fn(async () => {});
	const sent: MailMessage[] = [];
	const send = vi.fn(async (message: MailMessage) => {
		sent.push(message);
	});
	const deps: FulfillmentDeps = { orders, stock: { decrement }, mail: { send } };
	return { deps, orders, decrement, send, sent };
}

const ORDER: FulfillmentOrder = {
	id: 'ord_1',
	status: 'pending',
	items: [
		{ id: 'a', title: 'El Principito', unitPrice: 24.9, qty: 2, lineTotal: 49.8 },
		{ id: 'b', title: 'La Oruga', unitPrice: 12, qty: 1, lineTotal: 12 }
	],
	items_total: 61.8,
	shipping_total: 8,
	total: 69.8,
	currency: 'CHF'
};

const EVENT: CompletedCheckout = {
	orderId: 'ord_1',
	eventId: 'evt_1',
	email: 'cliente@example.com',
	shippingAddress: { name: 'Ada', address: { country: 'CH', city: 'Zürich' } }
};

describe('fulfillCheckout', () => {
	it('flips a pending order to paid, assigning an order number and persisting payment details', async () => {
		const { deps, orders } = fakeDeps(ORDER);

		const result = await fulfillCheckout(EVENT, deps);

		expect(result).toEqual({ outcome: 'fulfilled', orderNumber: 1042 });
		expect(orders.markPaid).toHaveBeenCalledWith('ord_1', {
			orderNumber: 1042,
			email: 'cliente@example.com',
			shippingAddress: EVENT.shippingAddress,
			eventId: 'evt_1'
		});
	});

	it('decrements stock for exactly the order snapshot lines', async () => {
		const { deps, decrement } = fakeDeps(ORDER);

		await fulfillCheckout(EVENT, deps);

		expect(decrement).toHaveBeenCalledTimes(1);
		expect(decrement).toHaveBeenCalledWith([
			{ id: 'a', qty: 2 },
			{ id: 'b', qty: 1 }
		]);
	});

	it('triggers the Spanish confirmation email with the order details', async () => {
		const { deps, send, sent } = fakeDeps(ORDER);

		await fulfillCheckout(EVENT, deps);

		expect(send).toHaveBeenCalledTimes(1);
		expect(sent[0].to).toBe('cliente@example.com');
		expect(sent[0].subject).toContain('#1042');
		expect(sent[0].subject).toContain('Confirmación de pedido');
		expect(sent[0].text).toContain('El Principito');
	});

	it('is idempotent: a redelivered event marks paid and decrements stock exactly once', async () => {
		const { deps, orders, decrement, send } = fakeDeps(ORDER);

		const first = await fulfillCheckout(EVENT, deps);
		const second = await fulfillCheckout(EVENT, deps);

		expect(first.outcome).toBe('fulfilled');
		expect(second).toEqual({ outcome: 'already_processed' });
		// Side effects fired exactly once across both deliveries.
		expect(orders.markPaid).toHaveBeenCalledTimes(1);
		expect(decrement).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledTimes(1);
		// No second order number was burned on the redelivery.
		expect(orders.calls.nextOrderNumber).toBe(1);
	});

	it('skips an already-shipped order without re-fulfilling', async () => {
		const { deps, orders, decrement } = fakeDeps({ ...ORDER, status: 'shipped' });

		const result = await fulfillCheckout(EVENT, deps);

		expect(result).toEqual({ outcome: 'already_processed' });
		expect(orders.markPaid).not.toHaveBeenCalled();
		expect(decrement).not.toHaveBeenCalled();
	});

	it('acknowledges an unknown order without side effects (foreign/forged event)', async () => {
		const { deps, orders, decrement, send } = fakeDeps(ORDER);

		const result = await fulfillCheckout({ ...EVENT, orderId: 'ghost' }, deps);

		expect(result).toEqual({ outcome: 'unknown_order' });
		expect(orders.markPaid).not.toHaveBeenCalled();
		expect(decrement).not.toHaveBeenCalled();
		expect(send).not.toHaveBeenCalled();
	});

	it('treats a post-latch email failure as best-effort: order stays fulfilled, no throw', async () => {
		// The paid latch blocks re-entry, so a Stripe retry can't re-run the send —
		// fulfilment must swallow the failure (log) rather than emit a useless 500.
		const { deps } = fakeDeps(ORDER);
		deps.mail.send = vi.fn(async () => {
			throw new Error('Resend 500');
		});
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = await fulfillCheckout(EVENT, deps);

		expect(result).toEqual({ outcome: 'fulfilled', orderNumber: 1042 });
		expect(logged).toHaveBeenCalled();
		logged.mockRestore();
	});

	it('treats a post-latch stock failure as best-effort: order stays fulfilled, no throw', async () => {
		const { deps } = fakeDeps(ORDER);
		deps.stock.decrement = vi.fn(async () => {
			throw new Error('PocketBase unavailable');
		});
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

		const result = await fulfillCheckout(EVENT, deps);

		expect(result.outcome).toBe('fulfilled');
		expect(logged).toHaveBeenCalled();
		logged.mockRestore();
	});

	it('still marks paid + decrements when no email is present, only skipping the mail', async () => {
		const { deps, decrement, send } = fakeDeps(ORDER);

		const result = await fulfillCheckout({ ...EVENT, email: null }, deps);

		expect(result.outcome).toBe('fulfilled');
		expect(decrement).toHaveBeenCalledTimes(1);
		expect(send).not.toHaveBeenCalled();
	});
});
