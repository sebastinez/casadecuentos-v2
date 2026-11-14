#!/usr/bin/env node
/**
 * Event RSVP list → printable PDF (attendance sheet for the door).
 *
 * Fetches the event by slug, then every `rsvps` row pointing at it (oldest
 * first), and renders an A4-landscape table: child, age, booking adult, phone,
 * email and an empty check-box column to tick off arrivals. Favourite books /
 * comments, when present, go on a grey line under the row.
 *
 * `rsvps` is fully closed (every rule null), so this needs superuser creds.
 * Read-only: it never writes to PocketBase.
 *
 * Usage:
 *   POCKETBASE_URL=https://pb.casadecuentos.ch \
 *   POCKETBASE_ADMIN_EMAIL=admin@casadecuentos.ch \
 *   POCKETBASE_ADMIN_PASSWORD='<prod superuser password>' \
 *   node scripts/rsvp-pdf.mjs <event-slug> [--out file.pdf]
 *
 * Without a slug (or with an unknown one) it prints the available event slugs.
 */

import PocketBase from 'pocketbase';
import PDFDocument from 'pdfkit';
import { createWriteStream } from 'node:fs';

// --- CLI args ---------------------------------------------------------------
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outArg = outIdx !== -1 ? args[outIdx + 1] : undefined;
const slug = args.find((a, i) => !a.startsWith('--') && i !== outIdx + 1);

const PB_URL = process.env.POCKETBASE_URL || 'https://pb.casadecuentos.ch';
const ADMIN_EMAIL = process.env.POCKETBASE_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
	console.error('Missing POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD env vars.');
	process.exit(1);
}

const pb = new PocketBase(PB_URL);
pb.autoCancellation(false);
await pb.collection('_superusers').authWithPassword(ADMIN_EMAIL, ADMIN_PASSWORD);

async function printSlugs() {
	const events = await pb.collection('events').getFullList({ sort: '-date,-time' });
	console.error('Available events:');
	for (const e of events) console.error(`  ${e.slug.padEnd(40)} ${e.date} ${e.time}  ${e.title}`);
}

if (!slug) {
	console.error('Usage: node scripts/rsvp-pdf.mjs <event-slug> [--out file.pdf]\n');
	await printSlugs();
	process.exit(1);
}

// --- Fetch ------------------------------------------------------------------
let event;
try {
	event = await pb.collection('events').getFirstListItem(pb.filter('slug = {:slug}', { slug }));
} catch (err) {
	if (err?.status !== 404) throw err;
	console.error(`No event with slug "${slug}".\n`);
	await printSlugs();
	process.exit(1);
}

const rsvps = await pb.collection('rsvps').getFullList({
	filter: pb.filter('event = {:id}', { id: event.id }),
	sort: 'created'
});

// --- Formatting helpers -----------------------------------------------------
// `date` is a Zurich wall-clock `YYYY-MM-DD` string; format it as a civil date
// in UTC so no timezone shift can move it a day.
const longDate = new Date(`${event.date}T00:00:00Z`).toLocaleDateString('es-ES', {
	weekday: 'long',
	day: 'numeric',
	month: 'long',
	year: 'numeric',
	timeZone: 'UTC'
});
const generatedAt = new Date().toLocaleString('es-ES', {
	dateStyle: 'short',
	timeStyle: 'short',
	timeZone: 'Europe/Zurich'
});

// --- PDF layout -------------------------------------------------------------
const outPath = outArg || `rsvps-${slug}.pdf`;
const doc = new PDFDocument({
	size: 'A4',
	layout: 'landscape',
	margins: { top: 36, bottom: 36, left: 36, right: 36 },
	bufferPages: true, // needed for "Página x de y" footers
	info: { Title: `RSVPs – ${event.title}`, Author: 'Casa de Cuentos' }
});
doc.pipe(createWriteStream(outPath));

const LEFT = doc.page.margins.left;
const WIDTH = doc.page.width - LEFT - doc.page.margins.right;
const BOTTOM = doc.page.height - doc.page.margins.bottom - 20; // room for footer
const PAD = 4;
const FONT = 'Helvetica';
const BOLD = 'Helvetica-Bold';
const ITALIC = 'Helvetica-Oblique';
const SIZE = 9.5;

// Widths sum to WIDTH (770pt on A4 landscape with 36pt margins).
const columns = [
	{ key: 'n', label: '#', width: 26 },
	{ key: 'child', label: 'Niño/a', width: 150 },
	{ key: 'age', label: 'Edad', width: 70 },
	{ key: 'adult', label: 'Adulto/a', width: 160 },
	{ key: 'phone', label: 'Teléfono', width: 110 },
	{ key: 'email', label: 'Email', width: WIDTH - 26 - 150 - 70 - 160 - 110 - 40 },
	{ key: 'check', label: 'Llegó', width: 40 }
];

// Header block (first page only).
doc.font(BOLD).fontSize(18).fillColor('#111').text(event.title, LEFT, doc.page.margins.top, {
	width: WIDTH
});
doc
	.font(FONT)
	.fontSize(11)
	.fillColor('#444')
	.text(`${longDate} · ${event.time} h${event.venue_address ? ` · ${event.venue_address}` : ''}`, {
		width: WIDTH
	});
doc.moveDown(0.3);
doc
	.font(BOLD)
	.fontSize(11)
	.fillColor('#111')
	.text(`${rsvps.length} ${rsvps.length === 1 ? 'inscripción' : 'inscripciones'}`);
doc.moveDown(0.8);

let y = doc.y;

function drawHeaderRow() {
	const h = SIZE + PAD * 2 + 2;
	doc.rect(LEFT, y, WIDTH, h).fill('#2b2b2b');
	let x = LEFT;
	doc.font(BOLD).fontSize(SIZE).fillColor('#fff');
	for (const c of columns) {
		doc.text(c.label, x + PAD, y + PAD + 1, { width: c.width - PAD * 2, lineBreak: false });
		x += c.width;
	}
	y += h;
}

function cellValues(r, i) {
	return {
		n: String(i + 1),
		child: r.child_name || '—',
		age: r.child_age || '—',
		adult: `${r.name} ${r.family_name}`.trim(),
		phone: r.phone || '',
		email: r.email || '',
		check: ''
	};
}

function notesText(r) {
	const parts = [];
	if (r.favorite_books?.trim()) parts.push(`Libros favoritos: ${r.favorite_books.trim()}`);
	if (r.comments?.trim()) parts.push(`Comentarios: ${r.comments.trim()}`);
	return parts.join('   ·   ');
}

// Notes span from the "Niño/a" column to the end of the row.
const NOTES_X = LEFT + columns[0].width;
const NOTES_W = WIDTH - columns[0].width;

drawHeaderRow();

if (rsvps.length === 0) {
	doc
		.font(ITALIC)
		.fontSize(SIZE)
		.fillColor('#666')
		.text('Nadie se ha inscrito todavía.', LEFT + PAD, y + PAD * 2);
}

rsvps.forEach((r, i) => {
	const values = cellValues(r, i);
	const notes = notesText(r);

	// Measure the row before drawing it, so it never splits across pages.
	// Measure each cell in the font it's drawn with (the child column is bold).
	const mainH =
		Math.max(
			...columns.map((c) =>
				doc
					.font(c.key === 'child' ? BOLD : FONT)
					.fontSize(SIZE)
					.heightOfString(values[c.key] || ' ', { width: c.width - PAD * 2 })
			)
		) +
		PAD * 2;
	doc.font(ITALIC).fontSize(SIZE - 1);
	const notesH = notes ? doc.heightOfString(notes, { width: NOTES_W - PAD * 2 }) + PAD : 0;
	const rowH = mainH + notesH;

	if (y + rowH > BOTTOM) {
		doc.addPage();
		y = doc.page.margins.top;
		drawHeaderRow();
	}

	if (i % 2 === 1) doc.rect(LEFT, y, WIDTH, rowH).fill('#f3f1ec');

	let x = LEFT;
	for (const c of columns) {
		if (c.key === 'check') {
			const s = 11;
			doc
				.lineWidth(0.8)
				.strokeColor('#444')
				.rect(x + (c.width - s) / 2, y + PAD, s, s)
				.stroke();
		} else {
			doc
				.font(c.key === 'child' ? BOLD : FONT)
				.fontSize(SIZE)
				.fillColor(c.key === 'n' ? '#888' : '#111')
				.text(values[c.key], x + PAD, y + PAD, { width: c.width - PAD * 2 });
		}
		x += c.width;
	}

	if (notes) {
		doc
			.font(ITALIC)
			.fontSize(SIZE - 1)
			.fillColor('#555')
			.text(notes, NOTES_X + PAD, y + mainH - PAD / 2, { width: NOTES_W - PAD * 2 });
	}

	y += rowH;
	doc
		.moveTo(LEFT, y)
		.lineTo(LEFT + WIDTH, y)
		.lineWidth(0.4)
		.strokeColor('#ccc')
		.stroke();
});

// Footers on every page.
const range = doc.bufferedPageRange();
for (let p = range.start; p < range.start + range.count; p++) {
	doc.switchToPage(p);
	const fy = doc.page.height - doc.page.margins.bottom - 10;
	// Zero the bottom margin while writing so pdfkit doesn't auto-add a page.
	const savedBottom = doc.page.margins.bottom;
	doc.page.margins.bottom = 0;
	doc
		.font(FONT)
		.fontSize(8)
		.fillColor('#888')
		.text(`Casa de Cuentos · ${event.title} · generado ${generatedAt}`, LEFT, fy, {
			width: WIDTH,
			lineBreak: false
		})
		.text(`Página ${p - range.start + 1} de ${range.count}`, LEFT, fy, {
			width: WIDTH,
			align: 'right',
			lineBreak: false
		});
	doc.page.margins.bottom = savedBottom;
}

doc.end();
console.log(
	`${rsvps.length} RSVPs for "${event.title}" (${event.date} ${event.time}) → ${outPath}`
);
