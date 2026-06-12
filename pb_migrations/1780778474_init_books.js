/// <reference path="../pb_data/types.d.ts" />

// Phase 1 — minimal `books` collection (walking skeleton).
// Intentionally narrow: only the fields the listing skeleton needs. The full
// catalog model (genres/publishers/book_languages relations, age_band, gallery,
// etc.) lands in Phase 2. The store's own blurb lives in the unsuffixed
// `description` column — Spanish is the base; German becomes `description_de`
// in v2 (the Spanish-fallback convention; no `*_de` columns pre-created).
migrate(
	(app) => {
		const collection = new Collection({
			type: 'base',
			name: 'books',
			// Public catalog: anyone can list/view. Writes are superuser-only
			// (null rule) via the PocketBase admin.
			listRule: '',
			viewRule: '',
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				{ name: 'title', type: 'text', required: true, max: 255 },
				{ name: 'author', type: 'text', max: 255 },
				{ name: 'slug', type: 'text', required: true, max: 255 },
				// Localizable Spanish blurb (base column; Spanish fallback target).
				{ name: 'description', type: 'editor' },
				// CHF, tax-inclusive. Decimals allowed (e.g. 24.90).
				{ name: 'price', type: 'number', required: true, min: 0 },
				// Not `required`: PocketBase treats 0 as blank, and 0 (out of stock)
				// is a valid value. Defaults to 0.
				{ name: 'stock', type: 'number', min: 0, onlyInt: true },
				{
					name: 'cover',
					type: 'file',
					maxSelect: 1,
					maxSize: 5242880,
					mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
				},
				{ name: 'created', type: 'autodate', onCreate: true },
				{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
			],
			indexes: ['CREATE UNIQUE INDEX `idx_books_slug` ON `books` (`slug`)']
		});

		app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('books');
		app.delete(collection);
	}
);
