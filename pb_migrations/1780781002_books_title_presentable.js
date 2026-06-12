/// <reference path="../pb_data/types.d.ts" />

// Phase 8 — make `books.title` presentable.
// The `featured_books.book` relation picker (and any future book relation) shows
// the `presentable` field as each option's label. Without this, the owner curates
// the featured strip against opaque record IDs. The taxonomy collections already
// set `name` presentable for exactly this reason; `books` had none. Pure metadata
// flip — no data change.
migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('books');
		const field = collection.fields.getByName('title');
		field.presentable = true;
		app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('books');
		const field = collection.fields.getByName('title');
		field.presentable = false;
		app.save(collection);
	}
);
