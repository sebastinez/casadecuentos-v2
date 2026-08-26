import { t, type Locale } from '$lib/i18n';
import { site } from '$lib/site';

// Shared branded email shell — the header/card/footer chrome of the order
// confirmation (`order-confirmation.ts`), generalised so any transactional mail
// can render label/value detail sections in the same skin.
//
// `order-confirmation.ts` predates this module and keeps its own copy: its body is
// a line-item + totals table, not detail rows, and it is the mail a paying customer
// receives — not worth re-verifying against a live template for a cosmetic dedupe.
// It stays the visual source of truth; the palette and card metrics here are copied
// from it verbatim, so a change there should be mirrored here.
//
// Both bodies are generated from ONE options object (`brandedEmailHtml` +
// `brandedEmailText`), so the plain-text part cannot silently drift from the HTML.

// Brand palette (terracotta on cream). Styling is inline + table-based only —
// the one thing email clients (Gmail, Outlook, Apple Mail) render reliably: no
// <style> blocks, no flexbox, no rem units.
const accent = '#8b4733'; // terracotta-700 (wordmark)
const ink = '#1c1917'; // gray-900
const muted = '#57534e'; // gray-600
const hairline = '#e8caba'; // terracotta-200
const cream = '#faf4f1'; // terracotta-50
const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

// Brand logo on the dedicated static-asset host (Caddy file_server, see
// deploy/Caddyfile). URL is deliberately stable — decoupled from build hashes and
// the `assets.` subdomain survives the preview → live cutover. alt text carries
// the brand if the image is blocked (webp also doesn't render in Outlook/Windows).
const logoUrl = 'https://assets.casadecuentos.ch/logo.webp';

// Escape HTML metacharacters. The shell escapes EVERY string it renders — headings,
// paragraphs, labels and values alike. Callers therefore pass raw text and never
// need to know which of their inputs is attacker-controlled (an RSVP name) and which
// is owner-entered (an event title). The i18n tables hold plain prose with no markup,
// so escaping trusted copy costs nothing.
export function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export interface DetailRow {
	label: string;
	// Empty values are dropped, so an unset venue or a skipped optional form field
	// leaves no orphaned label behind.
	value: string;
}

export interface DetailSection {
	heading: string;
	rows: DetailRow[];
}

export interface BrandedEmail {
	locale: Locale;
	// Small uppercase line opposite the logo — what this mail IS, at a glance.
	eyebrow: string;
	// The h1.
	heading: string;
	// Lead paragraphs under the heading.
	intro: string[];
	sections: DetailSection[];
	// Trailing paragraphs (closing line, signature).
	closing?: string[];
	// When true, render the "questions? write to info@" footer band. Off for mail
	// addressed to the owner — pointing them at their own inbox is noise.
	showHelpFooter?: boolean;
}

// Drop empty rows, then drop sections left with nothing in them.
function populatedSections(sections: DetailSection[]): DetailSection[] {
	return sections
		.map((section) => ({ ...section, rows: section.rows.filter((row) => !!row.value) }))
		.filter((section) => section.rows.length > 0);
}

// Plain-text mirror of the HTML body. This is the canonical content: every row the
// card shows appears here as a `Label: value` line, under its section heading.
export function brandedEmailText(email: BrandedEmail): string {
	const blocks: string[] = [email.heading, ...email.intro];

	for (const section of populatedSections(email.sections)) {
		blocks.push(
			[section.heading, ...section.rows.map((row) => `${row.label}: ${row.value}`)].join('\n')
		);
	}

	if (email.closing?.length) blocks.push(email.closing.join('\n'));

	return blocks.join('\n\n');
}

// One detail row: label left (muted, narrow, top-aligned), value right in the reading
// column. Unlike the order email's line items the value is left-aligned and wraps —
// an address or a comment is prose, not a price. `pre-wrap` keeps a multi-line
// textarea answer readable.
function rowHtml(row: DetailRow, isFirst: boolean): string {
	const border = isFirst ? '' : `border-top:1px solid ${hairline};`;
	return (
		`<tr>` +
		`<td style="padding:10px 12px 10px 0;font-size:13px;line-height:1.5;color:${muted};vertical-align:top;white-space:nowrap;${border}">` +
		`${escapeHtml(row.label)}</td>` +
		`<td style="padding:10px 0;font-size:15px;line-height:1.5;color:${ink};vertical-align:top;white-space:pre-wrap;${border}">` +
		`${escapeHtml(row.value)}</td>` +
		`</tr>`
	);
}

function sectionHtml(section: DetailSection): string {
	const rows = section.rows.map((row, i) => rowHtml(row, i === 0)).join('');
	return (
		`<tr><td style="padding:24px 32px 0;">` +
		`<h2 style="margin:0 0 4px;font-size:16px;font-weight:700;color:${ink};">${escapeHtml(section.heading)}</h2>` +
		`<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>` +
		`</td></tr>`
	);
}

export function brandedEmailHtml(email: BrandedEmail): string {
	const { locale } = email;

	const introHtml = email.intro
		.map(
			(paragraph) =>
				`<p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:${muted};">${escapeHtml(paragraph)}</p>`
		)
		.join('');

	const sectionsHtml = populatedSections(email.sections).map(sectionHtml).join('');

	const closingHtml = email.closing?.length
		? `<tr><td style="padding:28px 32px 28px;">` +
			email.closing
				.map(
					(paragraph) =>
						`<p style="margin:0 0 4px;font-size:15px;line-height:1.6;color:${muted};">${escapeHtml(paragraph)}</p>`
				)
				.join('') +
			`</td></tr>`
		: '';

	const footerHtml = email.showHelpFooter
		? `<tr><td style="padding:20px 32px;background:${cream};border-top:1px solid ${hairline};">` +
			`<p style="margin:0;font-size:13px;line-height:1.6;color:${muted};">${t('email.confirm.help', locale)} ` +
			`<a href="mailto:${site.email}" style="color:${accent};text-decoration:none;">${site.email}</a>.</p>` +
			`</td></tr>`
		: '';

	return `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:${cream};">
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${cream};">
		<tr><td align="center" style="padding:32px 16px;">
			<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#ffffff;border:1px solid ${hairline};border-radius:12px;overflow:hidden;font-family:${font};">
				<!-- Header: wordmark + what this mail is -->
				<tr><td style="padding:28px 32px;border-bottom:1px solid ${hairline};">
					<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
						<td style="vertical-align:middle;"><img src="${logoUrl}" alt="${escapeHtml(t('email.confirm.signature', locale))}" width="56" height="56" style="display:block;width:56px;height:56px;border:0;"/></td>
						<td style="text-align:right;vertical-align:middle;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:${muted};">${escapeHtml(email.eyebrow)}</td>
					</tr></table>
				</td></tr>
				<!-- Heading + intro -->
				<tr><td style="padding:32px 32px 8px;">
					<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${ink};">${escapeHtml(email.heading)}</h1>
					${introHtml}
				</td></tr>
				<!-- Detail sections -->
				${sectionsHtml}
				<!-- Closing + footer -->
				${closingHtml}
				${footerHtml}
			</table>
		</td></tr>
	</table>
</body>
</html>`;
}
