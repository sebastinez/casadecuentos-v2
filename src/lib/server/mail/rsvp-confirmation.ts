import { t, DEFAULT_LOCALE, type Locale } from '$lib/i18n';
import { formatEventDate } from '$lib/datetime';
import type { MailMessage } from './transport';

// Pure builder for the RSVP-confirmation email. No I/O and no provider knowledge, so
// it is unit-testable and the form action stays the only place that actually sends.
// All copy flows through the i18n layer (`t`), so a future `de` table localizes the
// same template with no code change.

export interface RsvpConfirmationData {
	email: string;
	name: string;
	eventTitle: string;
	// Europe/Zurich wall-clock civil date + time (`YYYY-MM-DD` / `HH:MM`).
	eventDate: string;
	eventTime: string;
	venueAddress: string;
	// Child details, echoed back as a receipt of what the family submitted.
	// `favoriteBooks`/`comments` are optional and their lines are dropped when empty.
	childName: string;
	childAge: string;
	favoriteBooks: string;
	comments: string;
}

// Escape HTML metacharacters. Event title/address are owner-entered and `name` is
// user-supplied — escape both before interpolating into the HTML body.
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

	// Label/value detail rows, rendered identically in both bodies. Empty values are
	// dropped, so an unset venue or a skipped optional prompt leaves no blank line.
	const rows: Array<[string, string]> = [
		[t('email.rsvp.event', locale), eventTitle],
		[t('email.rsvp.when', locale), when],
		[t('email.rsvp.where', locale), venueAddress],
		[t('rsvp.childName', locale), data.childName],
		[t('rsvp.childAge', locale), data.childAge],
		[t('rsvp.favoriteBooks', locale), data.favoriteBooks],
		[t('rsvp.comments', locale), data.comments]
	].filter(([, value]) => !!value) as Array<[string, string]>;

	// Plain-text body: the canonical content. The HTML version mirrors it.
	const text = [
		`${t('email.rsvp.greeting', locale)} ${name},`.trim(),
		t('email.rsvp.intro', locale),
		'',
		...rows.map(([label, value]) => `${label}: ${value}`),
		'',
		t('email.rsvp.closing', locale),
		t('email.rsvp.signature', locale)
	].join('\n');

	const rowsHtml = rows
		.map(
			([label, value]) =>
				`<p style="white-space: pre-wrap;"><strong>${label}:</strong> ${escapeHtml(value)}</p>`
		)
		.join('\n\t');

	const html = `<!doctype html>
<html lang="${locale}">
<body style="font-family: system-ui, sans-serif; color: #1a1a1a;">
	<p>${t('email.rsvp.greeting', locale)} ${escapeHtml(name)},</p>
	<p>${t('email.rsvp.intro', locale)}</p>
	${rowsHtml}
	<p>${t('email.rsvp.closing', locale)}</p>
	<p>${t('email.rsvp.signature', locale)}</p>
</body>
</html>`;

	return { to: email, subject, html, text };
}
