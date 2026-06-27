/// <reference path="../pb_data/types.d.ts" />

// Weight-based shipping — the `shipping_rates` collection.
// Replaces the old flat `SHIPPING_RATE_CHF` env rate. Each row is a Swiss Post
// price tier: a weight ceiling (`max_weight`, grams), a price (`cost_in_chf`,
// plain CHF), and a delivery tier (`urgency`). At checkout the order's total
// weight (sum of each book's `weight_grams` × qty) selects the cheapest tier
// whose ceiling still covers it, for the urgency the customer chose in the cart.
//
// Read is PUBLIC (listRule/viewRule = ""): the cart page resolves shipping for
// display via the public PocketBase, the same way it lists books. Writes are
// admin-only (null) — only the owner edits the table in the PocketBase admin.
//
// The seeded rows below are PLACEHOLDERS to make checkout work end-to-end; the
// owner should set the real Swiss Post prices in the admin.
//
// This migration also adds `shipping_urgency` to `orders` so the owner can see
// which delivery speed each order was placed with.
migrate(
	(app) => {
		const collection = new Collection({
			type: 'base',
			name: 'shipping_rates',
			listRule: '',
			viewRule: '',
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				// Weight ceiling for this tier, in grams. A tier applies when the
				// order's total weight is at or below this value.
				{ name: 'max_weight', type: 'number', required: true, onlyInt: true, min: 1 },
				// Price for this tier, in plain CHF (decimal allowed — e.g. 8.50).
				{ name: 'cost_in_chf', type: 'number', required: true, min: 0 },
				// Delivery speed. `economy` ≈ 2–3 days, `priority` ≈ next day.
				{
					name: 'urgency',
					type: 'select',
					required: true,
					maxSelect: 1,
					values: ['economy', 'priority']
				},
				{ name: 'created', type: 'autodate', onCreate: true },
				{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
			],
			// One row per (urgency, ceiling) — no duplicate ceilings within a tier.
			indexes: [
				'CREATE UNIQUE INDEX `idx_shipping_rate_tier` ON `shipping_rates` (`urgency`, `max_weight`)'
			]
		});

		app.save(collection);

		// --- seed placeholder tiers (owner edits real prices in admin) ---------
		const seed = (urgency, maxWeight, cost) =>
			app.save(
				new Record(collection, { urgency, max_weight: maxWeight, cost_in_chf: cost })
			);

		// Economy (Swiss Post Economy, ~2–3 days).
		seed('economy', 1000, 6.9);
		seed('economy', 2000, 8.5);
		seed('economy', 10000, 10.5);
		seed('economy', 30000, 21.0);

		// Priority (Swiss Post Priority, ~next day).
		seed('priority', 1000, 8.9);
		seed('priority', 2000, 10.5);
		seed('priority', 10000, 12.5);
		seed('priority', 30000, 23.0);

		// --- record the chosen delivery speed on each order --------------------
		const orders = app.findCollectionByNameOrId('orders');
		orders.fields.add(
			new SelectField({
				name: 'shipping_urgency',
				maxSelect: 1,
				values: ['economy', 'priority']
			})
		);
		app.save(orders);
	},
	(app) => {
		const orders = app.findCollectionByNameOrId('orders');
		orders.fields.removeByName('shipping_urgency');
		app.save(orders);

		const collection = app.findCollectionByNameOrId('shipping_rates');
		app.delete(collection);
	}
);
