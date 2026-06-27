// Weight-based shipping, the pure core. Lives outside `$lib/server` on purpose:
// both the cart page (client) and the checkout BFF (server) compute the same
// shipping cost from the same rate table, so the logic can't be server-only.
// Framework-free and side-effect-free — unit-testable in plain Node.
//
// The rate table is the admin-editable `shipping_rates` collection: each row is a
// weight ceiling (`max_weight`, grams), a price (`cost_in_chf`), and a delivery
// tier (`urgency`). The cost for an order is the cheapest tier whose ceiling
// still covers the order's total weight.

// Delivery speed the customer picks in the cart. `priority` is next-day (Swiss
// Post Priority), `economy` is 2–3 days (Swiss Post Economy).
export type Urgency = 'economy' | 'priority';

export const URGENCIES: readonly Urgency[] = ['economy', 'priority'];

// Narrow an untrusted value (request body / URL param) to a valid `Urgency`,
// falling back to `economy` — the cheapest, safest default.
export function parseUrgency(value: unknown): Urgency {
	return value === 'priority' ? 'priority' : 'economy';
}

// One row of the shipping rate table, in the units the UI/BFF use directly:
// `maxWeight` in grams, `cost` in plain CHF.
export interface ShippingRate {
	maxWeight: number;
	cost: number;
	urgency: Urgency;
}

// Sum the order's shipping weight: each line's per-book weight times its
// quantity. A book with no weight set contributes 0 (weights come from the
// Shopify import; an unimported book just doesn't add to the total).
export function totalWeightGrams(lines: { weightGrams: number; qty: number }[]): number {
	return lines.reduce((sum, line) => sum + line.weightGrams * line.qty, 0);
}

// Resolve the shipping cost for a given total weight + chosen urgency against the
// rate table. Picks the cheapest tier (smallest `maxWeight`) that still covers
// `grams`. If the order is heavier than every tier, clamps to the heaviest tier
// rather than failing the sale — Swiss Post's hard ceiling is far above any
// realistic book order, and overshooting the table shouldn't block checkout.
//
// Throws if the table has no row for the chosen urgency (a misconfigured /
// unseeded collection) — the caller surfaces that rather than charging 0.
export function shippingCost(grams: number, rates: ShippingRate[], urgency: Urgency): number {
	const tiers = rates
		.filter((rate) => rate.urgency === urgency)
		.sort((a, b) => a.maxWeight - b.maxWeight);

	if (tiers.length === 0) {
		throw new Error(`No shipping rates configured for urgency "${urgency}"`);
	}

	const covering = tiers.find((tier) => grams <= tier.maxWeight);
	// `covering` is undefined only when over the heaviest ceiling → clamp to it
	// (the last tier, since `tiers` is sorted ascending).
	return (covering ?? tiers[tiers.length - 1]).cost;
}
