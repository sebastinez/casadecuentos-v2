import type Stripe from 'stripe';
import type { BuiltOrder } from './order';

// Pure mapping from a validated `BuiltOrder` to the params for a hosted Stripe
// Checkout session. No SDK call happens here (the type import is erased at
// runtime), so the money-critical conversion is unit-testable without Stripe.
// The endpoint passes the result straight to `stripe.checkout.sessions.create`.

// CHF prices are decimal (e.g. 24.90); Stripe wants an integer minor unit
// (rappen). Round rather than truncate — float math makes 24.90 * 100 land at
// 2489.9999…, which `Math.trunc` would wrongly drop to 2489.
export function toMinorUnits(chf: number): number {
	return Math.round(chf * 100);
}

const CURRENCY = 'chf';

export interface SessionParamOptions {
	order: BuiltOrder;
	// Opaque id of the `pending` order, echoed back on the webhook to correlate
	// the payment with our order (Phase 6b reads it from `metadata`).
	orderId: string;
	successUrl: string;
	cancelUrl: string;
}

export function buildSessionParams({
	order,
	orderId,
	successUrl,
	cancelUrl
}: SessionParamOptions): Stripe.Checkout.SessionCreateParams {
	const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.lines.map((line) => ({
		quantity: line.qty,
		price_data: {
			currency: CURRENCY,
			unit_amount: toMinorUnits(line.unitPrice),
			product_data: { name: line.title }
		}
	}));

	return {
		mode: 'payment',
		// Spanish hosted checkout (PRD: checkout UI in Spanish).
		locale: 'es',
		// TWINT + cards; Apple/Google Pay ride on `card` where the device supports
		// it. No tax handling (not VAT-registered, books-only).
		payment_method_types: ['card', 'twint'],
		line_items: lineItems,
		// Flat-rate shipping as a Stripe shipping option (single, fixed CHF amount).
		shipping_options: [
			{
				shipping_rate_data: {
					type: 'fixed_amount',
					display_name: 'Envío',
					fixed_amount: {
						currency: CURRENCY,
						amount: toMinorUnits(order.shipping)
					}
				}
			}
		],
		// Stripe collects the shipping address, restricted to Switzerland.
		shipping_address_collection: { allowed_countries: ['CH'] },
		success_url: successUrl,
		cancel_url: cancelUrl,
		// Correlate the eventual `checkout.session.completed` event back to our
		// `pending` order (the success redirect is never trusted for fulfilment).
		metadata: { orderId }
	};
}
