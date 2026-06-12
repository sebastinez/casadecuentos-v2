/// <reference path="../pb_data/types.d.ts" />

// Phase 8 — the `banners` collection (landing-page hero carousel + featured
// promo strips). One collection drives both placements, distinguished by `type`
// (`hero` | `featured`). The owner manages these in the PocketBase admin: text,
// image, CTA, sort order, an active flag, and an optional schedule window for
// timed promotions.
//
// Localizable text lives in unsuffixed base columns (Spanish in v1) following
// the Phase 1 localized-field convention — `title_de` / `subtitle_de` /
// `cta_label_de` become a v2 data-entry task; no `*_de` columns are pre-created.
// Bibliographic intrinsics don't apply here, so every text field is localizable.
//
// Public list/view (these back the public landing page); writes are
// superuser-only via the admin, same posture as `books` and the taxonomy lists.
migrate(
	(app) => {
		const collection = new Collection({
			type: 'base',
			name: 'banners',
			listRule: '',
			viewRule: '',
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				// Placement: hero carousel vs featured promo strip.
				{
					name: 'type',
					type: 'select',
					required: true,
					maxSelect: 1,
					values: ['hero', 'featured']
				},

				// Localizable copy (Spanish base columns; `_de` in v2).
				{ name: 'title', type: 'text', max: 255, presentable: true },
				{ name: 'subtitle', type: 'text', max: 500 },

				// Call to action. `cta_link` can point at a filtered listing
				// (`/libros?age=0-3`), a book, or an event — a plain relative path.
				{ name: 'cta_label', type: 'text', max: 100 },
				{ name: 'cta_link', type: 'text', max: 500 },

				{
					name: 'image',
					type: 'file',
					maxSelect: 1,
					maxSize: 5242880,
					mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
				},

				// Curation: explicit owner-defined order + an on/off switch.
				{ name: 'sort', type: 'number', onlyInt: true },
				{ name: 'active', type: 'bool' },

				// Optional schedule window for timed promotions. Both optional: an
				// empty bound means "no lower/upper limit". The in-window check is
				// applied server-side in the BFF (`src/lib/server/content.ts`), not in
				// the DB filter, so an unset date can't ambiguously drop a banner.
				{ name: 'start', type: 'date' },
				{ name: 'end', type: 'date' },

				{ name: 'created', type: 'autodate', onCreate: true },
				{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
			]
		});

		app.save(collection);
	},
	(app) => {
		const collection = app.findCollectionByNameOrId('banners');
		app.delete(collection);
	}
);
