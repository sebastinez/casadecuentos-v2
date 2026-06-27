/// <reference path="../pb_data/types.d.ts" />

// Seed a couple of `videos` records + one active `live_interview` banner so both the
// card grid and the banner path are verifiable on first boot.
//
// Spanish content (v1 is Spanish-only). The banner is seeded WITHOUT an image
// (unused for `live_interview`) and with a `start` fixed just before now + an
// empty `end`, so it is reliably active and in-window on any boot.
//
// ⚠️ SEED VIDEO IDS ARE PLACEHOLDERS. Thumbnails are HOTLINKED from
// `img.youtube.com/vi/<id>/hqdefault.jpg`, so a non-real id renders a broken /
// gray image. Replace the `video_id` values below (and the banner's `cta_link`)
// with REAL ids from the owner's `casadecuentos-ch` channel before relying on
// the seed. The records are owner-editable in the admin regardless.
//
// (Reminder: JS migrations apply only on `serve` restart, not `migrate up`.)
migrate(
	(app) => {
		// --- videos -----------------------------------------------------------
		const videos = app.findCollectionByNameOrId('videos');
		const seedVideo = (data) => app.save(new Record(videos, data));

		seedVideo({
			video_id: 'PLACEHOLDER1', // TODO: real casadecuentos-ch video id
			title: 'Lectura: La pequeña oruga glotona',
			description: 'Una lectura en voz alta del clásico de Eric Carle.',
			published: '2026-05-01 10:00:00.000Z',
			active: true
		});
		seedVideo({
			video_id: 'PLACEHOLDER2', // TODO: real casadecuentos-ch video id
			title: 'Entrevista con una autora invitada',
			description: 'Conversamos sobre el proceso de crear libros para niños.',
			published: '2026-06-01 10:00:00.000Z',
			active: true
		});

		// --- live-interview banner -------------------------------------------
		// `start` just before "now-ish" with no `end` → always in-window on boot.
		const banners = app.findCollectionByNameOrId('banners');
		app.save(
			new Record(banners, {
				type: 'live_interview',
				title: 'Entrevista en directo con un ilustrador',
				subtitle: 'Acompáñanos este sábado para una charla en vivo sobre ilustración infantil.',
				cta_label: 'Ver en YouTube',
				// TODO: real casadecuentos-ch live/watch URL (absolute).
				cta_link: 'https://www.youtube.com/@casadecuentos-ch',
				start: '2026-06-01 00:00:00.000Z',
				active: true
			})
		);
	},
	(app) => {
		// Remove the seeded videos by video_id and the banner by title.
		for (const id of ['PLACEHOLDER1', 'PLACEHOLDER2']) {
			try {
				app.delete(app.findFirstRecordByData('videos', 'video_id', id));
			} catch {
				// already gone — ignore
			}
		}
		try {
			app.delete(
				app.findFirstRecordByData('banners', 'title', 'Entrevista en directo con un ilustrador')
			);
		} catch {
			// already gone — ignore
		}
	}
);
