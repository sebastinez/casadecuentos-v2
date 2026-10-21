import type Stripe from 'stripe';
import type PocketBase from 'pocketbase';
import type { CartItem } from '$lib/cart/cart';
import { getBooksByIds } from '$lib/server/catalog';
import { shippingCost, type ShippingRate, type Urgency } from '$lib/shipping';
import { isCompleteShippingAddress, type ShippingAddress } from '$lib/shipping-address';
import { DEFAULT_LOCALE, type Locale } from '$lib/i18n';
import { buildOrder, CheckoutError, type CatalogPort } from './order';
import { buildSessionParams } from './stripe-params';

export { CheckoutError } from './order';

// Read the admin-editable `shipping_rates` table and project it to the pure
// `ShippingRate` shape (grams + plain CHF) the cost calculator consumes.
async function loadShippingRates(pb: PocketBase): Promise<ShippingRate[]> {
	const rows = await pb
		.collection('shipping_rates')
		.getFullList<{ max_weight: number; cost_in_chf: number; urgency: Urgency }>();
	return rows.map((r) => ({ maxWeight: r.max_weight, cost: r.cost_in_chf, urgency: r.urgency }));
}

// What the customer chose in the cart: the delivery tier and where the parcel
// goes. Both are *choices*, never prices — the cost is recomputed server-side.
export interface CheckoutChoices {
	urgency: Urgency;
	shippingAddress: ShippingAddress;
}

// Orchestrates checkout initiation. Sequence: validate the address → build the
// authoritative order → create the `pending` order (cart snapshot + totals +
// address) → create the Stripe session carrying `metadata.orderId` → write the
// session id back onto the order. The order exists before the redirect and the
// success redirect is never trusted; the webhook is the only thing that flips it
// to `paid`.
export async function startCheckout(
	items: CartItem[],
	choices: CheckoutChoices,
	deps: { pb: PocketBase; stripe: Stripe; origin: string; locale?: Locale }
): Promise<{ url: string }> {
	const { urgency, shippingAddress } = choices;
	const { pb, stripe, origin, locale = DEFAULT_LOCALE } = deps;

	// The invariant this seam owns: no order is ever created — and nobody ever
	// reaches Stripe — without an address we can actually ship to. The endpoint
	// validates first and names the offending fields; this is the backstop that
	// holds for any future caller.
	if (!isCompleteShippingAddress(shippingAddress)) {
		throw new CheckoutError('invalid_address');
	}

	const catalog: CatalogPort = { getBooksByIds: (ids) => getBooksByIds(pb, ids) };
	const rates = await loadShippingRates(pb);
	const order = await buildOrder(items, catalog, {
		urgency,
		resolveShipping: (grams) => shippingCost(grams, rates, urgency)
	});

	// `pending`: order_number stays unset (assigned at `paid`); the session id is
	// filled in immediately below once Stripe returns it. The address is written
	// here, at creation — it is ours, not something the webhook learns from Stripe.
	const record = await pb.collection('orders').create({
		status: 'pending',
		items: order.lines,
		items_total: order.itemsTotal,
		shipping_total: order.shipping,
		shipping_urgency: order.urgency,
		shipping_address: shippingAddress,
		total: order.total,
		currency: 'CHF',
		carrier: 'Swiss Post',
		// Remembered so the paid webhook emails the confirmation in the buyer's language.
		locale
	});

	const session = await stripe.checkout.sessions.create(
		buildSessionParams({
			order,
			orderId: record.id,
			shippingAddress,
			successUrl: `${origin}/pago/exito?session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${origin}/pago/cancelado`,
			locale
		})
	);

	await pb.collection('orders').update(record.id, { stripe_session_id: session.id });

	if (!session.url) {
		throw new Error('Stripe Checkout session returned no redirect URL.');
	}
	return { url: session.url };
}
