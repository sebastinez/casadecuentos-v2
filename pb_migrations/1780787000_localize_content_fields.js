/// <reference path="../pb_data/types.d.ts" />

// Symmetric per-locale columns for localizable content. The store now serves Spanish
// AND German, so each localizable text field becomes a pair of sibling columns
// `<field>_es` + `<field>_de` (the `localizedField` accessor reads `<field>_<locale>`
// with a Spanish fallback). This replaces the earlier "Spanish lives in the unsuffixed
// base column" convention: the base column is migrated into `_es` and then dropped.
//
// Intrinsic bibliographic metadata (books: title/author/illustrator/ISBN/…) and proper
// nouns (publishers.name) are NOT localized and keep their single base column.
// `de` columns ship empty — German content entry is an owner task; the accessor falls
// back to `_es` until they're filled.

// Each entry: the collection and the localizable base fields to convert. `type`,
// `max`, `required`, `presentable` mirror the original base column so `_es` is a
// faithful replacement; `_de` is always optional and non-presentable.
const SPEC = [
	{
		collection: 'books',
		fields: [
			{ name: 'description', type: 'editor' },
			{ name: 'format', type: 'text', max: 100 }
		]
	},
	{
		collection: 'events',
		fields: [
			{ name: 'title', type: 'text', max: 255, required: true, presentable: true },
			{ name: 'description', type: 'editor' }
		]
	},
	{
		collection: 'banners',
		fields: [
			{ name: 'title', type: 'text', max: 255, presentable: true },
			{ name: 'subtitle', type: 'text', max: 500 },
			{ name: 'cta_label', type: 'text', max: 100 }
		]
	},
	{
		collection: 'videos',
		fields: [
			{ name: 'title', type: 'text', max: 255, required: true, presentable: true },
			{ name: 'description', type: 'text', max: 1000 }
		]
	},
	{
		collection: 'genres',
		fields: [{ name: 'name', type: 'text', max: 255, required: true, presentable: true }]
	},
	{
		collection: 'book_languages',
		fields: [{ name: 'name', type: 'text', max: 255, required: true, presentable: true }]
	}
];

// Build a field constructor for `<base>_<locale>`. `es` mirrors the base constraints;
// `de` is optional + non-presentable (it may legitimately be empty).
function makeField(f, locale) {
	const name = `${f.name}_${locale}`;
	const isEs = locale === 'es';
	if (f.type === 'editor') {
		return new EditorField({ name });
	}
	return new TextField({
		name,
		max: f.max,
		required: isEs ? !!f.required : false,
		presentable: isEs ? !!f.presentable : false
	});
}

migrate(
	(app) => {
		for (const { collection: cname, fields } of SPEC) {
			// 1. Add the `_es` / `_de` sibling columns.
			const collection = app.findCollectionByNameOrId(cname);
			for (const f of fields) {
				collection.fields.add(makeField(f, 'es'));
				collection.fields.add(makeField(f, 'de'));
			}
			app.save(collection);

			// 2. Copy existing Spanish content from the base column into `_es`.
			const records = app.findAllRecords(cname);
			for (const r of records) {
				if (!r) continue;
				for (const f of fields) {
					r.set(`${f.name}_es`, r.get(f.name));
				}
				app.save(r);
			}

			// 3. Drop the now-migrated base columns.
			const fresh = app.findCollectionByNameOrId(cname);
			for (const f of fields) {
				fresh.fields.removeByName(f.name);
			}
			app.save(fresh);
		}
	},
	(app) => {
		// Reverse: re-add the base columns, copy `_es` back, drop both suffixed columns.
		for (const { collection: cname, fields } of SPEC) {
			const collection = app.findCollectionByNameOrId(cname);
			for (const f of fields) {
				if (f.type === 'editor') {
					collection.fields.add(new EditorField({ name: f.name }));
				} else {
					collection.fields.add(
						new TextField({
							name: f.name,
							max: f.max,
							required: !!f.required,
							presentable: !!f.presentable
						})
					);
				}
			}
			app.save(collection);

			const records = app.findAllRecords(cname);
			for (const r of records) {
				if (!r) continue;
				for (const f of fields) {
					r.set(f.name, r.get(`${f.name}_es`));
				}
				app.save(r);
			}

			const fresh = app.findCollectionByNameOrId(cname);
			for (const f of fields) {
				fresh.fields.removeByName(`${f.name}_es`);
				fresh.fields.removeByName(`${f.name}_de`);
			}
			app.save(fresh);
		}
	}
);
