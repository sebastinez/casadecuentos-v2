import type { RequestHandler } from './$types';
import { createAdminPocketBase } from '$lib/server/pocketbase';
import { createStripe, stripeWebhookSecret } from '$lib/server/checkout/stripe-client';
import { handleStripeWebhook } from '$lib/server/checkout/webhook';
import { createOrdersPort, createStockPort } from '$lib/server/checkout/fulfillment-pb';
import { createMailTransport } from '$lib/server/mail';

// The Stripe payment webhook — the *only* source of truth that flips an order to
// `paid`. The success redirect is never trusted. This route is a thin shell: it
// reads the raw body + signature and hands them to `handleStripeWebhook`, which
// verifies the signature and (on `checkout.session.completed`) runs idempotent
// fulfilment. All logic + the signature/idempotency contract live in
// `webhook.ts`/`fulfillment.ts` and are unit-tested there.
//
// Local dev: forward events with
//   stripe listen --forward-to localhost:5173/api/webhooks/stripe
// and set STRIPE_WEBHOOK_SECRET to the `whsec_…` it prints.
export const POST: RequestHandler = async ({ request }) => {
	// Signature verification needs the *exact* bytes Stripe signed — read the raw
	// body as text and never parse it first. `request.json()` here would silently
	// break verification on every event.
	const rawBody = await request.text();
	const signature = request.headers.get('stripe-signature');

	const stripe = createStripe();
	const secret = stripeWebhookSecret();
	const pb = await createAdminPocketBase();

	const { status } = await handleStripeWebhook(rawBody, signature, {
		constructEvent: (body, sig) => stripe.webhooks.constructEvent(body, sig ?? '', secret),
		fulfillment: {
			orders: createOrdersPort(pb),
			stock: createStockPort(pb),
			mail: createMailTransport()
		}
	});

	// 400 → forged/invalid signature; 200 → handled (fulfilled, idempotent skip,
	// or ignored). An unexpected fulfilment fault propagates as a 500 so Stripe
	// retries; the paid latch makes that retry idempotent.
	return new Response(null, { status });
};
