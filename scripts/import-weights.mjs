#!/usr/bin/env node
/**
 * One-off importer: Shopify product CSV → PocketBase `books.weight_grams`.
 *
 * Reads the "Variant Grams" column from a Shopify product export and writes it
 * to the matching `books` record, matched by ISBN. Used to populate per-book
 * shipping weight so order shipping cost can later be computed by total weight.
 *
 * Like scripts/import-shopify.mjs, this is a STANDALONE data script (not a
 * pb_migration): it carries real catalog data and targets a live remote
 * instance over the API. It only touches `weight_grams` — nothing else.
 *
 * Usage:
 *   POCKETBASE_URL=https://pb.casadecuentos.ch \
 *   POCKETBASE_ADMIN_EMAIL=admin@casadecuentos.ch \
 *   POCKETBASE_ADMIN_PASSWORD='<prod superuser password>' \
 *   node scripts/import-weights.mjs [csvFile] [--limit N] [--dry-run]
 *
 * Flags:
 *   --limit N    process only the first N products
 *   --dry-run    connect + read, but make no writes (prints intended actions)
 *
 * Idempotent: matches books by ISBN and sets weight_grams. Safe to re-run.
 * Runs SEQUENTIALLY (the PB SDK auto-cancels parallel same-collection requests;
 * we pass requestKey:null and disable auto-cancellation as belt-and-braces).
 */

import PocketBase from 'pocketbase';
import { readFileSync } from 'node:fs';

// --- CLI args ---------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const DRY_RUN = flag('--dry-run');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const csvPath =
	args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--limit') ||
	'products_export_1-2.csv';

const PB_URL = process.env.POCKETBASE_URL || 'https://pb.casadecuentos.ch';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
	console.error(
		'Missing POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD env vars.\n' +
			'These must be the PRODUCTION superuser credentials for ' +
			PB_URL +
			'.'
	);
	process.exit(1);
}

// --- tiny RFC-4180-ish CSV parser (quotes, escaped quotes, newlines) --------
function parseCSV(s) {
	const rows = [];
	let i = 0,
		field = '',
		row = [],
		inQuotes = false;
	while (i < s.length) {
		const c = s[i];
		if (inQuotes) {
			if (c === '"') {
				if (s[i + 1] === '"') {
					field += '"';
					i += 2;
					continue;
				}
				inQuotes = false;
				i++;
				continue;
			}
			field += c;
			i++;
			continue;
		}
		if (c === '"') {
			inQuotes = true;
			i++;
			continue;
		}
		if (c === ',') {
			row.push(field);
			field = '';
			i++;
			continue;
		}
		if (c === '\r') {
			i++;
			continue;
		}
		if (c === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
			i++;
			continue;
		}
		field += c;
		i++;
	}
	if (field.length || row.length) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

// --- helpers ----------------------------------------------------------------
const toInt = (s) => {
	const m = (s || '').match(/\d+/);
	return m ? parseInt(m[0], 10) : null;
};

// PocketBase filter literal: escape embedded double quotes.
const escFilter = (s) => String(s).replace(/"/g, '\\"');

// --- main -------------------------------------------------------------------
const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

async function main() {
	console.log(`PocketBase: ${PB_URL}`);
	console.log(`CSV:        ${csvPath}`);
	console.log(`Mode:       ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
	console.log('');

	await pb
		.collection('_superusers')
		.authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD, { requestKey: null });
	console.log(`Authenticated as ${ADMIN_EMAIL}\n`);

	const rows = parseCSV(readFileSync(csvPath, 'utf8'));
	const header = rows[0];
	const col = {};
	header.forEach((h, i) => (col[h] = i));
	const get = (row, name) => (row[col[name]] || '').trim();

	const ISBN_COL = 'ISBN (product.metafields.facts.isbn)';
	if (col['Variant Grams'] === undefined || col[ISBN_COL] === undefined) {
		console.error(
			'CSV is missing the "Variant Grams" or ISBN column. Got headers:\n' + header.join(' | ')
		);
		process.exit(1);
	}

	// Group by Handle; the "main" row carries the Title + ISBN, variant rows carry
	// per-variant grams. Pull ISBN from the main row and the first non-empty grams
	// value found anywhere in the product's rows.
	const byHandle = new Map();
	for (const r of rows.slice(1)) {
		const h = r[col['Handle']];
		if (!h) continue;
		if (!byHandle.has(h)) byHandle.set(h, []);
		byHandle.get(h).push(r);
	}

	let updated = 0,
		noIsbn = 0,
		noGrams = 0,
		notFound = 0,
		unchanged = 0,
		errors = 0;
	let n = 0;

	for (const [handle, group] of byHandle) {
		if (n >= LIMIT) break;
		n++;

		const mainRow = group.find((r) => (r[col['Title']] || '').trim()) || group[0];
		const isbn = get(mainRow, ISBN_COL);
		const gramsRow = group.find((r) => (r[col['Variant Grams']] || '').trim());
		const grams = gramsRow ? toInt(get(gramsRow, 'Variant Grams')) : null;

		if (!isbn) {
			console.log(`- skip (no ISBN in CSV): ${handle}`);
			noIsbn++;
			continue;
		}
		if (grams === null) {
			console.log(`- skip (no Variant Grams): ${handle} (ISBN ${isbn})`);
			noGrams++;
			continue;
		}

		let book = null;
		try {
			book = await pb
				.collection('books')
				.getFirstListItem(`ISBN="${escFilter(isbn)}"`, { requestKey: null });
		} catch (e) {
			if (e?.status !== 404) throw e;
		}

		if (!book) {
			console.log(`? not found in PB (ISBN ${isbn}): ${handle}`);
			notFound++;
			continue;
		}

		if (book.weight_grams === grams) {
			console.log(`= unchanged ${handle} — ISBN ${isbn} | ${grams} g`);
			unchanged++;
			continue;
		}

		try {
			if (DRY_RUN) {
				console.log(
					`~ would set ${handle} — ISBN ${isbn} | ${book.weight_grams ?? '∅'} → ${grams} g`
				);
			} else {
				await pb.collection('books').update(book.id, { weight_grams: grams }, { requestKey: null });
				console.log(`~ updated ${handle} — ISBN ${isbn} | ${grams} g`);
			}
			updated++;
		} catch (e) {
			errors++;
			console.error(`! ERROR on ${handle} (ISBN ${isbn}): ${e?.message || e}`);
			if (e?.response?.data) console.error('  ', JSON.stringify(e.response.data));
		}
	}

	console.log('\n--- summary ---');
	console.log(`processed:          ${n}`);
	console.log(`updated:            ${updated}`);
	console.log(`unchanged:          ${unchanged}`);
	console.log(`no ISBN in CSV:     ${noIsbn}`);
	console.log(`no grams in CSV:    ${noGrams}`);
	console.log(`not found in PB:    ${notFound}`);
	console.log(`errors:             ${errors}`);
	if (DRY_RUN) console.log('\n(DRY RUN — nothing was written)');
}

main().catch((e) => {
	console.error('FATAL:', e?.message || e);
	if (e?.response?.data) console.error(JSON.stringify(e.response.data, null, 2));
	process.exit(1);
});
