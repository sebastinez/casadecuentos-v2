import { t, DEFAULT_LOCALE, type Locale } from '$lib/i18n';
import { formatEventDate } from '$lib/datetime';
import type { MailMessage } from './transport';

// Pure builder for the RSVP-confirmation email. Given the reserved event's
// display details it renders a Spanish `MailMessage`. No I/O and no provider
// knowledge — so it is unit-testable and the form action stays the only place
// that actually sends. All copy flows through the i18n layer (`t`), so a future
// `de` table localizes the same template with no code change (bilingual-ready).

export interface RsvpConfirmationData {
	email: string;
	name: string;
	eventTitle: string;
	// Europe/Zurich wall-clock civil date + time (`YYYY-MM-DD` / `HH:MM`).
	eventDate: string;
	eventTime: string;
	venueAddress: string;
}

// Escape the few characters that would break out of HTML context. The event
// title/address are owner-entered and `name` is user-supplied — escape both
// defensively before interpolating into the HTML body.
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export function rsvpConfirmationEmail(
	data: RsvpConfirmationData,
	locale: Locale = DEFAULT_LOCALE
): MailMessage {
	const { email, name, eventTitle, eventDate, eventTime, venueAddress } = data;

	const when = `${formatEventDate(eventDate, locale)} · ${eventTime} ${t('event.timeSuffix', locale)}`;
	const subject = `${t('email.rsvp.subject', locale)} — ${eventTitle}`;

	// Plain-text body: the canonical content. The HTML version mirrors it.
	const textLines = [
		`${t('email.rsvp.greeting', locale)} ${name},`.trim(),
		t('email.rsvp.intro', locale),
		'',
		`${t('email.rsvp.event', locale)}: ${eventTitle}`,
		`${t('email.rsvp.when', locale)}: ${when}`
	];
	if (venueAddress) textLines.push(`${t('email.rsvp.where', locale)}: ${venueAddress}`);
	textLines.push('', t('email.rsvp.closing', locale), t('email.rsvp.signature', locale));
	const text = textLines.join('\n');

	const whereHtml = venueAddress
		? `<p><strong>${t('email.rsvp.where', locale)}:</strong> ${escapeHtml(venueAddress)}</p>`
		: '';

	const html = `<!doctype html>
<html lang="${locale}">
<body style="font-family: system-ui, sans-serif; color: #1a1a1a;">
	<p>${t('email.rsvp.greeting', locale)} ${escapeHtml(name)},</p>
	<p>${t('email.rsvp.intro', locale)}</p>
	<p><strong>${t('email.rsvp.event', locale)}:</strong> ${escapeHtml(eventTitle)}</p>
	<p><strong>${t('email.rsvp.when', locale)}:</strong> ${escapeHtml(when)}</p>
	${whereHtml}
	<p>${t('email.rsvp.closing', locale)}</p>
	<p>${t('email.rsvp.signature', locale)}</p>
</body>
</html>`;

	return { to: email, subject, html, text };
}
