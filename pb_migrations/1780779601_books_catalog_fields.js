/// <reference path="../pb_data/types.d.ts" />

// Phase 2 — grow `books` from the Phase 1 skeleton into the full catalog model.
// Adds the remaining intrinsic bibliographic fields, the optional image gallery,
// the `age_band` enum, and the three taxonomy relations (genre/publisher/
// language → the collections created in the previous migration).
//
// All new columns are OPTIONAL on purpose: the Phase 1 seed records have no
// taxonomy yet, and the next migration re-saves them to populate values. A
// required relation would make those existing rows invalid. Tighten later if a
// hard constraint is ever wanted; nothing in v1 needs DB-level required here.
migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('books');

		const genres = app.findCollectionByNameOrId('genres');
		const publishers = app.findCollectionByNameOrId('publishers');
		const bookLanguages = app.findCollectionByNameOrId('book_languages');

		// Intrinsic bibliographic metadata (never translated — the real edition).
		collection.fields.add(new TextField({ name: 'illustrator', max: 255 }));
		// ISBN: optional, non-unique text. Not every record has one, and we don't
		// want a unique constraint blocking entry of multi-edition stock.
		collection.fields.add(new TextField({ name: 'ISBN', max: 32 }));
		collection.fields.add(new TextField({ name: 'format', max: 100 }));
		collection.fields.add(new NumberField({ name: 'page_count', min: 0, onlyInt: true }));
		collection.fields.add(new TextField({ name: 'book_size', max: 100 }));
		collection.fields.add(new NumberField({ name: 'publication_year', min: 0, onlyInt: true }));

		// Optional secondary images alongside the single `cover` from Phase 1.
		collection.fields.add(
			new FileField({
				name: 'gallery',
				maxSelect: 8,
				maxSize: 5242880,
				mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
			})
		);

		// Age band: structured single-select enum (PRD bands).
		collection.fields.add(
			new SelectField({
				name: 'age_band',
				maxSelect: 1,
				values: ['0-3', '3-6', '6-9', '9-12', '12+']
			})
		);

		// Taxonomy relations (single, optional). cascadeDelete:false so deleting a
		// genre/publisher/language never deletes books — it just clears the link.
		collection.fields.add(
			new RelationField({
				name: 'genre',
				collectionId: genres.id,
				maxSelect: 1,
				cascadeDelete: false
			})
		);
		collection.fields.add(
			new RelationField({
				name: 'publisher',
				collectionId: publishers.id,
				maxSelect: 1,
				cascadeDelete: false
			})
		);
		collection.fields.add(
			new RelationField({
				name: 'language',
				collectionId: bookLanguages.id,
				maxSelect: 1,
				cascadeDelete: false
			})
		);

		app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('books');
		for (const name of [
			'illustrator',
			'ISBN',
			'format',
			'page_count',
			'book_size',
			'publication_year',
			'gallery',
			'age_band',
			'genre',
			'publisher',
			'language'
		]) {
			collection.fields.removeByName(name);
		}
		app.save(collection);
	}
);
