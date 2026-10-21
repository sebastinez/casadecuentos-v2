import { t, DEFAULT_LOCALE, type Locale } from '$lib/i18n';
import { site } from '$lib/site';
import type { OrderLine } from '$lib/server/checkout/order';
import type { Urgency } from '$lib/shipping';
import type { MailMessage } from './transport';

// Pure builder for the order-confirmation email: given the paid order's snapshot it
// renders a Spanish `MailMessage`. No I/O and no provider knowledge, so the template
// is unit-testable and the webhook stays the only place that actually sends. All
// copy flows through the i18n layer (`t`), so a future `de` table localizes the same
// template with no code change.

export interface OrderConfirmationData {
	orderNumber: number;
	email: string;
	lines: OrderLine[];
	itemsTotal: number;
	shipping: number;
	total: number;
	currency: string;
	// Delivery tier the customer picked in the cart; names the shipping method.
	urgency: Urgency;
	// The address Stripe collected, as snapshotted onto the order's `shipping_address`
	// JSON column. Deliberately `unknown`: it is provider-shaped, untrusted, and may
	// be absent, so it is narrowed by `toShippingAddress` rather than read field-wise.
	shippingAddress?: unknown;
}

// Provider-neutral postal address — the normalized form the template prints.
export interface ShippingAddress {
	name?: string;
	line1?: string;
	line2?: string;
	postalCode?: string;
	city?: string;
	state?: string;
	country?: string;
}

// Format a plain CHF amount (e.g. `24.9` → `CHF 24.90`); two decimals, tax-inclusive.
function money(amount: number, currency: string): string {
	return `${currency} ${amount.toFixed(2)}`;
}

// Narrow the order's opaque address snapshot to the fields we print. Accepts the
// Stripe-shaped `{ name, address: { line1, postal_code, … } }` blob the webhook
// stores as well as an already-flat object, and returns `null` when nothing
// printable survives — so a missing or empty address drops the block entirely
// instead of rendering "undefined".
export function toShippingAddress(value: unknown): ShippingAddress | null {
	if (!value || typeof value !== 'object') return null;

	const raw = value as Record<string, unknown>;
	const nested = raw.address;
	const addr = (nested && typeof nested === 'object' ? nested : raw) as Record<string, unknown>;

	const str = (v: unknown): string | undefined =>
		typeof v === 'string' && v.trim() !== '' ? v.trim() : undefined;

	const address: ShippingAddress = {
		name: str(raw.name),
		line1: str(addr.line1),
		line2: str(addr.line2),
		postalCode: str(addr.postal_code) ?? str(addr.postalCode),
		city: str(addr.city),
		state: str(addr.state),
		country: str(addr.country)
	};

	return Object.values(address).some((part) => part !== undefined) ? address : null;
}

// The address as printable lines, Swiss convention: recipient, street, postcode +
// city, then region/country. Missing parts collapse, so there are never blank lines.
function addressLines(address: ShippingAddress): string[] {
	const locality = [address.postalCode, address.city].filter(Boolean).join(' ');
	return [
		address.name,
		address.line1,
		address.line2,
		locality,
		address.state,
		address.country
	].filter((line): line is string => Boolean(line));
}

// Escape HTML metacharacters. Titles are owner-entered, but rendering them into an
// email body unescaped would still be an injection footgun.
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
	const { orderNumber, email, lines, itemsTotal, shipping, total, currency, urgency } = data;

	// Subject carries the order number so it threads/searches well in the inbox.
	const subject = `${t('email.confirm.subject', locale)} #${orderNumber}`;

	// The tier label is the same copy the cart's delivery-speed picker shows — one
	// source of truth, so the email can't name the tier differently than the UI did.
	const methodLabel = t(`cart.delivery.${urgency}`, locale);
	const address = toShippingAddress(data.shippingAddress);

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
		`${t('email.confirm.shippingDetails', locale)}:`,
		`${t('email.confirm.shippingMethod', locale)}: ${methodLabel}`,
		// No address on file (Stripe didn't collect one) → omit the block rather
		// than print an empty heading.
		...(address
			? [
					`${t('email.confirm.shippingAddress', locale)}:`,
					...addressLines(address).map((line) => `  ${line}`)
				]
			: []),
		'',
		t('email.confirm.closing', locale),
		t('email.confirm.signature', locale)
	];
	const text = textLines.join('\n');

	// Brand palette (terracotta on cream). Styling is inline + table-based only —
	// the one thing email clients (Gmail, Outlook, Apple Mail) render reliably: no
	// <style> blocks, no flexbox, no rem units.
	const accent = '#8b4733'; // terracotta-700 (wordmark)
	const ink = '#1c1917'; // gray-900
	const muted = '#57534e'; // gray-600
	const hairline = '#e8caba'; // terracotta-200
	const cream = '#faf4f1'; // terracotta-50
	const font =
		"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

	// Brand logo on the dedicated static-asset host (Caddy file_server, see
	// deploy/Caddyfile). URL is deliberately stable — decoupled from build hashes and
	// the `assets.` subdomain survives the preview → live cutover. alt text carries
	// the brand if the image is blocked (webp also doesn't render in Outlook/Windows).
	const logoUrl = 'https://assets.casadecuentos.ch/logo.webp';

	// One row per line item: "title × qty" left, line total right-aligned, hairline
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

	// A subtotal/shipping/total line; the total is emphasised (heavier + accent).
	const summaryRow = (label: string, value: string, emphasis = false): string =>
		`<tr>` +
		`<td style="padding:4px 0;font-size:15px;color:${emphasis ? ink : muted};${emphasis ? 'font-weight:700;padding-top:12px;' : ''}">${label}</td>` +
		`<td style="padding:4px 0;font-size:${emphasis ? '18px' : '15px'};color:${emphasis ? accent : ink};text-align:right;font-weight:${emphasis ? '700' : '600'};${emphasis ? 'padding-top:12px;' : ''}">${value}</td>` +
		`</tr>`;

	// A labelled shipping detail: small uppercase label above its value. Stacked (not
	// two columns) so it stays readable at phone width in every client.
	const detailRows = (label: string, valueHtml: string): string =>
		`<tr><td style="padding:0 0 2px;font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:${muted};">${label}</td></tr>` +
		`<tr><td style="padding:0 0 14px;font-size:15px;line-height:1.5;color:${ink};">${valueHtml}</td></tr>`;

	const shippingDetailsHtml =
		detailRows(t('email.confirm.shippingMethod', locale), escapeHtml(methodLabel)) +
		(address
			? detailRows(
					t('email.confirm.shippingAddress', locale),
					addressLines(address).map(escapeHtml).join('<br/>')
				)
			: '');

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
				<!-- Shipping: the tier the customer picked + where the parcel goes -->
				<tr><td style="padding:0 32px 20px;">
					<h2 style="margin:0 0 10px;font-size:16px;font-weight:700;color:${ink};">${t('email.confirm.shippingDetails', locale)}</h2>
					<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${hairline};padding-top:8px;">${shippingDetailsHtml}</table>
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
