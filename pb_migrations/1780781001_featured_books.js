/// <reference path="../pb_data/types.d.ts" />

// Phase 8 — the `featured_books` curated join.
// A tiny join collection (relation to a book + explicit `sort` + `active`) that
// lets the owner hand-curate the landing-page "featured books" strip in a
// deliberate order — independent of the catalog's own newest/price sorting.
//
// `book` cascadeDeletes: a featured entry is meaningless once its book is gone,
// so deleting a book removes its curation row (vs. leaving a dangling relation).
// Public list/view (backs the public strip); writes are superuser-only.
migrate(
	(app) => {
		const books = app.findCollectionByNameOrId('books');

		const collection = new Collection({
			type: 'base',
			name: 'featured_books',
			listRule: '',
			viewRule: '',
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				{
					name: 'book',
					type: 'relation',
					required: true,
					collectionId: books.id,
					maxSelect: 1,
					cascadeDelete: true
				},
				{ name: 'sort', type: 'number', onlyInt: true },
				{ name: 'active', type: 'bool' },
				{ name: 'created', type: 'autodate', onCreate: true },
				{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
			]
		});

		app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('featured_books');
		app.delete(collection);
	}
);
