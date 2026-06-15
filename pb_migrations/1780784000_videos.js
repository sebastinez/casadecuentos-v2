/// <reference path="../pb_data/types.d.ts" />

// Phase: videos — the `videos` collection (the owner's YouTube content, surfaced
// at `/videos` as link-out cards) + extend `banners.type` with a third
// placement `live_interview` for the page's "next live interview" announcement.
//
// `videos` is public-readable (it backs the public `/videos` page); writes are
// superuser-only via the admin, same posture as `books`/`banners`/`events`. The
// owner curates it by hand — one record per video holding the bare YouTube
// `video_id` (no full URLs, so the watch + thumbnail URLs derive trivially in
// `$lib/youtube`). New videos default to hidden (`active = false`) so a
// half-entered record never shows publicly.
//
// Localizable copy (`title`, `description`) lives in unsuffixed base columns
// (Spanish in v1) per the Phase 1 convention; `*_de` is a v2 data-entry task.
//
// For the `live_interview` banner type: `image`/`sort` are unused; the interview
// content maps onto existing fields (`title`/`subtitle` = info, `cta_label`/
// `cta_link` = the watch CTA). Unlike `hero`/`featured`, its `cta_link` holds an
// ABSOLUTE YouTube URL (opened in a new tab) rather than a relative path.
//
// (Reminder: JS migrations apply only on `serve` restart, not `migrate up`.)
migrate(
	(app) => {
		// --- videos collection ------------------------------------------------
		const videos = new Collection({
			type: 'base',
			name: 'videos',
			listRule: '',
			viewRule: '',
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				// The bare YouTube ID only (e.g. `dQw4w9WgXcQ`); never a full URL.
				{ name: 'video_id', type: 'text', required: true, max: 32 },

				// Localizable copy (Spanish base columns; `_de` in v2).
				{ name: 'title', type: 'text', required: true, max: 255, presentable: true },
				{ name: 'description', type: 'text', max: 1000 },

				// Drives ordering (newest first); required so an empty value can't
				// sort unpredictably.
				{ name: 'published', type: 'date', required: true },

				// Default hidden so half-entered records never show publicly.
				{ name: 'active', type: 'bool' },

				{ name: 'created', type: 'autodate', onCreate: true },
				{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
			]
		});
		app.save(videos);

		// --- extend banners.type with `live_interview` ------------------------
		const banners = app.findCollectionByNameOrId('banners');
		const typeField = banners.fields.getByName('type');
		typeField.values = ['hero', 'featured', 'live_interview'];
		app.save(banners);
	},
	(app) => {
		// Revert the banners.type extension, then drop the videos collection.
		const banners = app.findCollectionByNameOrId('banners');
		const typeField = banners.fields.getByName('type');
		typeField.values = ['hero', 'featured'];
		app.save(banners);

		const videos = app.findCollectionByNameOrId('videos');
		app.delete(videos);
	}
);
