import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAdminPocketBase } from '$lib/server/pocketbase';
import { createStripe } from '$lib/server/checkout/stripe-client';
import { startCheckout, CheckoutError } from '$lib/server/checkout';
import { parseCart } from '$lib/cart/cart';
import { parseUrgency } from '$lib/shipping';
import { parseShippingAddress, validateShippingAddress } from '$lib/shipping-address';

// Initiates checkout: takes the cart's book ids + quantities, builds a server-
// authoritative order, creates a `pending` order + Stripe session, and returns
// the hosted Checkout URL for the browser to redirect to. The browser still
// never talks to Stripe or PocketBase directly — this BFF endpoint does.
//
// Price integrity: the request body is sanitized through `parseCart` (the same
// trust boundary the cart uses for localStorage), so any price/title a client
// tries to send is structurally stripped to `{ id, qty }` before the order is
// built. Authoritative price + stock are read from PocketBase.
//
// Address integrity: the delivery address is collected in our own cart, so this
// endpoint — not Stripe — is where it is validated. The browser runs the same
// pure rules for live feedback; this check is the one that counts.
export const POST: RequestHandler = async ({ request, url, locals }) => {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'invalid_body');
	}

	// `parseCart` expects the serialized array shape the cart stores; round-trip
	// the posted items through it so only valid `{ id, qty }` entries survive.
	const items = parseCart(JSON.stringify((body as { items?: unknown })?.items ?? []));
	// Delivery speed the customer chose in the cart; anything unexpected falls
	// back to the cheapest tier (`economy`). The cost is recomputed here from the
	// authoritative rate table — the client only chooses the tier, never the price.
	const urgency = parseUrgency((body as { urgency?: unknown })?.urgency);
	// The delivery address, trimmed and re-validated server-side. A client that
	// skips or fakes the form gets the offending field names back, so the cart can
	// mark exactly the inputs that need fixing.
	const shippingAddress = parseShippingAddress((body as { address?: unknown })?.address);
	const invalidFields = validateShippingAddress(shippingAddress);
	if (invalidFields.length > 0) {
		throw error(400, { message: 'invalid_address', fields: invalidFields } as App.Error);
	}

	const pb = await createAdminPocketBase();
	const stripe = createStripe();

	try {
		const { url: checkoutUrl } = await startCheckout(
			items,
			{ urgency, shippingAddress },
			{
				pb,
				stripe,
				origin: url.origin,
				locale: locals.locale
			}
		);
		return json({ url: checkoutUrl });
	} catch (err) {
		// Expected, customer-facing failures: surface the code + offending ids so
		// the cart can name the problem line. Anything else is a real fault → 500.
		if (err instanceof CheckoutError) {
			throw error(400, { message: err.code, bookIds: err.bookIds } as App.Error);
		}
		throw err;
	}
};
