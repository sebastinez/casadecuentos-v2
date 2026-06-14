#!/usr/bin/env node
/**
 * One-off importer: Shopify product CSV → PocketBase `books`
 * (+ `publishers` / `book_languages` taxonomy).
 *
 * This is a STANDALONE data-import script, deliberately NOT a pb_migration:
 * migrations replay on every environment's serve boot and version SCHEMA, not
 * 82 rows of real catalog data pulled from a Shopify export. It targets a live
 * remote instance over the API instead.
 *
 * The real PocketBase API for preview is `pb.casadecuentos.ch` — the
 * `preview.casadecuentos.ch` host is the SvelteKit storefront, which itself
 * talks to `pb.casadecuentos.ch`. Point POCKETBASE_URL at the pb host.
 *
 * Usage:
 *   POCKETBASE_URL=https://pb.casadecuentos.ch \
 *   POCKETBASE_ADMIN_EMAIL=admin@casadecuentos.ch \
 *   POCKETBASE_ADMIN_PASSWORD='<prod superuser password>' \
 *   node scripts/import-shopify.mjs [csvFile] [--limit N] [--dry-run] [--force-cover]
 *
 * Flags:
 *   --limit N       process only the first N products (test one end-to-end first)
 *   --dry-run       connect + read, but make no writes (prints intended actions)
 *   --force-cover   re-download/replace covers even when a record already has one
 *
 * Idempotent: books are upserted by `slug` (= Shopify Handle), taxonomy is
 * find-or-create by slug. Safe to re-run. Runs SEQUENTIALLY on purpose — the PB
 * SDK auto-cancels parallel requests to the same collection (we pass
 * requestKey:null as belt-and-braces too).
 *
 * Known gaps (no data in the export — fill in via admin afterwards):
 *   - `genre` and `age_band` are left empty on every record (these power the
 *     storefront filter facets, so filtered views stay empty until populated).
 *   - `publication_year` is absent from the CSV.
 */

import PocketBase from 'pocketbase';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

// --- CLI args ---------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const DRY_RUN = flag('--dry-run');
const FORCE_COVER = flag('--force-cover');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const csvPath = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--limit') || 'products_export_1-3.csv';

const PB_URL = process.env.POCKETBASE_URL || 'https://pb.casadecuentos.ch';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
	console.error(
		'Missing POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD env vars.\n' +
			'These must be the PRODUCTION superuser credentials for ' + PB_URL + '.'
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
const slugify = (s) =>
	(s || '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '') // strip diacritics
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

const toInt = (s) => {
	const m = (s || '').match(/\d+/);
	return m ? parseInt(m[0], 10) : null;
};

const FORMAT_MAP = {
	'tapa dura': 'Tapa dura',
	'tapa blanda': 'Tapa blanda',
	cartone: 'Cartoné',
	'cartoné': 'Cartoné',
	cartonado: 'Cartoné'
};
const normalizeFormat = (s) => {
	const v = (s || '').trim();
	if (!v) return '';
	return FORMAT_MAP[v.toLowerCase()] || v;
};

// Reduce HTML to plain text: drop the metadata <table> entirely (it duplicates
// the structured fields), turn block boundaries into newlines, strip every
// remaining tag, decode the entities Shopify emits, and tidy whitespace.
const htmlToPlainText = (html) =>
	(html || '')
		// Decode entities FIRST: some sources double-escape markup (e.g. `&lt;i&gt;`),
		// so this must run before tag-stripping or those tags survive as text.
		.replace(/&nbsp;/gi, ' ')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#39;|&apos;/gi, "'")
		.replace(/&amp;/gi, '&')
		.replace(/<table[\s\S]*?<\/table>/gi, '') // remove the spec table
		.replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]+>/g, '') // strip all remaining tags
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();

// Plain-text blurb only. Prefer the clean `Description` metafield; fall back to
// the Body HTML (table stripped). Output carries no HTML and no spec fields.
const buildDescription = (descMeta, bodyHtml) => {
	const meta = (descMeta || '').trim();
	return htmlToPlainText(meta || bodyHtml);
};

// --- main -------------------------------------------------------------------
const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);

async function findOrCreate(collection, name, cache) {
	const slug = slugify(name);
	const key = collection + ':' + slug;
	if (cache.has(key)) return cache.get(key);
	let id;
	try {
		const rec = await pb.collection(collection).getFirstListItem(`slug="${slug}"`, { requestKey: null });
		id = rec.id;
	} catch (e) {
		if (e?.status !== 404) throw e;
		if (DRY_RUN) {
			id = `(would-create ${collection}/${slug})`;
		} else {
			const rec = await pb.collection(collection).create({ name: name.trim(), slug }, { requestKey: null });
			id = rec.id;
			console.log(`  + created ${collection}: "${name.trim()}" (${slug})`);
		}
	}
	cache.set(key, id);
	return id;
}

async function fetchCover(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status} fetching cover`);
	const buf = Buffer.from(await res.arrayBuffer());
	const type = res.headers.get('content-type') || 'image/jpeg';
	let name = basename(new URL(url).pathname) || 'cover.jpg';
	return new File([buf], name, { type });
}

function toFormData(data, file) {
	const form = new FormData();
	for (const [k, v] of Object.entries(data)) {
		if (v === '' || v === null || v === undefined) continue;
		form.append(k, String(v));
	}
	if (file) form.append('cover', file);
	return form;
}

async function main() {
	console.log(`PocketBase: ${PB_URL}`);
	console.log(`CSV:        ${csvPath}`);
	console.log(`Mode:       ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}${FORCE_COVER ? ' +force-cover' : ''}`);
	console.log('');

	await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD, { requestKey: null });
	console.log(`Authenticated as ${ADMIN_EMAIL}\n`);

	const rows = parseCSV(readFileSync(csvPath, 'utf8'));
	const header = rows[0];
	const col = {};
	header.forEach((h, i) => (col[h] = i));
	const get = (row, name) => (row[col[name]] || '').trim();

	// Group by Handle; the "main" row is the one carrying the Title.
	const byHandle = new Map();
	for (const r of rows.slice(1)) {
		const h = r[col['Handle']];
		if (!h) continue;
		if (!byHandle.has(h)) byHandle.set(h, []);
		byHandle.get(h).push(r);
	}

	const taxonCache = new Map();
	const langId = await findOrCreate('book_languages', 'Español', taxonCache);

	let created = 0,
		updated = 0,
		skipped = 0,
		coversUploaded = 0,
		coversMissing = 0,
		errors = 0;
	let n = 0;

	for (const [handle, group] of byHandle) {
		if (n >= LIMIT) break;
		n++;
		const main = group.find((r) => (r[col['Title']] || '').trim()) || group[0];

		const title = get(main, 'Title');
		const status = get(main, 'Status');
		if (status === 'draft') {
			console.log(`- skip (draft): ${handle}`);
			skipped++;
			continue;
		}

		const publisherName = get(main, 'Vendor');
		const data = {
			title,
			slug: handle,
			author: get(main, 'Author (product.metafields.custom.author)'),
			illustrator: get(main, 'Ilustrator (product.metafields.custom.ilustrator)'),
			description: buildDescription(
				get(main, 'Description (product.metafields.custom.description)'),
				get(main, 'Body (HTML)')
			),
			price: parseFloat(get(main, 'Variant Price')) || 0,
			stock: toInt(get(main, 'Variant Inventory Qty')) || 0,
			ISBN: get(main, 'ISBN (product.metafields.facts.isbn)'),
			format: normalizeFormat(get(main, 'Tipo (product.metafields.custom.tipo)')),
			page_count: toInt(get(main, 'Paginas (product.metafields.custom.paginas)')) ?? '',
			book_size: get(main, 'Tamaño (product.metafields.custom.size)'),
			language: langId,
			publisher: publisherName ? await findOrCreate('publishers', publisherName, taxonCache) : ''
		};

		// Find existing book by slug.
		let existing = null;
		try {
			existing = await pb.collection('books').getFirstListItem(`slug="${handle}"`, { requestKey: null });
		} catch (e) {
			if (e?.status !== 404) throw e;
		}

		// Decide whether a cover fetch is needed.
		const imgSrc = get(main, 'Image Src');
		let file = null;
		const needCover = imgSrc && (!existing || !existing.cover || FORCE_COVER);
		if (!imgSrc) {
			coversMissing++;
		}

		try {
			if (needCover && !DRY_RUN) {
				file = await fetchCover(imgSrc);
			}

			if (DRY_RUN) {
				console.log(
					`~ ${existing ? 'update' : 'create'} ${handle} — "${title}" | CHF ${data.price} | stock ${data.stock} | ${publisherName || '(no publisher)'}${needCover ? ' | +cover' : ''}`
				);
			} else if (existing) {
				if (file) {
					await pb.collection('books').update(existing.id, toFormData(data, file), { requestKey: null });
					coversUploaded++;
				} else {
					await pb.collection('books').update(existing.id, data, { requestKey: null });
				}
				console.log(`~ updated ${handle} — "${title}"`);
				updated++;
			} else {
				if (file) {
					await pb.collection('books').create(toFormData(data, file), { requestKey: null });
					coversUploaded++;
				} else {
					await pb.collection('books').create(data, { requestKey: null });
				}
				console.log(`+ created ${handle} — "${title}"`);
				created++;
			}
		} catch (e) {
			errors++;
			console.error(`! ERROR on ${handle}: ${e?.message || e}`);
			if (e?.response?.data) console.error('  ', JSON.stringify(e.response.data));
		}
	}

	console.log('\n--- summary ---');
	console.log(`processed:        ${n}`);
	console.log(`created:          ${created}`);
	console.log(`updated:          ${updated}`);
	console.log(`skipped (draft):  ${skipped}`);
	console.log(`covers uploaded:  ${coversUploaded}`);
	console.log(`no image in CSV:  ${coversMissing}`);
	console.log(`errors:           ${errors}`);
	if (DRY_RUN) console.log('\n(DRY RUN — nothing was written)');
}

main().catch((e) => {
	console.error('FATAL:', e?.message || e);
	if (e?.response?.data) console.error(JSON.stringify(e.response.data, null, 2));
	process.exit(1);
});
