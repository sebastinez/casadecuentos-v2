import { canTransition, type OrderStatus } from './order-state';
import { site } from '$lib/site';
import { DEFAULT_LOCALE, type Locale } from '$lib/i18n';
import type { OrderLine } from './order';
import type { MailTransport } from '$lib/server/mail';
import { orderConfirmationEmail } from '$lib/server/mail';

// Payment fulfilment: the business logic the Stripe webhook runs once payment is
// confirmed. Stripe-agnostic and port-injected (webhook.ts normalizes the event;
// PocketBase/Resend hide behind the ports below) so the whole contract is
// unit-testable with fakes. Sole source of truth for marking an order paid — the
// success redirect never is.

// Provider-neutral view of a completed checkout; nothing Stripe-shaped leaks past.
export interface CompletedCheckout {
	// Our `orders` record id, echoed back via Stripe session `metadata.orderId`.
	orderId: string;
	// Stripe event id, persisted for dedupe forensics.
	eventId: string;
	// `email` may be absent in rare cases; the address is stored opaquely.
	email: string | null;
	shippingAddress: unknown;
}

// The cart snapshot (`items`) is authoritative for the stock decrement — never the
// Stripe line items — so we decrement exactly what the customer was charged for.
export interface FulfillmentOrder {
	id: string;
	status: OrderStatus;
	items: OrderLine[];
	items_total: number;
	shipping_total: number;
	total: number;
	currency: string;
	// Buyer's locale, captured at checkout; localizes the confirmation email.
	locale?: Locale;
}

// Persisted patch applied at the `paid` transition.
export interface MarkPaidPatch {
	orderNumber: number;
	email: string | null;
	shippingAddress: unknown;
	eventId: string;
}

// Order persistence port (PocketBase in production, a fake in tests).
export interface OrdersPort {
	getById(id: string): Promise<FulfillmentOrder | null>;
	// Assigned at `paid` (not `pending`) so the customer-facing sequence has no
	// gaps from abandoned carts.
	nextOrderNumber(): Promise<number>;
	// The idempotency *latch*: once it lands, a redelivered event finds the order
	// no longer `pending` and skips.
	markPaid(id: string, patch: MarkPaidPatch): Promise<void>;
}

// Overselling is tolerated in v1 (no reservation), so this is a best-effort
// decrement, not a transactional reservation.
export interface StockPort {
	decrement(lines: { id: string; qty: number }[]): Promise<void>;
}

export interface FulfillmentDeps {
	orders: OrdersPort;
	stock: StockPort;
	mail: MailTransport;
}

// `already_processed` and `unknown_order` are both successful acknowledgements
// (200) — nothing more to do — not errors.
export type FulfillmentResult =
	| { outcome: 'fulfilled'; orderNumber: number }
	| { outcome: 'already_processed' }
	| { outcome: 'unknown_order' };

// Fulfil a confirmed checkout. Idempotent — Stripe redelivers, so this marks paid
// and decrements stock exactly once. The `markPaid` latch lands *before* the stock
// decrement and email: a redelivered event then short-circuits at the status guard,
// so the post-latch steps can never be re-run and are best-effort (logged, not
// thrown). Worst case is an under-decrement (oversell, tolerated in v1); stock is
// never double-decremented.
export async function fulfillCheckout(
	input: CompletedCheckout,
	deps: FulfillmentDeps
): Promise<FulfillmentResult> {
	const order = await deps.orders.getById(input.orderId);

	// The order is always created before the Stripe session, so a miss means a
	// forged-but-validly-signed event or data corruption, not a race. Acknowledge
	// so Stripe stops retrying; the caller logs it.
	if (!order) {
		return { outcome: 'unknown_order' };
	}

	// Idempotency latch: only a `pending` order can be fulfilled. `paid`/`shipped`
	// means a prior delivery already did the work.
	if (!canTransition(order.status, 'paid')) {
		return { outcome: 'already_processed' };
	}

	const orderNumber = await deps.orders.nextOrderNumber();
	// The customer-facing confirmation goes out in the locale they shopped in; the
	// owner copy below stays in Spanish (DEFAULT_LOCALE).
	const locale = order.locale ?? DEFAULT_LOCALE;

	// The latch — flip to paid first (see ordering note above).
	await deps.orders.markPaid(order.id, {
		orderNumber,
		email: input.email,
		shippingAddress: input.shippingAddress,
		eventId: input.eventId
	});

	try {
		await deps.mail.send(
			orderConfirmationEmail({
				orderNumber,
				email: site.email,
				lines: order.items,
				itemsTotal: order.items_total,
				shipping: order.shipping_total,
				total: order.total,
				currency: order.currency
			})
		);
	} catch (err) {
		console.error(`[fulfillment] creation of new order email failed for order ${order.id}:`, err);
	}

	// --- Best-effort, post-latch (logged, not thrown; see ordering note above) ---

	// Decrement stock for exactly the lines that were charged (the order snapshot).
	try {
		await deps.stock.decrement(order.items.map((line) => ({ id: line.id, qty: line.qty })));
	} catch (err) {
		console.error(`[fulfillment] stock decrement failed for order ${order.id}:`, err);
	}

	// Guard on a present email — we can't send without it.
	if (input.email) {
		try {
			await deps.mail.send(
				orderConfirmationEmail(
					{
						orderNumber,
						email: input.email,
						lines: order.items,
						itemsTotal: order.items_total,
						shipping: order.shipping_total,
						total: order.total,
						currency: order.currency
					},
					locale
				)
			);
		} catch (err) {
			console.error(`[fulfillment] confirmation email failed for order ${order.id}:`, err);
		}
	}

	return { outcome: 'fulfilled', orderNumber };
}
