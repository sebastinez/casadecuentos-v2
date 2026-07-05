#!/usr/bin/env node
/**
 * ISBN → book metadata via the ISBNdb API v2, cached to a local JSON file.
 *
 * Feeds the "unmatched scans" leg of the inventory sync: books physically on
 * the shelf but missing from PocketBase. Give it a list of ISBNs (the raw
 * scanner export works — duplicates are deduped), it looks each one up on
 * ISBNdb and stores both the raw API response and a `pb` object pre-mapped to
 * the `books` collection fields, ready for a later push script.
 *
 * NO PocketBase writes happen here — this only talks to ISBNdb and the local
 * cache file. Review/edit the JSON before pushing anything.
 *
 * Resumable: already-fetched ISBNs (found OR not-found) are skipped on re-run,
 * so an aborted run costs nothing and you can append new ISBNs to the input
 * later. Use --retry-not-found to re-ask about earlier 404s — per ISBNdb docs,
 * missing books often appear "within a minute or up to 24 hours".
 *
 * API (confirmed against https://api2.isbndb.com/doc.json):
 *   GET https://api2.isbndb.com/book/{isbn}
 *   Authorization: <API key>       (plain key, no "Bearer")
 *   200 → { book: {...} } | 404 → not in their DB (maybe yet)
 *
 * Usage:
 *   ISBNDB_API_KEY=... node scripts/isbndb-fetch.mjs <isbns.txt> \
 *     [--out scripts/isbndb-books.json] [--delay-ms 1100] [--retry-not-found]
 *
 * Basic plan is rate-limited to 1 req/s — the default 1100ms delay respects
 * that. (Premium/Pro use other base URLs and allow 3–5 req/s; override with
 * ISBNDB_BASE_URL and --delay-ms if you ever upgrade.)
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// --- CLI args ---------------------------------------------------------------
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, dflt) => {
	const i = args.indexOf(name);
	return i !== -1 ? args[i + 1] : dflt;
};
const inputPath = args.find(
	(a, i) => !a.startsWith('--') && args[i - 1] !== '--out' && args[i - 1] !== '--delay-ms'
);
const OUT_PATH = opt('--out', 'scripts/isbndb-books.json');
const DELAY_MS = parseInt(opt('--delay-ms', '1100'), 10);
const RETRY_NOT_FOUND = flag('--retry-not-found');

const API_KEY = process.env.ISBNDB_API_KEY;
const BASE_URL = process.env.ISBNDB_BASE_URL || 'https://api2.isbndb.com';

if (!inputPath) {
	console.error(
		'Usage: ISBNDB_API_KEY=... node scripts/isbndb-fetch.mjs <isbns.txt> [--out file] [--delay-ms N] [--retry-not-found]'
	);
	process.exit(1);
}
if (!API_KEY) {
	console.error('Missing ISBNDB_API_KEY env var.');
	process.exit(1);
}

// --- helpers (same conventions as import-shopify.mjs / sync-stock.mjs) ------
const normalizeISBN = (raw) => (raw || '').replace(/[^0-9Xx]/g, '').toUpperCase();

const isISBNish = (s) => /^\d{13}$/.test(s) || /^\d{9}[\dX]$/.test(s);

const slugify = (s) =>
	(s || '')
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '') // strip diacritics
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- dimension / weight parsing ---------------------------------------------
// ISBNdb ships measurements two ways, often both on the same book:
//   dimensions:  "Height: 11.6 inches, Length: 9.4 inches, Weight: 1.19 Pounds, Width: 0.67 inches"
//   dimensions_structured: { height: {value, unit}, width, length, weight }
// Units are usually imperial (inches / pounds) but not guaranteed, so we always
// normalise. `book_size` is a display Text field (existing style: "20 × 14 cm",
// bigger dimension first, whole-ish numbers); `weight_grams` is an integer.
const toCm = (value, unit) => {
	const u = (unit || '').toLowerCase();
	if (u.startsWith('inch') || u === 'in' || u === '"') return value * 2.54;
	if (u.startsWith('millim') || u === 'mm') return value / 10;
	if (u.startsWith('meter') || u === 'm') return value * 100;
	// centimeters, or unknown → assume already cm
	return value;
};

const toGrams = (value, unit) => {
	const u = (unit || '').toLowerCase();
	if (u.startsWith('pound') || u === 'lb' || u === 'lbs') return value * 453.59237;
	if (u.startsWith('ounce') || u === 'oz') return value * 28.349523125;
	if (u.startsWith('kilogram') || u === 'kg') return value * 1000;
	// grams, or unknown → assume already grams
	return value;
};

// Collect height/width/length/weight from the structured object first, then
// fill any gaps from the raw string. Returns { key: {value, unit} }.
function parseMeasurements(book) {
	const parts = {};
	const structured = book.dimensions_structured;
	if (structured && typeof structured === 'object') {
		for (const [k, v] of Object.entries(structured)) {
			if (v && typeof v.value === 'number')
				parts[k.toLowerCase()] = { value: v.value, unit: v.unit };
		}
	}
	if (typeof book.dimensions === 'string') {
		const re = /([a-z]+)\s*:\s*([\d.]+)\s*([a-z"]+)/gi;
		let m;
		while ((m = re.exec(book.dimensions))) {
			const key = m[1].toLowerCase();
			if (!parts[key]) parts[key] = { value: parseFloat(m[2]), unit: m[3] };
		}
	}
	return parts;
}

// Derive the `book_size` string + `weight_grams` integer for the pb object.
function measurementsToPB(book) {
	const parts = parseMeasurements(book);
	// The two largest linear dimensions are the cover height/width; the smallest
	// is the spine thickness (ISBNdb often mislabels it "width"), so sort — don't
	// trust the labels.
	const linear = ['height', 'width', 'length']
		.map((k) => parts[k])
		.filter(Boolean)
		.map((p) => toCm(p.value, p.unit))
		.filter((n) => Number.isFinite(n) && n > 0)
		.sort((a, b) => b - a);
	const round1 = (n) => String(Math.round(n * 10) / 10);
	const book_size = linear.length >= 2 ? `${round1(linear[0])} × ${round1(linear[1])} cm` : '';
	const weight_grams =
		parts.weight && Number.isFinite(parts.weight.value)
			? Math.round(toGrams(parts.weight.value, parts.weight.unit))
			: '';
	return { book_size, weight_grams };
}

// Map an ISBNdb `book` object onto the `books` collection's REAL field names.
// Localized fields go in their `_es` column (the storefront accessor falls
// back to `_es`; `_de` stays an owner task — ISBNdb data is single-language).
// `publisher`/`language` are relations and `cover` is a file: they carry the
// raw ISBNdb name/code/URL here for the owner to review; the push script
// matches them against EXISTING prod taxonomy only (never creates — ISBNdb
// publisher spellings are too messy to mint records from) and downloads the
// cover. `price` is required by the schema and ISBNdb has no CHF price, so it
// ships null — fill it in during review or the push script refuses the book.
// `stock` ships 0: push first, then re-run sync-stock --apply to set tallies.
function toPB(book) {
	const yearMatch = (book.date_published || '').match(/\d{4}/);
	const { book_size, weight_grams } = measurementsToPB(book);
	return {
		slug: slugify(book.title),
		title: book.title || book.title_long || '',
		author: (book.authors || []).join(', '),
		ISBN: book.isbn13 || book.isbn || '',
		price: 1,
		stock: 0,
		format_es: book.binding || '',
		page_count: book.pages ?? null,
		book_size,
		weight_grams,
		publication_year: yearMatch ? parseInt(yearMatch[0], 10) : null,
		description_es: book.synopsis || book.overview || '',
		publisher: book.publisher || '',
		language: book.language || '',
		cover: book.image_original || book.image || ''
	};
}

// --- input + cache -----------------------------------------------------------
const isbns = [
	...new Set(
		readFileSync(inputPath, 'utf8')
			.split(/\r?\n/)
			.map((l) => normalizeISBN(l.trim()))
			.filter(Boolean)
	)
];
const invalid = isbns.filter((i) => !isISBNish(i));

const cache = existsSync(OUT_PATH)
	? JSON.parse(readFileSync(OUT_PATH, 'utf8'))
	: { books: {}, not_found: [], errors: {} };
cache.not_found = cache.not_found || [];
cache.errors = cache.errors || {};

const save = () => writeFileSync(OUT_PATH, JSON.stringify(cache, null, '\t') + '\n');

const pending = isbns.filter((i) => {
	if (!isISBNish(i)) return false;
	if (cache.books[i]) return false;
	if (cache.not_found.includes(i) && !RETRY_NOT_FOUND) return false;
	return true;
});

console.log(`Input: ${isbns.length} distinct ISBN(s) from ${inputPath}`);
if (invalid.length)
	console.log(`Skipping ${invalid.length} invalid line(s): ${invalid.join(', ')}`);
console.log(
	`Cached: ${Object.keys(cache.books).length} found, ${cache.not_found.length} not-found. Fetching: ${pending.length}.`
);

// --- fetch loop ----------------------------------------------------------------
let n = 0;
for (const isbn of pending) {
	n++;
	// Errors from a previous run get retried now; forget the stale record.
	delete cache.errors[isbn];

	let res;
	try {
		res = await fetch(`${BASE_URL}/book/${isbn}`, { headers: { Authorization: API_KEY } });
	} catch (e) {
		console.error(`  [${n}/${pending.length}] ${isbn} network error: ${e.message}`);
		cache.errors[isbn] = String(e.message);
		save();
		await sleep(DELAY_MS);
		continue;
	}

	if (res.status === 401 || res.status === 403) {
		console.error(
			`API key rejected (HTTP ${res.status}). Aborting — progress so far is saved in ${OUT_PATH}.`
		);
		save();
		process.exit(1);
	}
	if (res.status === 429) {
		console.log(`  [${n}/${pending.length}] ${isbn} rate-limited, waiting 10s and retrying once…`);
		await sleep(10_000);
		res = await fetch(`${BASE_URL}/book/${isbn}`, { headers: { Authorization: API_KEY } });
	}

	if (res.status === 404) {
		if (!cache.not_found.includes(isbn)) cache.not_found.push(isbn);
		console.log(
			`  [${n}/${pending.length}] ${isbn} NOT FOUND (ISBNdb may add it within ~24h; --retry-not-found later)`
		);
	} else if (res.ok) {
		const { book } = await res.json();
		cache.books[isbn] = { fetched_at: new Date().toISOString(), pb: toPB(book), raw: book };
		cache.not_found = cache.not_found.filter((i) => i !== isbn);
		console.log(
			`  [${n}/${pending.length}] ${isbn} ✓ "${book.title}" — ${(book.authors || []).join(', ') || '(no author)'}`
		);
	} else {
		cache.errors[isbn] = `HTTP ${res.status}`;
		console.error(`  [${n}/${pending.length}] ${isbn} HTTP ${res.status}`);
	}

	save(); // after every request: an abort loses nothing
	if (n < pending.length) await sleep(DELAY_MS);
}

// --- summary -------------------------------------------------------------------
const errCount = Object.keys(cache.errors).length;
console.log(
	`\nDone. ${OUT_PATH}: ${Object.keys(cache.books).length} book(s), ${cache.not_found.length} not-found, ${errCount} error(s).`
);
if (cache.not_found.length) console.log(`Not found: ${cache.not_found.join(', ')}`);
if (errCount)
	console.log(
		'Errors (re-run to retry): ' +
			Object.entries(cache.errors)
				.map(([i, e]) => `${i} (${e})`)
				.join(', ')
	);
console.log('\nReview the `pb` objects in the JSON (title/description/etc. are ISBNdb data,');
console.log('often English-flavoured) before building the push step.');
