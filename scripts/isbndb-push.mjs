#!/usr/bin/env node
/**
 * Push reviewed ISBNdb metadata (scripts/isbndb-books.json, produced by
 * isbndb-fetch.mjs and then HAND-REVIEWED) into PocketBase `books`.
 *
 * Successor to import-shopify.mjs for new arrivals now that the Shopify store
 * is shut down: fetch metadata by ISBN, review/fix the JSON, push.
 *
 * CREATE-ONLY: a book whose ISBN or slug already exists in prod is skipped and
 * reported, never updated — prod records may carry curated data this script
 * must not clobber.
 *
 * Taxonomy is MATCH-ONLY (deliberately unlike import-shopify's find-or-create):
 * ISBNdb publisher spellings are too inconsistent to mint records from, and
 * `book_languages` is a curated set. `pb.publisher` / `pb.language` strings are
 * matched against EXISTING prod records (by slugified name, with common
 * language-code aliases); a miss leaves the relation empty and is reported —
 * create the taxon in admin or fix the string in the JSON, then re-run.
 *
 * Validation before any write (mirrors the `books` schema; failures are
 * REFUSED — fix the JSON and re-run):
 *   - `title`, `author`, `slug`: non-empty strings, ≤ 255 chars.
 *   - `ISBN` (or the JSON key): normalizes to a valid ISBN-10/13 shape.
 *   - `slug` and `ISBN` unique within the JSON (prod collisions are skipped).
 *   - `price`: number ≥ 0 (schema requires it; ISBNdb ships null — fill it in
 *     the JSON during review).
 *   - `stock`, `page_count`, `publication_year`, `weight_grams`: empty or an
 *     integer ≥ 0.
 *   - `description_es`: must have visible text (HTML tags alone don't count).
 *     ISBNdb often has no synopsis — write one during review.
 *   - `format_es`, `book_size`: ≤ 100 chars.
 *   - `weight_grams` missing/0: REFUSED in dry run (checkout counts it as 0 g,
 *     undercharging shipping), but only WARNED under --apply so known-weightless
 *     books can still go through once you've seen the list.
 *   - `cover` holds a URL; it's downloaded and uploaded as the file. A failed
 *     download, or one that isn't jpeg/png/webp/avif ≤ 5 MB, creates the record
 *     without a cover (reported).
 *
 * A create that PocketBase still rejects is reported and the run continues;
 * the script exits non-zero if any create failed.
 *
 * `stock` is whatever the JSON says (default 0). After pushing, re-run
 * sync-stock.mjs --apply with the scan file to set real tallies.
 *
 * Dry-run by default; --apply writes. Sequential on purpose (PB SDK
 * autocancels parallel same-collection calls).
 *
 * Usage:
 *   POCKETBASE_URL=https://pb.casadecuentos.ch \
 *   POCKETBASE_ADMIN_EMAIL=... POCKETBASE_ADMIN_PASSWORD=... \
 *   node scripts/isbndb-push.mjs [scripts/isbndb-books.json] [--apply]
 */

import PocketBase from 'pocketbase';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

// --- CLI args ---------------------------------------------------------------
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const jsonPath = args.find((a) => !a.startsWith('--')) || 'scripts/isbndb-books.json';

const PB_URL = process.env.POCKETBASE_URL || 'https://pb.casadecuentos.ch';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
	console.error('Missing POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD env vars.');
	process.exit(1);
}

// --- helpers ----------------------------------------------------------------
const normalizeISBN = (raw) => (raw || '').replace(/[^0-9Xx]/g, '').toUpperCase();

const slugify = (s) =>
	(s || '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '') // strip diacritics
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

// ISBNdb sends bare language codes; prod records are named things like
// "Español". Expand codes to the slugs they might live under.
const LANGUAGE_ALIASES = {
	es: ['espanol', 'spanish', 'castellano'],
	ca: ['catalan'],
	de: ['aleman', 'deutsch', 'german'],
	en: ['ingles', 'english'],
	fr: ['frances', 'francais', 'french'],
	it: ['italiano', 'italian']
};

// Mirrors the `books.cover` field constraints.
const COVER_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
const COVER_MAX_BYTES = 5242880;

async function fetchCover(url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`HTTP ${res.status} fetching cover`);
	const buf = Buffer.from(await res.arrayBuffer());
	const type = (res.headers.get('content-type') || 'image/jpeg').split(';')[0].trim().toLowerCase();
	if (!COVER_MIME_TYPES.includes(type)) throw new Error(`unsupported cover type "${type}"`);
	if (buf.length > COVER_MAX_BYTES)
		throw new Error(`cover is ${(buf.length / 1048576).toFixed(1)} MB (max 5 MB)`);
	const name = basename(new URL(url).pathname) || 'cover.jpg';
	return new File([buf], name, { type });
}

const isBlank = (v) => v === '' || v === null || v === undefined;
// Optional PB number field with min 0 + onlyInt.
const isOptionalNonNegInt = (v) => isBlank(v) || (Number.isInteger(v) && v >= 0);
// ISBN-10 (last char may be X) or ISBN-13, after stripping hyphens/spaces.
const isISBNShape = (n) => /^(\d{9}[\dX]|\d{13})$/.test(n);

// Hard schema problems for one entry. Empty array = valid.
function validate(isbn, p) {
	const problems = [];
	for (const [field, max] of [
		['title', 255],
		['author', 255],
		['slug', 255]
	]) {
		const v = p[field];
		if (typeof v !== 'string' || !v.trim()) problems.push(`${field} is empty`);
		else if (v.length > max) problems.push(`${field} is ${v.length} chars (max ${max})`);
	}
	const normISBN = normalizeISBN(p.ISBN || isbn);
	if (!isISBNShape(normISBN))
		problems.push(`ISBN ${JSON.stringify(p.ISBN || isbn)} isn't a 10/13-digit ISBN`);
	if (typeof p.price !== 'number' || !Number.isFinite(p.price) || p.price < 0)
		problems.push(`price is ${JSON.stringify(p.price)}; set a CHF price`);
	for (const field of ['stock', 'page_count', 'publication_year', 'weight_grams']) {
		if (!isOptionalNonNegInt(p[field]))
			problems.push(`${field} is ${JSON.stringify(p[field])}; must be empty or an integer ≥ 0`);
	}
	// Editor (HTML) field: count only visible text, so "<p></p>" is still empty.
	const descText =
		typeof p.description_es === 'string'
			? p.description_es.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim()
			: '';
	if (!descText) problems.push('description_es is empty; write a description');
	for (const field of ['format_es', 'book_size']) {
		const v = p[field];
		if (isBlank(v)) continue;
		if (typeof v !== 'string') problems.push(`${field} must be a string`);
		else if (v.length > 100) problems.push(`${field} is ${v.length} chars (max 100)`);
	}
	return problems;
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

// --- load reviewed JSON -------------------------------------------------------
const cache = JSON.parse(readFileSync(jsonPath, 'utf8'));
const entries = Object.entries(cache.books || {});
if (!entries.length) {
	console.error(`${jsonPath} contains no books.`);
	process.exit(1);
}
console.log(
	`${jsonPath}: ${entries.length} book(s). ${APPLY ? 'APPLY' : 'Dry run'} against ${PB_URL}.`
);

// --- connect + preload prod state ----------------------------------------------
const pb = new PocketBase(PB_URL);
await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

const [prodBooks, publishers, languages] = [
	await pb
		.collection('books')
		.getFullList({ fields: 'id,slug,ISBN,title,stock', requestKey: null }),
	await pb.collection('publishers').getFullList({ requestKey: null }),
	await pb.collection('book_languages').getFullList({ requestKey: null })
];

const prodByISBN = new Map(
	prodBooks.filter((b) => normalizeISBN(b.ISBN)).map((b) => [normalizeISBN(b.ISBN), b])
);
const prodBySlug = new Map(prodBooks.map((b) => [b.slug, b]));

function matchPublisher(name) {
	const key = slugify(name);
	if (!key) return null;
	return publishers.find((p) => p.slug === key || slugify(p.name) === key) || null;
}

function matchLanguage(raw) {
	const key = slugify(raw);
	if (!key) return null;
	const candidates = [key, ...(LANGUAGE_ALIASES[key] || [])];
	return (
		languages.find((l) =>
			candidates.some(
				(c) =>
					l.slug === c ||
					slugify(l.name_es) === c ||
					slugify(l.name_de) === c ||
					slugify(l.name) === c
			)
		) || null
	);
}

// --- plan ------------------------------------------------------------------------
const toCreate = [];
const skipped = [];
const refused = [];

// Within-file uniqueness: first occurrence wins, later ones are refused (a
// duplicate would otherwise pass the dry run and then fail mid --apply).
const seenSlugs = new Map();
const seenISBNs = new Map();

for (const [isbn, entry] of entries) {
	const p = entry.pb || {};
	const existing = prodByISBN.get(normalizeISBN(p.ISBN || isbn)) || prodBySlug.get(p.slug);
	if (existing) {
		skipped.push(`  ${isbn} "${p.title}" — already in prod as "${existing.slug}"`);
		continue;
	}

	const problems = validate(isbn, p);
	const normISBN = normalizeISBN(p.ISBN || isbn);
	if (p.slug && seenSlugs.has(p.slug))
		problems.push(`slug "${p.slug}" duplicates ${seenSlugs.get(p.slug)} in this JSON`);
	if (normISBN && seenISBNs.has(normISBN))
		problems.push(`ISBN ${normISBN} duplicates ${seenISBNs.get(normISBN)} in this JSON`);
	if (p.slug && !seenSlugs.has(p.slug)) seenSlugs.set(p.slug, isbn);
	if (normISBN && !seenISBNs.has(normISBN)) seenISBNs.set(normISBN, isbn);

	// Missing weight: blocking in dry run, a warning under --apply.
	const noWeight = isBlank(p.weight_grams) || p.weight_grams === 0;
	if (noWeight && !APPLY) problems.push('weight_grams is missing (shipping would count 0 g)');

	if (problems.length) {
		refused.push(`  ${isbn} "${p.title ?? ''}"\n${problems.map((m) => `      - ${m}`).join('\n')}`);
		continue;
	}

	const publisher = matchPublisher(p.publisher);
	const language = matchLanguage(p.language);
	toCreate.push({ isbn, p, publisher, language, noWeight });
}

for (const { p, publisher, language, noWeight } of toCreate) {
	console.log(`+ ${p.slug} — "${p.title}" | CHF ${p.price} | stock ${p.stock ?? 0}`);
	if (noWeight) console.log('    ! no weight_grams — shipping will count this book as 0 g');
	if (p.publisher && !publisher)
		console.log(
			`    ! publisher "${p.publisher}" not in prod — left empty (create in admin or fix JSON)`
		);
	if (p.language && !language)
		console.log(`    ! language "${p.language}" not in prod — left empty`);
	if (!p.cover) console.log('    ! no cover URL');
}
if (skipped.length)
	console.log(`\n-- Skipped (already in prod, never updated) --\n${skipped.join('\n')}`);
if (refused.length) console.log(`\n-- Refused (fix the JSON and re-run) --\n${refused.join('\n')}`);
console.log(
	`\nTo create: ${toCreate.length}. Skipped: ${skipped.length}. Refused: ${refused.length}.`
);

if (!APPLY) {
	console.log('\nDry run — nothing written. Re-run with --apply to create the above.');
	process.exit(0);
}

// --- apply -------------------------------------------------------------------------
let created = 0;
const failed = [];
for (const { isbn, p, publisher, language } of toCreate) {
	let cover = null;
	if (p.cover) {
		try {
			cover = await fetchCover(p.cover);
		} catch (e) {
			console.log(
				`    ! cover download failed for ${p.slug} (${e.message}) — creating without cover`
			);
		}
	}
	const data = {
		slug: p.slug,
		title: p.title,
		author: p.author,
		ISBN: p.ISBN || isbn,
		price: p.price,
		stock: p.stock ?? 0,
		format_es: p.format_es,
		page_count: p.page_count,
		book_size: p.book_size,
		weight_grams: p.weight_grams,
		publication_year: p.publication_year,
		description_es: p.description_es,
		publisher: publisher?.id || '',
		language: language?.id || ''
	};
	try {
		await pb.collection('books').create(toFormData(data, cover), { requestKey: null });
		created++;
		console.log(`~ created ${p.slug}`);
	} catch (e) {
		const fieldErrors = e?.response?.data && Object.keys(e.response.data).length
			? ` ${JSON.stringify(e.response.data)}`
			: '';
		failed.push(`  ${isbn} "${p.title}" — ${e.message}${fieldErrors}`);
		console.log(`    ! create FAILED for ${p.slug} (${e.message})${fieldErrors}`);
	}
}
if (failed.length) console.log(`\n-- Failed creates --\n${failed.join('\n')}`);
console.log(
	`\nDone. ${created} book(s) created, ${failed.length} failed. Re-run sync-stock.mjs --apply to set stock tallies.`
);
if (failed.length) process.exit(1);
