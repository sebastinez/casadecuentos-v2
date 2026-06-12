/// <reference path="../pb_data/types.d.ts" />

// Phase 8 — seed banners + featured-books curation so `/` renders against real
// data (and the owner has working examples to edit). Spanish content (v1 is
// Spanish-only). Banners are seeded WITHOUT images: migrations can't attach file
// uploads, and the landing page renders a gradient fallback when `image` is
// empty, so text-only seeds still display. The owner adds images in the admin.
//
// `featured_books` points at the three Phase 1/2 seed books in a deliberate
// order. CTA links target real listing filters (Phase 3).
migrate(
	(app) => {
		// --- banners ----------------------------------------------------------
		const banners = app.findCollectionByNameOrId('banners');
		const seedBanner = (data) => app.save(new Record(banners, data));

		seedBanner({
			type: 'hero',
			title: 'Cuentos que abren mundos',
			subtitle: 'Libros infantiles y juveniles en español, enviados a toda Suiza.',
			cta_label: 'Explorar libros',
			cta_link: '/libros',
			sort: 1,
			active: true
		});
		seedBanner({
			type: 'hero',
			title: 'Novedades de la temporada',
			subtitle: 'Descubre nuestras últimas llegadas.',
			cta_label: 'Ver novedades',
			cta_link: '/libros?sort=newest',
			sort: 2,
			active: true
		});
		seedBanner({
			type: 'featured',
			title: 'Para los más pequeños',
			subtitle: 'Primeras lecturas de 0 a 3 años.',
			cta_label: 'Ver colección',
			cta_link: '/libros?age=0-3',
			sort: 1,
			active: true
		});
		seedBanner({
			type: 'featured',
			title: 'Álbumes ilustrados',
			subtitle: 'Historias que perduran, ilustración que enamora.',
			cta_label: 'Descubrir',
			cta_link: '/libros?genre=album-ilustrado',
			sort: 2,
			active: true
		});

		// --- featured-books curation -----------------------------------------
		const featured = app.findCollectionByNameOrId('featured_books');
		const slugs = ['la-pequena-oruga-glotona', 'donde-viven-los-monstruos', 'el-principito'];
		slugs.forEach((slug, i) => {
			const book = app.findFirstRecordByData('books', 'slug', slug);
			app.save(new Record(featured, { book: book.id, sort: i + 1, active: true }));
		});
	},
	(app) => {
		// Remove the seeded banners by title.
		const titles = [
			'Cuentos que abren mundos',
			'Novedades de la temporada',
			'Para los más pequeños',
			'Álbumes ilustrados'
		];
		for (const title of titles) {
			try {
				app.delete(app.findFirstRecordByData('banners', 'title', title));
			} catch {
				// already gone — ignore
			}
		}

		// Remove the seeded featured-books rows (those pointing at the seed books).
		const slugs = ['la-pequena-oruga-glotona', 'donde-viven-los-monstruos', 'el-principito'];
		for (const slug of slugs) {
			try {
				const book = app.findFirstRecordByData('books', 'slug', slug);
				const rows = app.findRecordsByFilter('featured_books', `book = "${book.id}"`);
				for (const row of rows) {
					app.delete(row);
				}
			} catch {
				// already gone — ignore
			}
		}
	}
);
