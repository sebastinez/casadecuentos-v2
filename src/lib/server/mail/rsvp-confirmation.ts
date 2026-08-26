import { t, DEFAULT_LOCALE, type Locale } from '$lib/i18n';
import { formatEventDate } from '$lib/datetime';
import { brandedEmailHtml, brandedEmailText, type BrandedEmail } from './layout';
import type { MailMessage } from './transport';

// Pure builder for the RSVP-confirmation email. No I/O and no provider knowledge, so
// it is unit-testable and the form action stays the only place that actually sends.
// All copy flows through the i18n layer (`t`), so a future `de` table localizes the
// same template with no code change. The branded card chrome and the HTML escaping
// both live in `layout.ts` — this file only decides WHAT goes in it.

export interface RsvpConfirmationData {
	email: string;
	name: string;
	eventTitle: string;
	// Europe/Zurich wall-clock civil date + time (`YYYY-MM-DD` / `HH:MM`).
	eventDate: string;
	eventTime: string;
	venueAddress: string;
	// Child details, echoed back as a receipt of what the family submitted.
	// `favoriteBooks`/`comments` are optional and their rows are dropped when empty.
	childName: string;
	childAge: string;
	favoriteBooks: string;
	comments: string;
}

export function rsvpConfirmationEmail(
	data: RsvpConfirmationData,
	locale: Locale = DEFAULT_LOCALE
): MailMessage {
	const { email, name, eventTitle, eventDate, eventTime, venueAddress } = data;

	const when = `${formatEventDate(eventDate, locale)} · ${eventTime} ${t('event.timeSuffix', locale)}`;
	const subject = `${t('email.rsvp.subject', locale)} — ${eventTitle}`;

	const branded: BrandedEmail = {
		locale,
		eyebrow: t('email.rsvp.subject', locale),
		// A real salutation as the h1; the thank-you sentence leads the body instead.
		heading: `${t('email.rsvp.hello', locale)} ${name},`,
		intro: [t('email.rsvp.greeting', locale), t('email.rsvp.intro', locale)],
		sections: [
			{
				heading: t('email.rsvp.sectionEvent', locale),
				rows: [
					{ label: t('email.rsvp.event', locale), value: eventTitle },
					{ label: t('email.rsvp.when', locale), value: when },
					{ label: t('email.rsvp.where', locale), value: venueAddress }
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
		],
		closing: [t('email.rsvp.closing', locale), t('email.rsvp.signature', locale)],
		showHelpFooter: true
	};

	return {
		to: email,
		subject,
		html: brandedEmailHtml(branded),
		text: brandedEmailText(branded)
	};
}
