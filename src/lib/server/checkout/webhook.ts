import type Stripe from 'stripe';
import { fulfillCheckout, type CompletedCheckout, type FulfillmentDeps } from './fulfillment';

// The Stripe webhook handler, split from the SvelteKit route so the
// signature/idempotency contract is unit-testable without a real Stripe secret
// or HTTP. The route (`/api/webhooks/stripe/+server.ts`) is a thin shell: read
// the raw body + signature, build deps, call here, return the status.
//
// This is where the only Stripe-shaped knowledge lives — verifying the event and
// mapping a `checkout.session.completed` session into the provider-neutral
// `CompletedCheckout` that `fulfillCheckout` consumes.

export interface WebhookDeps {
	// Verify + parse the raw request body into a typed event. Wraps
	// `stripe.webhooks.constructEvent(rawBody, signature, secret)`, which throws
	// on a missing/forged signature. Injected so tests can supply a fake verifier
	// (one that throws for the invalid-signature case, one that returns a crafted
	// event for the valid case) with no real secret.
	constructEvent(rawBody: string, signature: string | null): Stripe.Event;
	fulfillment: FulfillmentDeps;
}

export interface WebhookResult {
	status: number;
	// Outcome label for the route's log line (omitted for ignored events).
	outcome?: string;
}

// Handle one inbound webhook request. Returns the HTTP status the route should
// reply with:
//   400  — signature verification failed (forged/invalid). No ports touched.
//   200  — handled (fulfilled, idempotent skip, unknown order, or an event type
//          we don't act on). Acknowledging stops Stripe retrying.
// An unexpected throw from fulfilment (a real PocketBase/mail fault) is *not*
// caught here — it propagates so the route returns 500 and Stripe retries, at
// which point the paid latch makes the retry idempotent.
export async function handleStripeWebhook(
	rawBody: string,
	signature: string | null,
	deps: WebhookDeps
): Promise<WebhookResult> {
	let event: Stripe.Event;
	try {
		event = deps.constructEvent(rawBody, signature);
	} catch {
		// Forged or malformed — reject before any side effect. This is the trust
		// boundary: an unsigned POST never reaches fulfilment.
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

// Map a completed Checkout session to the neutral fulfilment input. Returns null
// when the session carries no `orderId` (so it isn't ours to fulfil). Reads the
// customer email and the Stripe-collected CH shipping details (recipient name +
// address) so the owner has what they need to ship. Field paths match
// `stripe@22`: email lives on `customer_details`, the address on
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
