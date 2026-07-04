#!/usr/bin/env node
/**
 * Step 3 of the _es/_de backfill pipeline (step 2 is filling in `translatedText`
 * in the JSON produced by i18n-extract-missing.mjs, e.g. by hand or via an LLM).
 *
 * Reads the translated JSON and PATCHes each record's target-locale column.
 * Skips (and reports) any entry still missing `translatedText`.
 *
 * Usage:
 *   POCKETBASE_URL=https://pb.casadecuentos.ch \
 *   POCKETBASE_ADMIN_EMAIL=admin@casadecuentos.ch \
 *   POCKETBASE_ADMIN_PASSWORD='<prod superuser password>' \
 *   node scripts/i18n-push-translations.mjs [inFile] [--dry-run]
 */

import PocketBase from 'pocketbase';
import { readFileSync } from 'node:fs';

const PB_URL = process.env.POCKETBASE_URL || 'https://pb.casadecuentos.ch';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const inFile = args.find((a) => !a.startsWith('--')) || 'scripts/i18n-missing.json';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
	console.error('Missing POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD env vars.');
	process.exit(1);
}

async function main() {
	const items = JSON.parse(readFileSync(inFile, 'utf-8'));

	const ready = items.filter((i) => typeof i.translatedText === 'string' && i.translatedText.trim() !== '');
	const notReady = items.length - ready.length;
	if (notReady > 0) {
		console.warn(`Skipping ${notReady} entr(y/ies) without a translatedText.`);
	}

	const pb = new PocketBase(PB_URL);
	pb.autoCancellation(false);
	if (!DRY_RUN) {
		await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);
	}

	let updated = 0;
	for (const item of ready) {
		const columnName = `${item.field}_${item.targetLocale}`;
		console.log(
			`${DRY_RUN ? '[dry-run] ' : ''}${item.collection}/${item.id}.${columnName} <- ` +
				JSON.stringify(item.translatedText.slice(0, 80))
		);
		if (!DRY_RUN) {
			await pb.collection(item.collection).update(
				item.id,
				{ [columnName]: item.translatedText },
				{ requestKey: null }
			);
		}
		updated++;
	}

	console.log(`${DRY_RUN ? 'Would update' : 'Updated'} ${updated} field(s).`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
