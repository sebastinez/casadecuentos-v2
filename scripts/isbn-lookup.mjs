#!/usr/bin/env node
/**
 * Look up a list of ISBNs in PocketBase `books` and write a CSV.
 *
 * Input: ISBNs as CLI args and/or a text file (any mix of newlines, commas,
 * spaces). Hyphens are ignored, and ISBN-10s are converted to ISBN-13 so they
 * match the EAN-13s we store. Duplicates in the input are collapsed.
 *
 * ISBNs missing from `books` are then looked up on ISBNdb by running
 * scripts/isbndb-fetch.mjs (needs ISBNDB_API_KEY; skipped with a warning if
 * unset, or with --no-isbndb). Results land in its usual cache
 * (scripts/isbndb-books.json, override with --isbndb-cache), so hits are ready
 * for isbndb-push.mjs once a price is set.
 *
 * Output CSV columns: input_isbn, status, title, publisher, isbn, price
 *   status = "found"      in our books (price = our CHF price)
 *          | "isbndb"     not ours, but ISBNdb knows it (no price)
 *          | "not found"  neither (only the input ISBN is kept)
 * If an ISBN matches more than one book, every match gets its own row.
 * The not-found list is also printed to stderr.
 *
 * Read-only. Same credentials convention as the other scripts:
 *
 *   POCKETBASE_URL=https://pb.casadecuentos.ch \
 *   POCKETBASE_ADMIN_EMAIL=admin@casadecuentos.ch \
 *   POCKETBASE_ADMIN_PASSWORD='<prod superuser password>' \
 *   ISBNDB_API_KEY=... \
 *   node scripts/isbn-lookup.mjs [--file isbns.txt] [--out result.csv] \
 *     [--isbndb-cache scripts/isbndb-books.json] [--no-isbndb] [isbn ...]
 */

import PocketBase from 'pocketbase';
import { readFileSync, writeFileSync, existsSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// --- CLI args ---------------------------------------------------------------
const args = process.argv.slice(2);
let filePath = null;
let outPath = 'isbn-lookup.csv';
let isbndbCache = 'scripts/isbndb-books.json';
let SKIP_ISBNDB = false;
const inline = [];
for (let i = 0; i < args.length; i++) {
	if (args[i] === '--file') filePath = args[++i];
	else if (args[i] === '--out') outPath = args[++i];
	else if (args[i] === '--isbndb-cache') isbndbCache = args[++i];
	else if (args[i] === '--no-isbndb') SKIP_ISBNDB = true;
	else inline.push(args[i]);
}

const rawInputs = [...inline];
if (filePath) rawInputs.push(...readFileSync(filePath, 'utf8').split(/[\s,;]+/));
const inputs = [...new Set(rawInputs.map((s) => s.trim()).filter(Boolean))];

if (inputs.length === 0) {
	console.error(
		'Usage: node scripts/isbn-lookup.mjs [--file isbns.txt] [--out result.csv] [--isbndb-cache file] [--no-isbndb] [isbn ...]'
	);
	process.exit(1);
}

const PB_URL = process.env.POCKETBASE_URL || 'https://pb.casadecuentos.ch';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
	console.error('Missing POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD env vars.');
	process.exit(1);
}

// --- ISBN normalisation (same as audit-isbn.mjs, plus ISBN-10 → 13) ----------
const normalizeISBN = (raw) => (raw || '').replace(/[^0-9Xx]/g, '').toUpperCase();

function toISBN13(raw) {
	const d = normalizeISBN(raw);
	if (!/^\d{9}[\dX]$/.test(d)) return d;
	const core = '978' + d.slice(0, 9);
	const sum = [...core].reduce((acc, c, i) => acc + Number(c) * (i % 2 === 0 ? 1 : 3), 0);
	return core + ((10 - (sum % 10)) % 10);
}

// --- Fetch ------------------------------------------------------------------
const pb = new PocketBase(PB_URL);
await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

const books = await pb.collection('books').getFullList({
	fields: 'id,title,ISBN,price,expand.publisher.name',
	expand: 'publisher',
	requestKey: null
});

const byISBN = new Map();
for (const b of books) {
	const key = toISBN13(b.ISBN);
	if (!key) continue;
	if (!byISBN.has(key)) byISBN.set(key, []);
	byISBN.get(key).push(b);
}

// --- Match against PocketBase ------------------------------------------------
const matched = new Map(); // input → books[]
const notFound = [];
for (const input of inputs) {
	const matches = byISBN.get(toISBN13(input));
	if (matches) matched.set(input, matches);
	else notFound.push(input);
}

console.log(`Checked ${inputs.length} ISBNs: ${matched.size} in books, ${notFound.length} not.`);

// --- ISBNdb fallback for the misses -------------------------------------------
// Delegates to isbndb-fetch.mjs (rate limiting, 429 retry, resumable cache) and
// reads its cache back. ISBNs are passed as ISBN-13 so the cache keys line up.
// The cache is the same JSON isbndb-push.mjs consumes, so hits can be pushed
// later after adding a price.
let isbndb = { books: {}, not_found: [] };
if (notFound.length && !SKIP_ISBNDB) {
	if (!process.env.ISBNDB_API_KEY) {
		console.warn('ISBNDB_API_KEY not set — skipping ISBNdb lookup (pass --no-isbndb to silence).');
	} else {
		const listPath = join(mkdtempSync(join(tmpdir(), 'isbn-lookup-')), 'isbns.txt');
		writeFileSync(listPath, notFound.map(toISBN13).join('\n') + '\n');
		console.log(`\nLooking up ${notFound.length} missing ISBN(s) on ISBNdb…`);
		const fetchScript = fileURLToPath(new URL('./isbndb-fetch.mjs', import.meta.url));
		const res = spawnSync(process.execPath, [fetchScript, listPath, '--out', isbndbCache], {
			stdio: 'inherit',
			env: process.env
		});
		if (res.status !== 0)
			console.warn(`isbndb-fetch.mjs exited with ${res.status}; using what it cached.`);
		if (existsSync(isbndbCache)) isbndb = JSON.parse(readFileSync(isbndbCache, 'utf8'));
	}
}

// --- Build CSV --------------------------------------------------------------
const csvCell = (v) => {
	const s = v == null ? '' : String(v);
	return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const rows = [['input_isbn', 'status', 'title', 'publisher', 'isbn', 'price']];
const stillMissing = [];
let isbndbCount = 0;

for (const input of inputs) {
	const matches = matched.get(input);
	if (matches) {
		for (const b of matches) {
			rows.push([
				input,
				'found',
				b.title,
				b.expand?.publisher?.name ?? '',
				b.ISBN,
				typeof b.price === 'number' ? b.price.toFixed(2) : ''
			]);
		}
		continue;
	}
	const hit = isbndb.books?.[toISBN13(input)];
	if (hit) {
		isbndbCount++;
		rows.push([input, 'isbndb', hit.pb.title, hit.pb.publisher, hit.pb.ISBN, '']);
	} else {
		stillMissing.push(input);
		rows.push([input, 'not found', '', '', '', '']);
	}
}

writeFileSync(outPath, rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n');

console.log(
	`\nSummary: ${matched.size} in books, ${isbndbCount} found on ISBNdb, ${stillMissing.length} not found anywhere.`
);
console.log(`Wrote ${outPath}`);
if (stillMissing.length) {
	console.error('\nNot found:');
	for (const isbn of stillMissing) console.error(`  ${isbn}`);
}
