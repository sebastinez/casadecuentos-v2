// Weight-based shipping, the pure core. Outside `$lib/server` on purpose: both the
// cart page (client) and the checkout BFF (server) compute the same cost from the
// same rate table. Framework- and side-effect-free, unit-testable in plain Node.
//
// The rate table is the admin-editable `shipping_rates` collection: each row is a
// weight ceiling (`max_weight`, grams), a price (`cost_in_chf`), and a delivery tier
// (`urgency`). An order's cost is the cheapest tier whose ceiling covers its weight.

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

// Sum the order's shipping weight: each line's per-book weight × quantity. A book
// with no weight set contributes 0.
export function totalWeightGrams(lines: { weightGrams: number; qty: number }[]): number {
	return lines.reduce((sum, line) => sum + line.weightGrams * line.qty, 0);
}

// Resolve the shipping cost for a total weight + urgency: the cheapest tier
// (smallest `maxWeight`) that still covers `grams`. Heavier than every tier clamps
// to the heaviest rather than failing the sale. Throws if no row exists for the
// urgency (a misconfigured/unseeded collection) rather than charging 0.
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
