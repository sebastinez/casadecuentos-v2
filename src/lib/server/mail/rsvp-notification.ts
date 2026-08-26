import { t, DEFAULT_LOCALE, type Locale } from '$lib/i18n';
import { formatEventDate } from '$lib/datetime';
import type { MailMessage } from './transport';

// Pure builder for the RSVP notification sent TO the owner (info@casadecuentos.ch),
// the mirror of `rsvp-confirmation.ts` which goes to the attendee. No I/O and no
// provider knowledge, so it is unit-testable and the form action stays the only
// place that actually sends.

export interface RsvpNotificationData {
	// The business inbox; passed in (from `site.email`) so this builder stays pure.
	to: string;
	// name/family_name/email/phone are user-supplied (public RSVP form) — every one
	// is escaped before interpolating into the HTML body.
	name: string;
	familyName: string;
	email: string;
	phone: string;
	// Event details are owner-entered; escaped too, since PocketBase stores raw text.
	eventTitle: string;
	// Europe/Zurich wall-clock civil date + time (`YYYY-MM-DD` / `HH:MM`).
	eventDate: string;
	eventTime: string;
	venueAddress: string;
}

// Escape HTML metacharacters; every interpolated field here is untrusted text.
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export function rsvpNotificationEmail(
	data: RsvpNotificationData,
	locale: Locale = DEFAULT_LOCALE
): MailMessage {
	const { to, name, familyName, email, phone, eventTitle, eventDate, eventTime, venueAddress } =
		data;

	const when = `${formatEventDate(eventDate, locale)} · ${eventTime} ${t('event.timeSuffix', locale)}`;
	// Subject carries the event title so the owner can triage at a glance.
	const subject = `${t('email.rsvpOwner.subject', locale)} — ${eventTitle}`;

	// Plain-text body: the canonical content. The HTML version mirrors it.
	const textLines = [
		t('email.rsvpOwner.intro', locale),
		'',
		`${t('email.rsvp.event', locale)}: ${eventTitle}`,
		`${t('email.rsvp.when', locale)}: ${when}`
	];
	if (venueAddress) textLines.push(`${t('email.rsvp.where', locale)}: ${venueAddress}`);
	textLines.push(
		'',
		`${t('rsvp.name', locale)}: ${name}`,
		`${t('rsvp.familyName', locale)}: ${familyName}`,
		`${t('rsvp.email', locale)}: ${email}`,
		`${t('rsvp.phone', locale)}: ${phone}`
	);
	const text = textLines.join('\n');

	const whereHtml = venueAddress
		? `<p><strong>${t('email.rsvp.where', locale)}:</strong> ${escapeHtml(venueAddress)}</p>`
		: '';

	const html = `<!doctype html>
<html lang="${locale}">
<body style="font-family: system-ui, sans-serif; color: #1a1a1a;">
	<p>${t('email.rsvpOwner.intro', locale)}</p>
	<p><strong>${t('email.rsvp.event', locale)}:</strong> ${escapeHtml(eventTitle)}</p>
	<p><strong>${t('email.rsvp.when', locale)}:</strong> ${escapeHtml(when)}</p>
	${whereHtml}
	<p><strong>${t('rsvp.name', locale)}:</strong> ${escapeHtml(name)}</p>
	<p><strong>${t('rsvp.familyName', locale)}:</strong> ${escapeHtml(familyName)}</p>
	<p><strong>${t('rsvp.email', locale)}:</strong> ${escapeHtml(email)}</p>
	<p><strong>${t('rsvp.phone', locale)}:</strong> ${escapeHtml(phone)}</p>
</body>
</html>`;

	return { to, subject, html, text };
}
