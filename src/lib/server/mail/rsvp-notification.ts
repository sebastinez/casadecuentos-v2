import { t, DEFAULT_LOCALE, type Locale } from '$lib/i18n';
import { formatEventDate } from '$lib/datetime';
import { brandedEmailHtml, brandedEmailText, type BrandedEmail } from './layout';
import type { MailMessage } from './transport';

// Pure builder for the RSVP notification sent TO the owner (info@casadecuentos.ch),
// the mirror of `rsvp-confirmation.ts` which goes to the attendee. No I/O and no
// provider knowledge, so it is unit-testable and the form action stays the only
// place that actually sends. The branded card chrome and the HTML escaping both
// live in `layout.ts` — this file only decides WHAT goes in it.

export interface RsvpNotificationData {
	// The business inbox; passed in (from `site.email`) so this builder stays pure.
	to: string;
	name: string;
	familyName: string;
	email: string;
	phone: string;
	eventTitle: string;
	// Europe/Zurich wall-clock civil date + time (`YYYY-MM-DD` / `HH:MM`).
	eventDate: string;
	eventTime: string;
	venueAddress: string;
	// Child details. Name/age are always present; the last two are optional prompts
	// and their rows are dropped when the family left them blank.
	childName: string;
	childAge: string;
	favoriteBooks: string;
	comments: string;
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

	const branded: BrandedEmail = {
		locale,
		eyebrow: t('email.rsvpOwner.subject', locale),
		// The event title IS the headline here: which activity just filled a seat is
		// the first thing the owner wants to know. It is therefore not repeated as a
		// row in the event section below.
		heading: eventTitle,
		intro: [t('email.rsvpOwner.intro', locale)],
		sections: [
			{
				heading: t('email.rsvp.sectionEvent', locale),
				rows: [
					{ label: t('email.rsvp.when', locale), value: when },
					{ label: t('email.rsvp.where', locale), value: venueAddress }
				]
			},
			{
				heading: t('email.rsvp.sectionContact', locale),
				rows: [
					{ label: t('rsvp.name', locale), value: name },
					{ label: t('rsvp.familyName', locale), value: familyName },
					{ label: t('rsvp.email', locale), value: email },
					{ label: t('rsvp.phone', locale), value: phone }
				]
			},
			{
				heading: t('email.rsvp.sectionChild', locale),
				rows: [
					{ label: t('rsvp.childName', locale), value: data.childName },
					{ label: t('rsvp.childAge', locale), value: data.childAge },
					{ label: t('rsvp.favoriteBooks', locale), value: data.favoriteBooks },
					{ label: t('rsvp.comments', locale), value: data.comments }
				]
			}
		]
		// No help footer: this one lands in info@, so pointing the owner at info@ is noise.
	};

	return {
		to,
		subject,
		html: brandedEmailHtml(branded),
		text: brandedEmailText(branded)
	};
}
