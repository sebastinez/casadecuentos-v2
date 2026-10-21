import type Stripe from 'stripe';
import { DEFAULT_LOCALE, type Locale } from '$lib/i18n';
import type { ShippingAddress } from '$lib/shipping-address';
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
	// The delivery address our own cart collected and validated. Handed to Stripe
	// as the PaymentIntent's shipping so the payment record carries the same
	// address the parcel does (visible in the dashboard, on the receipt, and to
	// Radar) — Stripe never asks the customer for it.
	shippingAddress: ShippingAddress;
	successUrl: string;
	cancelUrl: string;
	// The buyer's active locale → Stripe's hosted-checkout language. Stripe accepts
	// both `es` and `de`.
	locale?: Locale;
}

export function buildSessionParams({
	order,
	orderId,
	shippingAddress,
	successUrl,
	cancelUrl,
	locale = DEFAULT_LOCALE
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
		// Hosted checkout in the buyer's language.
		locale,
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
		// No `shipping_address_collection`: the address is collected and validated in
		// our cart *before* payment, so Stripe has nothing to ask. It travels on the
		// PaymentIntent instead. `line2` is omitted rather than sent empty.
		payment_intent_data: {
			shipping: {
				name: shippingAddress.name,
				address: {
					line1: shippingAddress.line1,
					...(shippingAddress.line2 ? { line2: shippingAddress.line2 } : {}),
					postal_code: shippingAddress.postalCode,
					city: shippingAddress.city,
					country: shippingAddress.country
				}
			}
		},
		success_url: successUrl,
		cancel_url: cancelUrl,
		// Correlate the `checkout.session.completed` event back to our `pending` order.
		metadata: { orderId }
	};
}
