import { t, DEFAULT_LOCALE, type Locale } from '$lib/i18n';
import { site } from '$lib/site';
import type { OrderLine } from '$lib/server/checkout/order';
import type { MailMessage } from './transport';

// Pure builder for the order-confirmation email. Given the paid order's snapshot
// (the same `OrderLine[]` + totals captured at checkout) it renders a Spanish
// `MailMessage`. No I/O and no provider knowledge — so the template is unit-
// testable, and the webhook stays the only place that actually sends. All copy
// flows through the i18n layer (`t`), so a future `de` table localizes the same
// template with no code change (bilingual-ready, per the PRD).

export interface OrderConfirmationData {
	orderNumber: number;
	email: string;
	lines: OrderLine[];
	itemsTotal: number;
	shipping: number;
	total: number;
	currency: string;
}

// Format a plain CHF amount for display (e.g. `24.9` → `CHF 24.90`). Two
// decimals because these are tax-inclusive prices the customer actually paid.
function money(amount: number, currency: string): string {
	return `${currency} ${amount.toFixed(2)}`;
}

// Escape the few characters that would break out of HTML text/attribute
// context. Book titles are owner-entered, but rendering them into an email body
// without escaping would still be an injection footgun — escape defensively.
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export function orderConfirmationEmail(
	data: OrderConfirmationData,
	locale: Locale = DEFAULT_LOCALE
): MailMessage {
	const { orderNumber, email, lines, itemsTotal, shipping, total, currency } = data;

	// Subject carries the order number so it threads/searches well in the inbox.
	const subject = `${t('email.confirm.subject', locale)} #${orderNumber}`;

	// Plain-text body: the canonical content. The HTML version mirrors it.
	const textLines = [
		t('email.confirm.greeting', locale),
		t('email.confirm.intro', locale),
		'',
		`${t('email.confirm.orderNumber', locale)}: #${orderNumber}`,
		'',
		`${t('email.confirm.items', locale)}:`,
		...lines.map((line) => `  ${line.qty}× ${line.title} — ${money(line.lineTotal, currency)}`),
		'',
		`${t('email.confirm.subtotal', locale)}: ${money(itemsTotal, currency)}`,
		`${t('email.confirm.shipping', locale)}: ${money(shipping, currency)}`,
		`${t('email.confirm.total', locale)}: ${money(total, currency)}`,
		'',
		t('email.confirm.closing', locale),
		t('email.confirm.signature', locale)
	];
	const text = textLines.join('\n');

	// Brand palette pulled from the site theme (terracotta on cream) so the email
	// reads as Casa de Cuentos, not a generic transactional notice. All styling is
	// inline + table-based: that's the only thing email clients (Gmail, Outlook,
	// Apple Mail) render reliably — no <style> blocks, no flexbox, no rem units.
	const accent = '#8b4733'; // terracotta-700 (wordmark)
	const ink = '#1c1917'; // gray-900
	const muted = '#57534e'; // gray-600
	const hairline = '#e8caba'; // terracotta-200
	const cream = '#faf4f1'; // terracotta-50
	const font =
		"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

	// Brand logo, served from the dedicated static-asset host (Caddy file_server,
	// see deploy/Caddyfile). This URL is deliberately stable: it is decoupled from
	// the SvelteKit build hashes, and the `assets.` subdomain survives the
	// preview → live cutover, so it needs no touching at go-live. The alt text
	// carries the brand if the image is blocked (webp also doesn't render in
	// Outlook-on-Windows).
	const logoUrl = 'https://assets.casadecuentos.ch/logo.webp';

	// One line item per row: cover-less but with the same shape as the Shopify
	// summary — "title × qty" on the left, the line total right-aligned, a hairline
	// rule between rows.
	const rowsHtml = lines
		.map(
			(line, i) =>
				`<tr>` +
				`<td style="padding:14px 0;font-size:15px;color:${ink};${i > 0 ? `border-top:1px solid ${hairline};` : ''}">` +
				`${escapeHtml(line.title)} <span style="color:${muted};">× ${line.qty}</span></td>` +
				`<td style="padding:14px 0;font-size:15px;color:${ink};text-align:right;white-space:nowrap;${i > 0 ? `border-top:1px solid ${hairline};` : ''}">` +
				`${money(line.lineTotal, currency)}</td>` +
				`</tr>`
		)
		.join('');

	// A subtotal/shipping/total line. The total is emphasised (heavier + accent),
	// matching the Shopify "Gesamt" treatment.
	const summaryRow = (label: string, value: string, emphasis = false): string =>
		`<tr>` +
		`<td style="padding:4px 0;font-size:15px;color:${emphasis ? ink : muted};${emphasis ? 'font-weight:700;padding-top:12px;' : ''}">${label}</td>` +
		`<td style="padding:4px 0;font-size:${emphasis ? '18px' : '15px'};color:${emphasis ? accent : ink};text-align:right;font-weight:${emphasis ? '700' : '600'};${emphasis ? 'padding-top:12px;' : ''}">${value}</td>` +
		`</tr>`;

	const html = `<!doctype html>
<html lang="${locale}">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:0;background:${cream};">
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${cream};">
		<tr><td align="center" style="padding:32px 16px;">
			<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#ffffff;border:1px solid ${hairline};border-radius:12px;overflow:hidden;font-family:${font};">
				<!-- Header: wordmark + order number -->
				<tr><td style="padding:28px 32px;border-bottom:1px solid ${hairline};">
					<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
						<td style="vertical-align:middle;"><img src="${logoUrl}" alt="${t('email.confirm.signature', locale)}" width="56" height="56" style="display:block;width:56px;height:56px;border:0;"/></td>
						<td style="text-align:right;vertical-align:middle;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:${muted};">${t('email.confirm.orderNumber', locale)} #${orderNumber}</td>
					</tr></table>
				</td></tr>
				<!-- Greeting + intro -->
				<tr><td style="padding:32px 32px 8px;">
					<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:${ink};">${t('email.confirm.greeting', locale)}</h1>
					<p style="margin:0;font-size:15px;line-height:1.6;color:${muted};">${t('email.confirm.intro', locale)}</p>
				</td></tr>
				<!-- Order summary -->
				<tr><td style="padding:24px 32px 8px;">
					<h2 style="margin:0 0 4px;font-size:16px;font-weight:700;color:${ink};">${t('email.confirm.orderSummary', locale)}</h2>
					<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rowsHtml}</table>
				</td></tr>
				<!-- Totals -->
				<tr><td style="padding:8px 32px 28px;">
					<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid ${hairline};padding-top:8px;">
						${summaryRow(t('email.confirm.subtotal', locale), money(itemsTotal, currency))}
						${summaryRow(t('email.confirm.shipping', locale), money(shipping, currency))}
						${summaryRow(t('email.confirm.total', locale), money(total, currency), true)}
					</table>
				</td></tr>
				<!-- Closing + footer -->
				<tr><td style="padding:0 32px 28px;">
					<p style="margin:0;font-size:15px;line-height:1.6;color:${muted};">${t('email.confirm.closing', locale)}</p>
				</td></tr>
				<tr><td style="padding:20px 32px;background:${cream};border-top:1px solid ${hairline};">
					<p style="margin:0;font-size:13px;line-height:1.6;color:${muted};">${t('email.confirm.help', locale)} <a href="mailto:${site.email}" style="color:${accent};text-decoration:none;">${site.email}</a>.</p>
				</td></tr>
			</table>
		</td></tr>
	</table>
</body>
</html>`;

	return { to: email, subject, html, text };
}
