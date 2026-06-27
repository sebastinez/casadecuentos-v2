import type Stripe from 'stripe';
import type { BuiltOrder } from './order';

// Pure mapping from a validated `BuiltOrder` to the params for a hosted Stripe
// Checkout session. No SDK call here, so the money-critical conversion is
// unit-testable without Stripe.

// CHF prices are decimal (e.g. 24.90); Stripe wants integer minor units (rappen).
// Round, not truncate — float math makes 24.90 * 100 land at 2489.9999…, which
// `Math.trunc` would wrongly drop to 2489.
export function toMinorUnits(chf: number): number {
	return Math.round(chf * 100);
}

const CURRENCY = 'chf';

export interface SessionParamOptions {
	order: BuiltOrder;
	// Opaque id of the `pending` order, echoed back on the webhook (via `metadata`)
	// to correlate the payment with our order.
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
		// Spanish hosted checkout.
		locale: 'es',
		// TWINT + cards; Apple/Google Pay ride on `card`. No tax (not VAT-registered,
		// books-only).
		payment_method_types: ['card', 'twint'],
		line_items: lineItems,
		// Weight-based shipping as a single fixed option — the cost + delivery speed
		// were already chosen in our cart, so Stripe just displays the resolved amount.
		shipping_options: [
			{
				shipping_rate_data: {
					type: 'fixed_amount',
					display_name: order.urgency === 'priority' ? 'Envío prioritario' : 'Envío económico',
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
		// Correlate the `checkout.session.completed` event back to our `pending` order.
		metadata: { orderId }
	};
}
