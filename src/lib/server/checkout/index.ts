import type Stripe from 'stripe';
import type PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';
import type { CartItem } from '$lib/cart/cart';
import { getBooksByIds } from '$lib/server/catalog';
import { buildOrder, type CatalogPort } from './order';
import { buildSessionParams } from './stripe-params';

export { CheckoutError } from './order';

// Flat-rate shipping in CHF (PRD: predictable, single rate; Swiss Post only).
// Overridable via env for the owner; defaults to a sane value for local dev.
function shippingRate(): number {
	const raw = env.SHIPPING_RATE_CHF;
	const n = raw ? Number(raw) : NaN;
	return Number.isFinite(n) && n >= 0 ? n : 8;
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
	deps: { pb: PocketBase; stripe: Stripe; origin: string }
): Promise<{ url: string }> {
	const { pb, stripe, origin } = deps;

	const catalog: CatalogPort = { getBooksByIds: (ids) => getBooksByIds(pb, ids) };
	const order = await buildOrder(items, catalog, { shipping: shippingRate() });

	// `pending`: order_number stays unset (assigned at `paid` in Phase 6b); the
	// session id is filled in immediately below once Stripe returns it.
	const record = await pb.collection('orders').create({
		status: 'pending',
		items: order.lines,
		items_total: order.itemsTotal,
		shipping_total: order.shipping,
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
