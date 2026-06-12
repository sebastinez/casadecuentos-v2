/// <reference path="../pb_data/types.d.ts" />

// Phase 2 — taxonomy as relation collections.
// `genres`, `publishers`, `book_languages` power clean filter facets (Phase 3)
// and let the owner rename a label without a code change. Each is a tiny
// `name` + `slug` collection: public list/view (they back public filters),
// superuser-only writes via the PocketBase admin. `name` is `presentable` so
// it shows as the label in relation pickers and previews. `slug` is unique and
// will key URL filter params later.
migrate(
	(app) => {
		const names = ['genres', 'publishers', 'book_languages'];

		for (const name of names) {
			const collection = new Collection({
				type: 'base',
				name,
				listRule: '',
				viewRule: '',
				createRule: null,
				updateRule: null,
				deleteRule: null,
				fields: [
					{ name: 'name', type: 'text', required: true, max: 255, presentable: true },
					{ name: 'slug', type: 'text', required: true, max: 255 },
					{ name: 'created', type: 'autodate', onCreate: true },
					{ name: 'updated', type: 'autodate', onCreate: true, onUpdate: true }
				],
				indexes: [`CREATE UNIQUE INDEX \`idx_${name}_slug\` ON \`${name}\` (\`slug\`)`]
			});
			app.save(collection);
		}
	},
	(app) => {
		for (const name of ['genres', 'publishers', 'book_languages']) {
			const collection = app.findCollectionByNameOrId(name);
			app.delete(collection);
		}
	}
);
