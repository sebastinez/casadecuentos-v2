#!/usr/bin/env node
/**
 * Read-only data-health audit of the production PocketBase.
 *
 * Part 1 — ISBN audit of `books` (ahead of the physical inventory sync):
 *   - books with an empty ISBN (these can't be matched by barcode scan)
 *   - duplicate ISBN groups (a scanned barcode would match >1 record)
 *   - ISBNs that don't look like an EAN-13/ISBN-13 (a scanner will never
 *     produce them, e.g. ISBN-10s, typos, stray hyphens/spaces)
 *
 * Part 2 — field completeness for EVERY base collection: the schema is read
 * from PocketBase itself, so new fields are picked up automatically. For each
 * field (required or not) it reports how many records have it empty, then
 * lists which records miss what. Deliberately opinion-free: `_de` columns
 * showing up as mostly-empty is expected (German content is an owner task) —
 * this is a health overview, not a to-do list.
 *
 * Not audited: bool fields (false is a value), autodate fields, auth/system
 * collections, and number 0 counts as filled (stock=0 is real data).
 *
 * Makes zero writes. Same credentials convention as the other scripts:
 *
 *   POCKETBASE_URL=https://pb.casadecuentos.ch \
 *   POCKETBASE_ADMIN_EMAIL=admin@casadecuentos.ch \
 *   POCKETBASE_ADMIN_PASSWORD='<prod superuser password>' \
 *   node scripts/audit-isbn.mjs [collection ...]   (default: all base collections)
 */

import PocketBase from 'pocketbase';

const onlyCollections = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const PB_URL = process.env.POCKETBASE_URL || 'https://pb.casadecuentos.ch';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
	console.error('Missing POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD env vars.');
	process.exit(1);
}

// Scanners emit bare digit strings; normalise the DB side the same way so
// "978-84-88342-28-7" and "9788488342287" collide as duplicates.
const normalizeISBN = (raw) => (raw || '').replace(/[^0-9Xx]/g, '').toUpperCase();

function isValidEAN13(digits) {
	if (!/^\d{13}$/.test(digits)) return false;
	const sum = [...digits]
		.slice(0, 12)
		.reduce((acc, d, i) => acc + Number(d) * (i % 2 === 0 ? 1 : 3), 0);
	return (10 - (sum % 10)) % 10 === Number(digits[12]);
}

const pb = new PocketBase(PB_URL);
await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

// =============================== Part 1: ISBN ================================
const books = await pb.collection('books').getFullList({
	fields: 'id,slug,title,ISBN,stock',
	sort: 'slug',
	requestKey: null
});

const missing = books.filter((b) => !normalizeISBN(b.ISBN));
const withISBN = books.filter((b) => normalizeISBN(b.ISBN));

const byISBN = new Map();
for (const b of withISBN) {
	const key = normalizeISBN(b.ISBN);
	if (!byISBN.has(key)) byISBN.set(key, []);
	byISBN.get(key).push(b);
}
const duplicates = [...byISBN.entries()].filter(([, group]) => group.length > 1);
const nonEAN13 = withISBN.filter((b) => !isValidEAN13(normalizeISBN(b.ISBN)));

console.log('================ ISBN audit (books) ================');
console.log(`Total books:            ${books.length}`);
console.log(`With ISBN:              ${withISBN.length}`);
console.log(`Missing ISBN:           ${missing.length}`);
console.log(`Duplicate ISBN groups:  ${duplicates.length}`);
console.log(`Non-EAN-13 ISBNs:       ${nonEAN13.length}`);

if (missing.length) {
	console.log('\n-- Missing ISBN (unmatchable by barcode) --');
	for (const b of missing) console.log(`  ${b.slug}  "${b.title}"  stock=${b.stock ?? 0}`);
}
if (duplicates.length) {
	console.log('\n-- Duplicate ISBNs (a scan would match several records) --');
	for (const [isbn, group] of duplicates) {
		console.log(`  ${isbn}:`);
		for (const b of group) console.log(`    ${b.slug}  "${b.title}"  stock=${b.stock ?? 0}`);
	}
}
if (nonEAN13.length) {
	console.log('\n-- ISBNs a scanner will never emit (not valid EAN-13) --');
	for (const b of nonEAN13) console.log(`  ${b.slug}  ISBN="${b.ISBN}"  "${b.title}"`);
}

// ========================= Part 2: field completeness =========================
// A field counts as empty on '', null, undefined, or an empty array (multi
// relations/files/selects). 0 and false are real values.
const isEmpty = (v) =>
	v === '' || v === null || v === undefined || (Array.isArray(v) && v.length === 0);

// Prefer a human-recognisable handle for a record in the detail lines.
const label = (r) => r.slug || r.name || r.name_es || r.title || r.title_es || r.email || r.id;

const allCollections = await pb.collections.getFullList({ requestKey: null });
const auditable = allCollections.filter(
	(c) =>
		c.type === 'base' &&
		!c.system &&
		(onlyCollections.length === 0 || onlyCollections.includes(c.name))
);

console.log('\n================ Field completeness ================');
for (const collection of auditable) {
	// PB ≥0.23 exposes `fields`; older exports used `schema`.
	const fields = (collection.fields || collection.schema || []).filter(
		(f) => !f.system && !f.hidden && f.type !== 'autodate' && f.type !== 'bool'
	);
	const records = await pb.collection(collection.name).getFullList({ requestKey: null });

	console.log(`\n== ${collection.name} (${records.length} record(s)) ==`);
	if (!records.length) continue;

	const width = Math.max(...fields.map((f) => f.name.length), 5);
	for (const f of fields) {
		const empty = records.filter((r) => isEmpty(r[f.name])).length;
		const note = empty === 0 ? 'OK' : `${empty} missing${f.required ? '  (REQUIRED!)' : ''}`;
		console.log(
			`  ${f.name.padEnd(width)}  ${String(records.length - empty).padStart(4)}/${records.length}  ${note}`
		);
	}

	const gaps = records
		.map((r) => ({ r, miss: fields.filter((f) => isEmpty(r[f.name])).map((f) => f.name) }))
		.filter(({ miss }) => miss.length);
	if (gaps.length) {
		console.log(`  -- ${gaps.length} record(s) with gaps --`);
		for (const { r, miss } of gaps) console.log(`    ${label(r)}: ${miss.join(', ')}`);
	}
}
