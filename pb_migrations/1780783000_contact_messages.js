/// <reference path="../pb_data/types.d.ts" />

// Phase 10 — contact-form messages (backup copy of every submission).
//
// `contact_messages` is FULLY closed (every rule null), same posture as `rsvps`
// and `orders`: the SvelteKit BFF writes a record authenticating as a superuser
// (`createAdminPocketBase`) inside the `/contacto` form action — never the
// browser directly. PocketBase is reachable for the admin UI, so an open
// `createRule` would let anyone POST forged/spam messages straight past the BFF
// (honeypot + rate limit). The owner reads messages in the admin; the stored
// record is reliability insurance so a Resend outage never loses a message.
migrate(
	(app) => {
		const contactMessages = new Collection({
			type: 'base',
			name: 'contact_messages',
			listRule: null,
			viewRule: null,
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				{ name: 'name', type: 'text', required: true, max: 255, presentable: true },
				{ name: 'email', type: 'text', required: true, max: 255 },
				{ name: 'subject', type: 'text', required: true, max: 255, presentable: true },
				{ name: 'message', type: 'text', required: true, max: 5000 },

				{ name: 'created', type: 'autodate', onCreate: true },
				{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
			]
		});
		app.save(contactMessages);
	},
	(app) => {
		app.delete(app.findCollectionByNameOrId('contact_messages'));
	}
);
