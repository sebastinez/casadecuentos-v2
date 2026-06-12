/// <reference path="../pb_data/types.d.ts" />

// Phase 9 — seed a couple of events so `/eventos` renders against real data and
// the owner has working examples to edit. Spanish content (v1 is Spanish-only).
// One event is in the future (shows in the listing) and one is in the past (to
// demonstrate that the upcoming-only filter auto-hides it). `date`/`time` are
// Europe/Zurich wall-clock text (`YYYY-MM-DD` / `HH:MM`); lat/lng point at real
// Zurich locations so the Leaflet/OSM pin renders.
migrate(
	(app) => {
		const events = app.findCollectionByNameOrId('events');
		const seed = (data) => app.save(new Record(events, data));

		seed({
			title: 'Cuentacuentos de primavera',
			description:
				'<p>Una mañana de cuentos en voz alta para los más pequeños. Trae a tu familia y disfruta de historias en español. Entrada libre.</p>',
			date: '2026-07-05',
			time: '10:30',
			venue_address: 'Casa de Cuentos, Langstrasse 1, 8004 Zürich',
			latitude: 47.3782,
			longitude: 8.5305,
			slug: 'cuentacuentos-de-primavera'
		});

		seed({
			title: 'Taller de ilustración infantil',
			description:
				'<p>Un taller práctico para descubrir el mundo de la ilustración de libros infantiles, guiado por una ilustradora invitada.</p>',
			date: '2026-03-15',
			time: '15:00',
			venue_address: 'Casa de Cuentos, Langstrasse 1, 8004 Zürich',
			latitude: 47.3782,
			longitude: 8.5305,
			slug: 'taller-de-ilustracion-infantil'
		});
	},
	(app) => {
		const slugs = ['cuentacuentos-de-primavera', 'taller-de-ilustracion-infantil'];
		for (const slug of slugs) {
			try {
				app.delete(app.findFirstRecordByData('events', 'slug', slug));
			} catch {
				// already gone — ignore
			}
		}
	}
);
