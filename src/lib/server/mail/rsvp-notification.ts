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
	// Child details. Name/age are always present; the last two are optional prompts
	// and their lines are dropped when the family left them blank.
	childName: string;
	childAge: string;
	favoriteBooks: string;
	comments: string;
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

	// Label/value detail rows, rendered identically in both bodies. Empty values are
	// dropped, so an unset venue or a skipped optional prompt leaves no blank line.
	// Event details first, then who booked, then who is attending.
	const rows: Array<[string, string]> = [
		[t('email.rsvp.event', locale), eventTitle],
		[t('email.rsvp.when', locale), when],
		[t('email.rsvp.where', locale), venueAddress],
		[t('rsvp.name', locale), name],
		[t('rsvp.familyName', locale), familyName],
		[t('rsvp.email', locale), email],
		[t('rsvp.phone', locale), phone],
		[t('rsvp.childName', locale), data.childName],
		[t('rsvp.childAge', locale), data.childAge],
		[t('rsvp.favoriteBooks', locale), data.favoriteBooks],
		[t('rsvp.comments', locale), data.comments]
	].filter(([, value]) => !!value) as Array<[string, string]>;

	// Plain-text body: the canonical content. The HTML version mirrors it.
	const text = [
		t('email.rsvpOwner.intro', locale),
		'',
		...rows.map(([label, value]) => `${label}: ${value}`)
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
	<p>${t('email.rsvpOwner.intro', locale)}</p>
	${rowsHtml}
</body>
</html>`;

	return { to, subject, html, text };
}
