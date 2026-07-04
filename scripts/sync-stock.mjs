#!/usr/bin/env node
/**
 * Physical inventory → PocketBase `books.stock` sync.
 *
 * Input is a text file exported from the barcode scanner app, ONE EAN-13 PER
 * LINE, one line per physical copy (hand-typed EANs for barcode-less books
 * are fine — every line is checksum-validated, so a typo'd digit is caught
 * instead of silently matching nothing).
 *
 * Two modes:
 *   default   PARTIAL — only books whose EAN appears in the scan file are
 *             checked/updated; everything else in prod is left untouched.
 *             For spot checks and new-arrival top-ups.
 *   --all     FULL COUNT (the 2026-07-04 inventory semantics) — the scan is
 *             treated as a complete count of the single location, so a book
 *             in prod that was never scanned goes to stock = 0.
 *
 * In both modes:
 *   - matched book            → stock = number of times its EAN appears
 *   - scan matching no record → "unmatched" report, resolve by hand in admin
 *
 * Dry-run by default: prints the full diff and writes NOTHING. Re-run with
 * --apply (same day as the scan!) to write. The script warns when a book's
 * `updated` is newer than the scan file's mtime — that means something
 * (likely an order) touched it after you counted; recount those.
 *
 * Aborts before writing if any two books share a normalised ISBN — a scan
 * would be ambiguous. (scripts/audit-isbn.mjs reported zero of these.)
 *
 * Usage:
 *   POCKETBASE_URL=https://pb.casadecuentos.ch \
 *   POCKETBASE_ADMIN_EMAIL=admin@casadecuentos.ch \
 *   POCKETBASE_ADMIN_PASSWORD='<prod superuser password>' \
 *   node scripts/sync-stock.mjs scans.txt [--all] [--apply]
 */

import PocketBase from 'pocketbase';
import { readFileSync, statSync } from 'node:fs';

// --- CLI args ---------------------------------------------------------------
const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ALL = args.includes('--all');
const scanPath = args.find((a) => !a.startsWith('--'));
if (!scanPath) {
	console.error('Usage: node scripts/sync-stock.mjs <scans.txt> [--all] [--apply]');
	process.exit(1);
}

const PB_URL = process.env.POCKETBASE_URL || 'https://pb.casadecuentos.ch';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
	console.error('Missing POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD env vars.');
	process.exit(1);
}

// --- EAN handling (same normalisation as audit-isbn.mjs) --------------------
const normalizeISBN = (raw) => (raw || '').replace(/[^0-9Xx]/g, '').toUpperCase();

function isValidEAN13(digits) {
	if (!/^\d{13}$/.test(digits)) return false;
	const sum = [...digits]
		.slice(0, 12)
		.reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
	return (10 - (sum % 10)) % 10 === Number(digits[12]);
}

// --- read + tally the scan file ----------------------------------------------
const scanMtime = statSync(scanPath).mtime;
const lines = readFileSync(scanPath, 'utf8')
	.split(/\r?\n/)
	.map((l) => normalizeISBN(l.trim()))
	.filter(Boolean);

const badLines = lines.filter((l) => !isValidEAN13(l));
const counts = new Map();
for (const ean of lines) {
	if (!isValidEAN13(ean)) continue;
	counts.set(ean, (counts.get(ean) || 0) + 1);
}

console.log(`Scan file: ${scanPath} (saved ${scanMtime.toISOString()})`);
console.log(`Scanned lines: ${lines.length} copies, ${counts.size} distinct EANs`);
console.log(
	ALL
		? 'Mode: FULL COUNT (--all) — books in prod that were never scanned go to stock 0.'
		: 'Mode: partial — only the scanned EANs are checked; everything else is untouched (--all for a full count).'
);

if (badLines.length) {
	console.log(`\n-- ${badLines.length} line(s) are NOT valid EAN-13 (typo?) — ignored --`);
	for (const l of [...new Set(badLines)]) console.log(`  ${l}`);
}

// --- fetch prod books ---------------------------------------------------------
const pb = new PocketBase(PB_URL);
await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

const books = await pb.collection('books').getFullList({
	fields: 'id,slug,title,ISBN,stock,updated',
	sort: 'slug',
	requestKey: null
});

const byISBN = new Map();
let ambiguous = false;
for (const b of books) {
	const key = normalizeISBN(b.ISBN);
	if (!key) continue;
	if (byISBN.has(key)) {
		console.error(`DUPLICATE ISBN ${key}: "${byISBN.get(key).slug}" and "${b.slug}"`);
		ambiguous = true;
	}
	byISBN.set(key, b);
}
if (ambiguous) {
	console.error('Refusing to sync while scans would be ambiguous. Fix the ISBNs and re-run.');
	process.exit(1);
}

// --- bucket + diff -------------------------------------------------------------
const changes = []; // { book, counted }
const unchanged = [];
const toZero = [];
const unmatched = []; // [ean, qty]
const noISBN = books.filter((b) => !normalizeISBN(b.ISBN));
const touchedAfterScan = [];

for (const [ean, qty] of counts) {
	if (!byISBN.has(ean)) unmatched.push([ean, qty]);
}
for (const b of books) {
	const key = normalizeISBN(b.ISBN);
	if (!key) continue; // can't be counted by scan; listed separately below
	if (!ALL && !counts.has(key)) continue; // partial mode: unscanned books are out of scope
	const counted = counts.get(key) ?? 0;
	const current = b.stock ?? 0;
	if (new Date(b.updated) > scanMtime) touchedAfterScan.push(b);
	if (counted === current) unchanged.push(b);
	else if (counted === 0) toZero.push(b);
	else changes.push({ book: b, counted });
}

const row = (b, counted) =>
	`  ${b.slug.padEnd(40)} ${String(b.stock ?? 0).padStart(4)} → ${String(counted).padStart(4)}  "${b.title}"`;

if (changes.length) {
	console.log(`\n-- ${changes.length} book(s) change stock --`);
	for (const { book, counted } of changes) console.log(row(book, counted));
}

if (toZero.length) {
	console.log(`\n!! ${toZero.length} book(s) were NEVER SCANNED and would go to ZERO !!`);
	console.log('!! They will disappear from /libros. Sure you have none of these? !!');
	for (const b of toZero) console.log(row(b, 0));
}

if (unmatched.length) {
	console.log(`\n-- ${unmatched.length} scanned EAN(s) match NO book in prod (not written) --`);
	for (const [ean, qty] of unmatched) console.log(`  ${ean}  x${qty}`);
}

// Only relevant when the scan claims to be a complete count.
if (ALL && noISBN.length) {
	console.log(
		`\n-- ${noISBN.length} book(s) have no ISBN — invisible to this sync, verify by hand --`
	);
	for (const b of noISBN) console.log(`  ${b.slug}  stock=${b.stock ?? 0}  "${b.title}"`);
}

if (touchedAfterScan.length) {
	console.log(
		`\n!! ${touchedAfterScan.length} book(s) were UPDATED AFTER the scan file was saved !!`
	);
	console.log('!! Possibly sold since you counted — recount these before trusting the diff. !!');
	for (const b of touchedAfterScan) console.log(`  ${b.slug}  (updated ${b.updated})`);
}

console.log(`\nUnchanged: ${unchanged.length}. To update: ${changes.length + toZero.length}.`);

if (!APPLY) {
	console.log('\nDry run — nothing written. Re-run with --apply to write the above.');
	process.exit(0);
}

// --- apply (sequential on purpose: PB SDK autocancels parallel same-collection calls)
let written = 0;
for (const { book, counted } of [...changes, ...toZero.map((b) => ({ book: b, counted: 0 }))]) {
	await pb.collection('books').update(book.id, { stock: counted }, { requestKey: null });
	written++;
	console.log(`~ ${book.slug}: stock=${counted}`);
}
console.log(`\nDone. ${written} book(s) updated.`);
