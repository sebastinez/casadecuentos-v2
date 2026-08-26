/// <reference path="../pb_data/types.d.ts" />

// Add the child-details block to `rsvps`. The events are children's storytelling
// sessions, so the owner needs to know WHO is actually attending (and how old) to
// pick age-appropriate books — the existing columns only identify the adult who
// booked. Captured on the RSVP form and echoed into both emails (the attendee
// confirmation and the info@ notification).
//
// `child_age` is TEXT, not a number: a family books for siblings ("4 y 7") or
// writes "casi 3", and a strict integer would reject both. Nothing computes on
// it — it's rendered verbatim in the emails and the admin.
//
// `child_name` + `child_age` are required (they're the point of the change);
// `favorite_books` + `comments` are optional prompts, and the form labels them
// as such. Only the BFF writes this collection (every rule is null), so the form
// action's own validation is the real gate — these flags are the backstop.
//
// NOTE: this only enforces on future writes — PocketBase does not retro-validate
// existing rows on collection save, so RSVPs taken before this migration keep
// empty child fields and stay readable in the admin.
//
// (Reminder: JS migrations apply only on `serve` restart, not `migrate up`.)
migrate(
	(app) => {
		const collection = app.findCollectionByNameOrId('rsvps');
		collection.fields.add(new TextField({ name: 'child_name', required: true, max: 255 }));
		collection.fields.add(new TextField({ name: 'child_age', required: true, max: 50 }));
		collection.fields.add(new TextField({ name: 'favorite_books', max: 500 }));
		collection.fields.add(new TextField({ name: 'comments', max: 2000 }));
		app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('rsvps');
		collection.fields.removeByName('child_name');
		collection.fields.removeByName('child_age');
		collection.fields.removeByName('favorite_books');
		collection.fields.removeByName('comments');
		app.save(collection);
	}
);
