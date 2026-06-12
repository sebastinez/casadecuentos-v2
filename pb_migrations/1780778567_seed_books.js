/// <reference path="../pb_data/types.d.ts" />

// Phase 1 — a couple of seed books so `/libros` renders against real data.
// Spanish content (v1 is Spanish-only). One book is out of stock to exercise
// the unavailable path in later phases. No cover files (added via admin).
migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('books');

		const seeds = [
			{
				title: 'La pequeña oruga glotona',
				author: 'Eric Carle',
				slug: 'la-pequena-oruga-glotona',
				description:
					'<p>Un clásico ilustrado sobre una oruga muy hambrienta que come de todo hasta convertirse en una hermosa mariposa.</p>',
				price: 18.9,
				stock: 12
			},
			{
				title: 'Donde viven los monstruos',
				author: 'Maurice Sendak',
				slug: 'donde-viven-los-monstruos',
				description:
					'<p>Max se embarca en una aventura salvaje hasta la isla donde viven los monstruos en este álbum ilustrado imprescindible.</p>',
				price: 21.5,
				stock: 0
			},
			{
				title: 'El principito',
				author: 'Antoine de Saint-Exupéry',
				slug: 'el-principito',
				description:
					'<p>El viaje poético de un pequeño príncipe que descubre el sentido de la amistad, el amor y la pérdida.</p>',
				price: 16.0,
				stock: 30
			}
		];

		for (const data of seeds) {
			const record = new Record(collection, data);
			app.save(record);
		}
	},
	(app) => {
		const slugs = ['la-pequena-oruga-glotona', 'donde-viven-los-monstruos', 'el-principito'];
		for (const slug of slugs) {
			try {
				const record = app.findFirstRecordByData('books', 'slug', slug);
				app.delete(record);
			} catch {
				// already gone — ignore
			}
		}
	}
);
