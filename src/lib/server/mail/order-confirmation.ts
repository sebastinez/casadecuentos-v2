import { t, DEFAULT_LOCALE, type Locale } from '$lib/i18n';
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

	const rowsHtml = lines
		.map(
			(line) =>
				`<tr><td>${line.qty}× ${escapeHtml(line.title)}</td>` +
				`<td style="text-align:right">${money(line.lineTotal, currency)}</td></tr>`
		)
		.join('');

	const html = `<!doctype html>
<html lang="${locale}">
<body style="font-family: system-ui, sans-serif; color: #1a1a1a;">
	<p>${t('email.confirm.greeting', locale)}</p>
	<p>${t('email.confirm.intro', locale)}</p>
	<p><strong>${t('email.confirm.orderNumber', locale)}:</strong> #${orderNumber}</p>
	<h2 style="font-size: 1rem;">${t('email.confirm.items', locale)}</h2>
	<table style="width: 100%; border-collapse: collapse;">
		<tbody>${rowsHtml}</tbody>
		<tfoot>
			<tr><td>${t('email.confirm.subtotal', locale)}</td><td style="text-align:right">${money(itemsTotal, currency)}</td></tr>
			<tr><td>${t('email.confirm.shipping', locale)}</td><td style="text-align:right">${money(shipping, currency)}</td></tr>
			<tr><td><strong>${t('email.confirm.total', locale)}</strong></td><td style="text-align:right"><strong>${money(total, currency)}</strong></td></tr>
		</tfoot>
	</table>
	<p>${t('email.confirm.closing', locale)}</p>
	<p>${t('email.confirm.signature', locale)}</p>
</body>
</html>`;

	return { to: email, subject, html, text };
}
