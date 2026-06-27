import type Stripe from 'stripe';
import { fulfillCheckout, type CompletedCheckout, type FulfillmentDeps } from './fulfillment';

// The Stripe webhook handler, split from the SvelteKit route so the
// signature/idempotency contract is unit-testable without a real Stripe secret or
// HTTP. The only Stripe-shaped knowledge lives here: verify the event and map a
// `checkout.session.completed` session into the neutral `CompletedCheckout` that
// `fulfillCheckout` consumes. The route is a thin shell.

export interface WebhookDeps {
	// Verify + parse the raw body into a typed event (wraps
	// `stripe.webhooks.constructEvent`, which throws on a missing/forged signature).
	// Injected so tests can supply a fake verifier with no real secret.
	constructEvent(rawBody: string, signature: string | null): Stripe.Event;
	fulfillment: FulfillmentDeps;
}

export interface WebhookResult {
	status: number;
	// Outcome label for the route's log line (omitted for ignored events).
	outcome?: string;
}

// Handle one inbound webhook request, returning the HTTP status the route replies
// with: 400 on signature failure (no ports touched); 200 when handled (fulfilled,
// idempotent skip, unknown order, or an event type we ignore — acknowledging stops
// retries). An unexpected throw from fulfilment propagates so the route returns 500
// and Stripe retries, where the paid latch makes the retry idempotent.
export async function handleStripeWebhook(
	rawBody: string,
	signature: string | null,
	deps: WebhookDeps
): Promise<WebhookResult> {
	let event: Stripe.Event;
	try {
		event = deps.constructEvent(rawBody, signature);
	} catch {
		// Trust boundary: a forged/unsigned POST is rejected before any side effect.
		return { status: 400 };
	}

	if (event.type === 'checkout.session.completed') {
		const session = event.data.object as Stripe.Checkout.Session;
		const input = completedCheckoutFromSession(event.id, session);
		if (!input) {
			// No `orderId` metadata — not one of our sessions. Acknowledge & ignore.
			return { status: 200, outcome: 'ignored_no_order_id' };
		}
		const result = await fulfillCheckout(input, deps.fulfillment);
		return { status: 200, outcome: result.outcome };
	}

	// Any other event type: acknowledge so Stripe doesn't retry; we don't act.
	return { status: 200, outcome: 'ignored_event_type' };
}

// Map a completed Checkout session to the neutral fulfilment input; null when it
// carries no `orderId` (not ours to fulfil). Field paths match `stripe@22`: email
// on `customer_details`, the CH shipping address on
// `collected_information.shipping_details`.
function completedCheckoutFromSession(
	eventId: string,
	session: Stripe.Checkout.Session
): CompletedCheckout | null {
	const orderId = session.metadata?.orderId;
	if (!orderId) return null;

	return {
		orderId,
		eventId,
		email: session.customer_details?.email ?? null,
		shippingAddress: session.collected_information?.shipping_details ?? null
	};
}
