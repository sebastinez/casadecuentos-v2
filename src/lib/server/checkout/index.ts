import type Stripe from 'stripe';
import type PocketBase from 'pocketbase';
import type { CartItem } from '$lib/cart/cart';
import { getBooksByIds } from '$lib/server/catalog';
import { shippingCost, type ShippingRate, type Urgency } from '$lib/shipping';
import { buildOrder, type CatalogPort } from './order';
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

// Orchestrates checkout initiation — the integration seam (covered via mocked
// SDK / integration tests, not deep unit tests, per the PRD). The price-integrity
// logic it leans on (`buildOrder`) is the unit-tested part.
//
// Sequence: build the authoritative order → create the `pending` order (cart
// snapshot + totals) → create the Stripe session carrying `metadata.orderId` →
// write the session id back onto the order. The order exists before the redirect
// and the success redirect is never trusted; the Phase 6b webhook is the only
// thing that flips it to `paid`.
export async function startCheckout(
	items: CartItem[],
	urgency: Urgency,
	deps: { pb: PocketBase; stripe: Stripe; origin: string }
): Promise<{ url: string }> {
	const { pb, stripe, origin } = deps;

	const catalog: CatalogPort = { getBooksByIds: (ids) => getBooksByIds(pb, ids) };
	const rates = await loadShippingRates(pb);
	const order = await buildOrder(items, catalog, {
		urgency,
		resolveShipping: (grams) => shippingCost(grams, rates, urgency)
	});

	// `pending`: order_number stays unset (assigned at `paid` in Phase 6b); the
	// session id is filled in immediately below once Stripe returns it.
	const record = await pb.collection('orders').create({
		status: 'pending',
		items: order.lines,
		items_total: order.itemsTotal,
		shipping_total: order.shipping,
		shipping_urgency: order.urgency,
		total: order.total,
		currency: 'CHF',
		carrier: 'Swiss Post'
	});

	const session = await stripe.checkout.sessions.create(
		buildSessionParams({
			order,
			orderId: record.id,
			successUrl: `${origin}/pago/exito?session_id={CHECKOUT_SESSION_ID}`,
			cancelUrl: `${origin}/pago/cancelado`
		})
	);

	await pb.collection('orders').update(record.id, { stripe_session_id: session.id });

	if (!session.url) {
		throw new Error('Stripe Checkout session returned no redirect URL.');
	}
	return { url: session.url };
}
