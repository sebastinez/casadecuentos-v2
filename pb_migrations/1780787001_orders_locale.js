/// <reference path="../pb_data/types.d.ts" />

// Capture the buyer's active locale on the order at checkout creation, so the paid
// webhook can send the order-confirmation email in the language the customer shopped
// in (the webhook runs out-of-band and has no request locale of its own). Stored as a
// plain 2-letter code.
//
// No backfill: an empty `locale` already resolves to Spanish downstream
// (`fulfillment-pb.ts` reads `record.locale || undefined`, `fulfillment.ts` does
// `order.locale ?? DEFAULT_LOCALE`). Re-saving existing rows here would needlessly
// re-run order hooks (e.g. the shipped-tracking email) against already-shipped orders.
migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('orders');
		collection.fields.add(new TextField({ name: 'locale', max: 5 }));
		app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('orders');
		collection.fields.removeByName('locale');
		app.save(collection);
	}
);
