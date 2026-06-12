/// <reference path="../pb_data/types.d.ts" />

// Phase 9 — free community events + their RSVPs.
//
// `events` is public-readable (it backs `/eventos` and `/eventos/[slug]`);
// writes are superuser-only via the admin, same posture as `books`/`banners`.
//
// `rsvps` is FULLY closed (every rule null): a reservation is created by the
// SvelteKit BFF authenticating as a superuser (`createAdminPocketBase`) inside
// the `/eventos/[slug]` form action — never by the browser directly. An open
// `createRule` is deliberately avoided for the same reason as `orders`:
// PocketBase is reachable for the admin UI, so a public create rule would let
// anyone POST forged/spam RSVPs straight past the BFF. The owner reads them in
// the admin (no capacity/waitlist in v1).
//
// Date/time model (the load-bearing decision): an event stores `date` as plain
// text `YYYY-MM-DD` and `time` as plain text `HH:MM`, both as Europe/Zurich
// WALL-CLOCK values — NOT a PocketBase `date` (datetime) field. Rationale:
//   - The owner enters the real local day + time with zero UTC mental math (a
//     PB datetime field is stored/shown in UTC in the admin — a footgun for a
//     Swiss operator).
//   - Display is inherently DST-correct: we render the civil date/time as-is,
//     so there is no instant↔timezone conversion to get wrong.
//   - The "hide past events" filter becomes a trivial lexical string compare
//     (`date >= <today-in-Zurich>`), sidestepping the unset-date / `@now`
//     pitfalls the banner schedule window had to dodge (see content.ts).
// Zero-padded formats are enforced by the text `pattern` below so that a
// lexical `sort: 'date,time'` is also chronological (`"09:00"` < `"18:30"`).
//
// Localizable copy (`title`, `description`) lives in unsuffixed base columns
// (Spanish in v1) per the Phase 1 convention; `*_de` is a v2 data-entry task.
migrate(
	(app) => {
		// --- events -----------------------------------------------------------
		const events = new Collection({
			type: 'base',
			name: 'events',
			listRule: '',
			viewRule: '',
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				// Localizable copy (Spanish base columns; `_de` in v2).
				{ name: 'title', type: 'text', required: true, max: 255, presentable: true },
				{ name: 'description', type: 'editor' },

				// Europe/Zurich wall-clock civil date + time as zero-padded text.
				// Patterns enforce `YYYY-MM-DD` / 24h `HH:MM` so lexical sort is
				// chronological and the upcoming-filter string compare is sound.
				{
					name: 'date',
					type: 'text',
					required: true,
					pattern: '^\\d{4}-\\d{2}-\\d{2}$',
					presentable: true
				},
				{ name: 'time', type: 'text', required: true, pattern: '^([01]\\d|2[0-3]):[0-5]\\d$' },

				{ name: 'venue_address', type: 'text', max: 500 },
				// Optional map pin. The detail page hides the map when either is unset.
				{ name: 'latitude', type: 'number' },
				{ name: 'longitude', type: 'number' },

				{ name: 'slug', type: 'text', required: true, max: 255 },

				{ name: 'created', type: 'autodate', onCreate: true },
				{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
			],
			indexes: ['CREATE UNIQUE INDEX `idx_events_slug` ON `events` (`slug`)']
		});
		app.save(events);

		// --- rsvps ------------------------------------------------------------
		const rsvps = new Collection({
			type: 'base',
			name: 'rsvps',
			listRule: null,
			viewRule: null,
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				{
					name: 'event',
					type: 'relation',
					required: true,
					maxSelect: 1,
					collectionId: events.id,
					// Drop an event's RSVPs if the event is deleted — they're meaningless
					// without it and there's no capacity/reporting that needs orphans.
					cascadeDelete: true
				},
				{ name: 'name', type: 'text', required: true, max: 255, presentable: true },
				{ name: 'family_name', type: 'text', required: true, max: 255 },
				{ name: 'email', type: 'text', required: true, max: 255 },
				{ name: 'phone', type: 'text', required: true, max: 50 },

				{ name: 'created', type: 'autodate', onCreate: true },
				{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
			]
		});
		app.save(rsvps);
	},
	(app) => {
		// Drop rsvps first (it relates to events).
		app.delete(app.findCollectionByNameOrId('rsvps'));
		app.delete(app.findCollectionByNameOrId('events'));
	}
);
