/// <reference path="../pb_data/types.d.ts" />

// Phase 6a — the `orders` collection.
// An order is created as `pending` (a cart snapshot + Stripe session id) before
// the redirect to hosted Stripe Checkout. The signature-verified Stripe webhook
// (Phase 6b) is the only thing that flips it to `paid` — the success redirect is
// never trusted. Lifecycle: `pending → paid → shipped`.
//
// Access rules are all superuser-only (null). Orders are created and updated
// solely by the SvelteKit BFF authenticating as a superuser (`createAdminPocketBase`)
// and read by the owner in the PocketBase admin. A public `createRule` is
// deliberately avoided: PocketBase is reachable for the admin UI, and an open
// create rule would let anyone POST forged orders straight past the BFF.
migrate(
	(app) => {
		const collection = new Collection({
			type: 'base',
			name: 'orders',
			listRule: null,
			viewRule: null,
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				// Human-readable incremental order number, surfaced in emails. Left
				// UNSET (0) at `pending`: most pending orders are abandoned, so the
				// customer-facing sequence is assigned at the `paid` transition
				// (Phase 6b) to avoid gaps and a max+1 race in the checkout hot path.
				{ name: 'order_number', type: 'number', onlyInt: true, min: 0 },

				// Lifecycle state. Single-select enum; the BFF/webhook drive transitions.
				{
					name: 'status',
					type: 'select',
					required: true,
					maxSelect: 1,
					values: ['pending', 'paid', 'shipped']
				},

				// Cart snapshot at session creation: the lines (id, title, unit price,
				// qty, line total) and the totals as they were when the customer paid.
				// Prices are server-authoritative (read from PocketBase, never the
				// browser) — this is the record of what was actually charged.
				{ name: 'items', type: 'json' },
				{ name: 'items_total', type: 'number', min: 0 },
				{ name: 'shipping_total', type: 'number', min: 0 },
				{ name: 'total', type: 'number', min: 0 },
				// Tax-inclusive plain CHF (not VAT-registered, books-only).
				{ name: 'currency', type: 'text', max: 8 },

				// Shipping address + customer email arrive from Stripe on the `paid`
				// webhook (Stripe collects the CH address); empty at `pending`.
				{ name: 'shipping_address', type: 'json' },
				{ name: 'email', type: 'text', max: 255 },

				// Stripe correlation. `stripe_session_id` is set right after the session
				// is created (the order is created first, then updated). `stripe_event_id`
				// is recorded by the Phase 6b webhook for idempotent dedupe.
				{ name: 'stripe_session_id', type: 'text', max: 255 },
				{ name: 'stripe_event_id', type: 'text', max: 255 },

				// Fulfilment (Phase 7). Swiss Post only in v1.
				{ name: 'carrier', type: 'text', max: 100 },
				{ name: 'tracking_number', type: 'text', max: 255 },

				{ name: 'created', type: 'autodate', onCreate: true },
				{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
			],
			// PARTIAL unique indexes: PocketBase stores an unset number/text as 0/''
			// (not distinct NULLs), so a plain unique index would collide across the
			// many unpopulated `pending` rows. The `WHERE` clause excludes the
			// unpopulated state so uniqueness only applies once a value exists.
			indexes: [
				'CREATE UNIQUE INDEX `idx_orders_number` ON `orders` (`order_number`) WHERE `order_number` > 0',
				"CREATE UNIQUE INDEX `idx_orders_session` ON `orders` (`stripe_session_id`) WHERE `stripe_session_id` != ''"
			]
		});

		app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('orders');
		app.delete(collection);
	}
);
