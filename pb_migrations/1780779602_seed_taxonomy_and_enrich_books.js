/// <reference path="../pb_data/types.d.ts" />

// Phase 2 — seed the taxonomy lists and enrich the Phase 1 seed books so the
// product detail page renders every field against real data (relations included).
// Spanish content (v1 is Spanish-only). One book ("Donde viven los monstruos")
// stays at stock 0 to exercise the unavailable / disabled-buy path.
migrate(
	(app) => {
		// --- taxonomy ---------------------------------------------------------
		const seedTaxon = (collectionName, name, slug) => {
			const collection = app.findCollectionByNameOrId(collectionName);
			const record = new Record(collection, { name, slug });
			app.save(record);
			return record.id;
		};

		const genre = {
			album: seedTaxon('genres', 'Álbum ilustrado', 'album-ilustrado'),
			cuento: seedTaxon('genres', 'Cuento clásico', 'cuento-clasico')
		};
		const publisher = {
			kalandraka: seedTaxon('publishers', 'Kalandraka', 'kalandraka'),
			alfaguara: seedTaxon('publishers', 'Alfaguara', 'alfaguara'),
			salamandra: seedTaxon('publishers', 'Salamandra', 'salamandra')
		};
		const language = {
			es: seedTaxon('book_languages', 'Español', 'espanol')
		};

		// --- enrich existing seed books --------------------------------------
		const enrich = {
			'la-pequena-oruga-glotona': {
				illustrator: 'Eric Carle',
				ISBN: '9788488342287',
				format: 'Tapa dura',
				page_count: 26,
				book_size: '20 × 14 cm',
				publication_year: 1969,
				age_band: '0-3',
				genre: genre.album,
				publisher: publisher.kalandraka,
				language: language.es
			},
			'donde-viven-los-monstruos': {
				illustrator: 'Maurice Sendak',
				ISBN: '9788491450337',
				format: 'Tapa dura',
				page_count: 48,
				book_size: '24 × 23 cm',
				publication_year: 1963,
				age_band: '3-6',
				genre: genre.album,
				publisher: publisher.alfaguara,
				language: language.es
			},
			'el-principito': {
				illustrator: 'Antoine de Saint-Exupéry',
				ISBN: '9788498381498',
				format: 'Tapa blanda',
				page_count: 96,
				book_size: '20 × 13 cm',
				publication_year: 1943,
				age_band: '9-12',
				genre: genre.cuento,
				publisher: publisher.salamandra,
				language: language.es
			}
		};

		for (const slug of Object.keys(enrich)) {
			const record = app.findFirstRecordByData('books', 'slug', slug);
			const data = enrich[slug];
			for (const key of Object.keys(data)) {
				record.set(key, data[key]);
			}
			app.save(record);
		}
	},
	(app) => {
		// Clear the enriched fields on the seed books...
		const fields = [
			'illustrator',
			'ISBN',
			'format',
			'page_count',
			'book_size',
			'publication_year',
			'age_band',
			'genre',
			'publisher',
			'language'
		];
		for (const slug of ['la-pequena-oruga-glotona', 'donde-viven-los-monstruos', 'el-principito']) {
			try {
				const record = app.findFirstRecordByData('books', 'slug', slug);
				for (const field of fields) {
					record.set(field, field === 'page_count' || field === 'publication_year' ? 0 : '');
				}
				app.save(record);
			} catch {
				// already gone — ignore
			}
		}

		// ...then delete the seeded taxonomy records.
		const taxa = {
			genres: ['album-ilustrado', 'cuento-clasico'],
			publishers: ['kalandraka', 'alfaguara', 'salamandra'],
			book_languages: ['espanol']
		};
		for (const collectionName of Object.keys(taxa)) {
			for (const slug of taxa[collectionName]) {
				try {
					const record = app.findFirstRecordByData(collectionName, 'slug', slug);
					app.delete(record);
				} catch {
					// already gone — ignore
				}
			}
		}
	}
);
