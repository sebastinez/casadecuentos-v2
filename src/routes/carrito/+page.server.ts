import type { PageServerLoad } from './$types';
import { createPocketBase } from '$lib/server/pocketbase';
import type { ShippingRate, Urgency } from '$lib/shipping';

// The cart itself is client-only (localStorage), but the shipping rate table is
// public config, so it's loaded once here on page load and handed to the cart
// page. The page recomputes the shipping cost client-side as the customer toggles
// urgency / changes quantities — no round-trip per change. `createPocketBase` is
// the public (non-admin) client; `shipping_rates` is publicly listable.
export const load: PageServerLoad = async () => {
	const pb = createPocketBase();
	const rows = await pb
		.collection('shipping_rates')
		.getFullList<{ max_weight: number; cost_in_chf: number; urgency: Urgency }>({
			sort: 'urgency,max_weight'
		});

	const shippingRates: ShippingRate[] = rows.map((r) => ({
		maxWeight: r.max_weight,
		cost: r.cost_in_chf,
		urgency: r.urgency
	}));

	return { shippingRates };
};
