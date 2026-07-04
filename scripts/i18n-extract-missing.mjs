#!/usr/bin/env node
/**
 * Step 1 of the _es/_de backfill pipeline.
 *
 * Scans every collection/field pair that follows the `<field>_es` / `<field>_de`
 * sibling-column convention (see pb_migrations/1780787000_localize_content_fields.js)
 * and finds records where exactly one locale is filled in. Those go into a JSON
 * file for translation; records with both locales filled (or both empty) are
 * left alone.
 *
 * Usage:
 *   POCKETBASE_URL=https://pb.casadecuentos.ch \
 *   POCKETBASE_ADMIN_EMAIL=admin@casadecuentos.ch \
 *   POCKETBASE_ADMIN_PASSWORD='<prod superuser password>' \
 *   node scripts/i18n-extract-missing.mjs [outFile]
 *
 * Runs sequentially on purpose (see import-shopify.mjs note): the PB SDK
 * auto-cancels parallel requests to the same collection.
 */

import PocketBase from 'pocketbase';
import { writeFileSync } from 'node:fs';

const PB_URL = process.env.POCKETBASE_URL || 'https://pb.casadecuentos.ch';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;
const outFile = process.argv[2] || 'scripts/i18n-missing.json';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
	console.error('Missing POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD env vars.');
	process.exit(1);
}

// Mirrors the SPEC in pb_migrations/1780787000_localize_content_fields.js
const SPEC = [
	{ collection: 'books', fields: ['description', 'format'] },
	{ collection: 'events', fields: ['title', 'description'] },
	{ collection: 'banners', fields: ['title', 'subtitle', 'cta_label'] },
	{ collection: 'videos', fields: ['title', 'description'] },
	{ collection: 'genres', fields: ['name'] },
	{ collection: 'book_languages', fields: ['name'] }
];

const LOCALES = ['es', 'de'];
const otherLocale = (l) => (l === 'es' ? 'de' : 'es');

const isFilled = (v) => typeof v === 'string' && v.trim() !== '';

async function main() {
	const pb = new PocketBase(PB_URL);
	pb.autoCancellation(false);
	await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

	const missing = [];
	const stats = { scanned: 0, bothFilled: 0, bothEmpty: 0, needsTranslation: 0 };

	for (const { collection, fields } of SPEC) {
		const records = await pb.collection(collection).getFullList({ requestKey: null });
		for (const r of records) {
			for (const field of fields) {
				stats.scanned++;
				const values = Object.fromEntries(LOCALES.map((l) => [l, r[`${field}_${l}`]]));
				const filledLocales = LOCALES.filter((l) => isFilled(values[l]));

				if (filledLocales.length === 2) {
					stats.bothFilled++;
					continue;
				}
				if (filledLocales.length === 0) {
					stats.bothEmpty++;
					continue;
				}

				const sourceLocale = filledLocales[0];
				const targetLocale = otherLocale(sourceLocale);
				stats.needsTranslation++;
				missing.push({
					collection,
					id: r.id,
					field,
					sourceLocale,
					targetLocale,
					sourceText: values[sourceLocale],
					translatedText: null // fill this in before running the push script
				});
			}
		}
	}

	writeFileSync(outFile, JSON.stringify(missing, null, 2));
	console.log(`Scanned ${stats.scanned} field(s) across ${SPEC.length} collections.`);
	console.log(`  both locales filled: ${stats.bothFilled} (untouched)`);
	console.log(`  both locales empty:  ${stats.bothEmpty} (untouched)`);
	console.log(`  needs translation:   ${stats.needsTranslation}`);
	console.log(`Wrote ${outFile}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
