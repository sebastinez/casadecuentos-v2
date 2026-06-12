import { describe, it, expect, vi } from 'vitest';
import type Stripe from 'stripe';
import { handleStripeWebhook, type WebhookDeps } from './webhook';
import type { FulfillmentDeps, FulfillmentOrder } from './fulfillment';

// Stateful fake fulfilment deps — `markPaid` mutates the stored order so a
// redelivery observes the `paid` state (same approach as fulfillment.spec).
function fakeFulfillment(initial: FulfillmentOrder) {
	const store = new Map<string, FulfillmentOrder>([[initial.id, { ...initial }]]);
	let counter = 1000;
	const markPaid = vi.fn(async (id: string) => {
		const order = store.get(id);
		if (order) order.status = 'paid';
	});
	const getById = vi.fn(async (id: string) => {
		const found = store.get(id);
		return found ? { ...found } : null;
	});
	const nextOrderNumber = vi.fn(async () => ++counter);
	const decrement = vi.fn(async () => {});
	const send = vi.fn(async () => {});
	const deps: FulfillmentDeps = {
		orders: { getById, nextOrderNumber, markPaid },
		stock: { decrement },
		mail: { send }
	};
	return { deps, getById, markPaid, decrement, send };
}

const ORDER: FulfillmentOrder = {
	id: 'ord_1',
	status: 'pending',
	items: [{ id: 'a', title: 'El Principito', unitPrice: 24.9, qty: 2, lineTotal: 49.8 }],
	items_total: 49.8,
	shipping_total: 8,
	total: 57.8,
	currency: 'CHF'
};

// A crafted `checkout.session.completed` event, shaped just enough for the
// handler's reads (metadata.orderId, customer_details.email,
// collected_information.shipping_details).
function completedEvent(orderId: string | null = 'ord_1'): Stripe.Event {
	return {
		id: 'evt_1',
		type: 'checkout.session.completed',
		data: {
			object: {
				metadata: orderId ? { orderId } : {},
				customer_details: { email: 'cliente@example.com' },
				collected_information: {
					shipping_details: { name: 'Ada', address: { country: 'CH', city: 'Zürich' } }
				}
			}
		}
	} as unknown as Stripe.Event;
}

// A verifier that only accepts the signature `good-sig`; anything else throws,
// modelling Stripe's `constructEvent` rejecting a forged/missing signature.
function verifierFor(event: Stripe.Event) {
	return (_rawBody: string, signature: string | null): Stripe.Event => {
		if (signature !== 'good-sig') {
			throw new Error('No signatures found matching the expected signature for payload.');
		}
		return event;
	};
}

describe('handleStripeWebhook', () => {
	it('rejects an invalid signature with 400 and never touches the fulfilment ports', async () => {
		const f = fakeFulfillment(ORDER);
		const deps: WebhookDeps = {
			constructEvent: verifierFor(completedEvent()),
			fulfillment: f.deps
		};

		const result = await handleStripeWebhook('{}', 'forged-sig', deps);

		expect(result.status).toBe(400);
		// The security-meaningful assertion: a forged event fires no side effects.
		expect(f.getById).not.toHaveBeenCalled();
		expect(f.markPaid).not.toHaveBeenCalled();
		expect(f.decrement).not.toHaveBeenCalled();
		expect(f.send).not.toHaveBeenCalled();
	});

	it('rejects a missing signature with 400', async () => {
		const f = fakeFulfillment(ORDER);
		const deps: WebhookDeps = {
			constructEvent: verifierFor(completedEvent()),
			fulfillment: f.deps
		};

		const result = await handleStripeWebhook('{}', null, deps);

		expect(result.status).toBe(400);
		expect(f.markPaid).not.toHaveBeenCalled();
	});

	it('fulfils a valid checkout.session.completed: 200 + order marked paid, stock + mail once', async () => {
		const f = fakeFulfillment(ORDER);
		const deps: WebhookDeps = {
			constructEvent: verifierFor(completedEvent()),
			fulfillment: f.deps
		};

		const result = await handleStripeWebhook('{}', 'good-sig', deps);

		expect(result.status).toBe(200);
		expect(result.outcome).toBe('fulfilled');
		expect(f.markPaid).toHaveBeenCalledTimes(1);
		expect(f.decrement).toHaveBeenCalledTimes(1);
		expect(f.send).toHaveBeenCalledTimes(1);
	});

	it('is idempotent on redelivery: same event twice → side effects fire exactly once', async () => {
		const f = fakeFulfillment(ORDER);
		const deps: WebhookDeps = {
			constructEvent: verifierFor(completedEvent()),
			fulfillment: f.deps
		};

		const first = await handleStripeWebhook('{}', 'good-sig', deps);
		const second = await handleStripeWebhook('{}', 'good-sig', deps);

		expect(first.status).toBe(200);
		expect(first.outcome).toBe('fulfilled');
		expect(second.status).toBe(200);
		expect(second.outcome).toBe('already_processed');
		expect(f.markPaid).toHaveBeenCalledTimes(1);
		expect(f.decrement).toHaveBeenCalledTimes(1);
		expect(f.send).toHaveBeenCalledTimes(1);
	});

	it('acknowledges (200) an event type it does not act on, touching no ports', async () => {
		const f = fakeFulfillment(ORDER);
		const other = { id: 'evt_2', type: 'payment_intent.succeeded' } as unknown as Stripe.Event;
		const deps: WebhookDeps = { constructEvent: verifierFor(other), fulfillment: f.deps };

		const result = await handleStripeWebhook('{}', 'good-sig', deps);

		expect(result.status).toBe(200);
		expect(result.outcome).toBe('ignored_event_type');
		expect(f.getById).not.toHaveBeenCalled();
	});

	it('ignores a completed session with no orderId metadata (not ours)', async () => {
		const f = fakeFulfillment(ORDER);
		const deps: WebhookDeps = {
			constructEvent: verifierFor(completedEvent(null)),
			fulfillment: f.deps
		};

		const result = await handleStripeWebhook('{}', 'good-sig', deps);

		expect(result.status).toBe(200);
		expect(result.outcome).toBe('ignored_no_order_id');
		expect(f.getById).not.toHaveBeenCalled();
	});
});
