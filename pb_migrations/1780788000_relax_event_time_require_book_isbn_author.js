/// <reference path="../pb_data/types.d.ts" />

// Two unrelated schema tweaks bundled by timestamp:
//
// 1) `events.time` — drop the strict `HH:MM` pattern.
//    The original migration (1780782000) constrained `time` to a single 24h
//    `HH:MM` so a lexical `sort: 'date,time'` doubled as a chronological sort.
//    In practice events run in ranges/multiple blocks — e.g.
//    "09:30 - 11:00 & 17:30 - 20:00" — which the pattern rejected. We relax it
//    to free text (still required). Consequence: the secondary `time` sort is no
//    longer guaranteed chronological within a day, but `date` still orders days
//    correctly and nothing parses `time` — it's rendered verbatim (events.ts).
//
// 2) `books.author` and `books.ISBN` — make both required.
//    Both were optional (author from the skeleton, ISBN from the catalog-fields
//    migration, which deliberately left everything optional while seeds were
//    backfilled). The catalog is now fully enriched, so these become hard
//    constraints. NOTE: this only enforces on future writes — PocketBase does
//    not retro-validate existing rows on collection save. Confirm every current
//    book has an author + ISBN before applying, or those records will fail to
//    save on the next admin edit.
migrate(
	(app) => {
		// --- 1) events.time: remove pattern ----------------------------------
		const events = app.findCollectionByNameOrId('events');
		const time = events.fields.getByName('time');
		time.pattern = '';
		app.save(events);

		// --- 2) books.author + books.ISBN: required --------------------------
		const books = app.findCollectionByNameOrId('books');
		books.fields.getByName('author').required = true;
		books.fields.getByName('ISBN').required = true;
		app.save(books);
	},
	(app) => {
		// Restore the strict HH:MM pattern on events.time.
		const events = app.findCollectionByNameOrId('events');
		events.fields.getByName('time').pattern = '^([01]\\d|2[0-3]):[0-5]\\d$';
		app.save(events);

		// Restore author/ISBN to optional.
		const books = app.findCollectionByNameOrId('books');
		books.fields.getByName('author').required = false;
		books.fields.getByName('ISBN').required = false;
		app.save(books);
	}
);
