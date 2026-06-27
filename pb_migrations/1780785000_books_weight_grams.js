/// <reference path="../pb_data/types.d.ts" />

// Add `weight_grams` to `books` — the shipping weight per book, in grams.
// Sourced from the Shopify export's "Variant Grams" column. Optional integer:
// existing seed rows have no weight yet, and a later step computes shipping
// cost by total order weight, so a missing value should not block saving.
migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('books');
		collection.fields.add(new NumberField({ name: 'weight_grams', min: 0, onlyInt: true }));
		app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('books');
		collection.fields.removeByName('weight_grams');
		app.save(collection);
	}
);
