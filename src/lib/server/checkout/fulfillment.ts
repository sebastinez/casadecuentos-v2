import { canTransition, type OrderStatus } from './order-state';
import type { OrderLine } from './order';
import type { MailTransport } from '$lib/server/mail';
import { orderConfirmationEmail } from '$lib/server/mail';

// Payment fulfilment — the business logic the Stripe webhook runs once a payment
// is confirmed. Deliberately Stripe-agnostic and port-injected: `webhook.ts`
// verifies the signature and normalizes the raw event into a `CompletedCheckout`
// before calling in here, and PocketBase / Resend hide behind the ports below.
// So the whole fulfilment contract — the `pending → paid` flip, stock
// decrement, confirmation email, and (critically) idempotency — is unit-testable
// with fakes, no Stripe and no real I/O.
//
// This module is the sole source of truth for marking an order paid. The success
// redirect never is.

// The normalized, provider-neutral view of a completed checkout. `webhook.ts`
// maps a `checkout.session.completed` event into this; the fields it carries are
// exactly what fulfilment needs and nothing Stripe-shaped leaks past here.
export interface CompletedCheckout {
	// Our `orders` record id, echoed back via Stripe session `metadata.orderId`.
	orderId: string;
	// The Stripe event id, persisted for traceability / dedupe forensics.
	eventId: string;
	// Customer email + shipping address Stripe collected at checkout. `email` may
	// be absent in pathological cases; the address is stored opaquely.
	email: string | null;
	shippingAddress: unknown;
}

// The slice of the persisted order fulfilment reads. The cart snapshot (`items`)
// is authoritative for the stock decrement — never the Stripe line items — so we
// decrement exactly what the customer was charged for.
export interface FulfillmentOrder {
	id: string;
	status: OrderStatus;
	items: OrderLine[];
	items_total: number;
	shipping_total: number;
	total: number;
	currency: string;
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
	// Allocate the next human-readable order number. Assigned here at `paid`
	// (not at `pending`) so the customer-facing sequence has no gaps from
	// abandoned carts.
	nextOrderNumber(): Promise<number>;
	// Flip the order to `paid` with the snapshot of payment details. This write
	// is the idempotency *latch*: once it lands, a redelivered event finds the
	// order no longer `pending` and skips.
	markPaid(id: string, patch: MarkPaidPatch): Promise<void>;
}

// Stock port. Overselling is tolerated in v1 (no reservation), so this is a
// best-effort decrement, not a transactional reservation.
export interface StockPort {
	decrement(lines: { id: string; qty: number }[]): Promise<void>;
}

export interface FulfillmentDeps {
	orders: OrdersPort;
	stock: StockPort;
	mail: MailTransport;
}

// Outcome of handling one completed-checkout event, so the webhook can map it to
// an HTTP status and a log line. `already_processed` and `unknown_order` are
// both successful acknowledgements (200) — nothing more to do — not errors.
export type FulfillmentResult =
	| { outcome: 'fulfilled'; orderNumber: number }
	| { outcome: 'already_processed' }
	| { outcome: 'unknown_order' };

// Fulfil a confirmed checkout. Idempotent: safe to call repeatedly for the same
// event (Stripe redelivers), marking paid and decrementing stock exactly once.
//
// Order of operations is deliberate. The `markPaid` latch lands *before* the
// stock decrement and email: a redelivered or retried event then short-circuits
// at the status guard. Because the latch blocks re-entry, the post-latch steps
// can never be re-run by a retry, so they are best-effort (logged, not thrown —
// see below). A failure there may *under*-decrement (an oversell, which v1
// explicitly tolerates) or skip the email, but stock is never *double*-
// decremented. Latch-first is the safe direction.
export async function fulfillCheckout(
	input: CompletedCheckout,
	deps: FulfillmentDeps
): Promise<FulfillmentResult> {
	const order = await deps.orders.getById(input.orderId);

	// No such order. The order is always created before the Stripe session, so a
	// miss means a foreign/forged-but-validly-signed event or data corruption —
	// not a race. Acknowledge so Stripe stops retrying; the caller logs it.
	if (!order) {
		return { outcome: 'unknown_order' };
	}

	// Idempotency latch. Only a `pending` order can be fulfilled; `paid`/`shipped`
	// means a prior delivery already did the work (`pending → paid` is the one
	// legal step, and `paid → paid` is illegal, so a redelivery lands here).
	if (!canTransition(order.status, 'paid')) {
		return { outcome: 'already_processed' };
	}

	const orderNumber = await deps.orders.nextOrderNumber();

	// The latch — flip to paid first (see ordering note above).
	await deps.orders.markPaid(order.id, {
		orderNumber,
		email: input.email,
		shippingAddress: input.shippingAddress,
		eventId: input.eventId
	});

	// --- Best-effort, post-latch ---
	// Everything below runs *after* the latch, which blocks re-entry: a Stripe
	// retry of this event would short-circuit at the idempotency guard above and
	// never re-run these steps. So a throw here can't be recovered by a retry and
	// would only emit a misleading 500. Instead we log and carry on — the payment
	// is captured and the order is recorded `paid`; the owner sees it in admin and
	// can re-decrement / resend the email manually if a step failed. This is the
	// deliberate v1 tradeoff (no reservation, non-transactional): a failure may
	// *under*-decrement or skip the email, but stock is never double-decremented.

	// Decrement stock for exactly the lines that were charged (the order snapshot).
	try {
		await deps.stock.decrement(order.items.map((line) => ({ id: line.id, qty: line.qty })));
	} catch (err) {
		console.error(`[fulfillment] stock decrement failed for order ${order.id}:`, err);
	}

	// Confirmation email. Guard on a present email — Stripe virtually always
	// supplies one, but we can't send without it.
	if (input.email) {
		try {
			await deps.mail.send(
				orderConfirmationEmail({
					orderNumber,
					email: input.email,
					lines: order.items,
					itemsTotal: order.items_total,
					shipping: order.shipping_total,
					total: order.total,
					currency: order.currency
				})
			);
		} catch (err) {
			console.error(`[fulfillment] confirmation email failed for order ${order.id}:`, err);
		}
	}

	return { outcome: 'fulfilled', orderNumber };
}
