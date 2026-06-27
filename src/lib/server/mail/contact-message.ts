import { t, DEFAULT_LOCALE, type Locale } from '$lib/i18n';
import type { MailMessage } from './transport';

// Pure builder for the contact-message email sent TO the owner. No I/O and no
// provider knowledge, so it is unit-testable and the form action stays the only
// place that actually sends.

export interface ContactMessageData {
	// The business inbox; passed in (from `site.email`) so this builder stays pure.
	to: string;
	// name/email/subject/message are ATTACKER-CONTROLLED (public form input), so
	// every one is escaped before interpolating into the HTML body.
	name: string;
	email: string;
	subject: string;
	message: string;
}

// Escape HTML metacharacters; every field here is user-supplied.
function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

export function contactMessageEmail(
	data: ContactMessageData,
	locale: Locale = DEFAULT_LOCALE
): MailMessage {
	const { to, name, email, subject, message } = data;

	// Subject carries the sender's subject so the owner can triage at a glance.
	const mailSubject = `${t('email.contact.subject', locale)}: ${subject}`;

	// Plain-text body: the canonical content. The HTML version mirrors it.
	const text = [
		t('email.contact.intro', locale),
		'',
		`${t('contact.name', locale)}: ${name}`,
		`${t('contact.email', locale)}: ${email}`,
		`${t('contact.subject', locale)}: ${subject}`,
		'',
		`${t('contact.message', locale)}:`,
		message
	].join('\n');

	const html = `<!doctype html>
<html lang="${locale}">
<body style="font-family: system-ui, sans-serif; color: #1a1a1a;">
	<p>${t('email.contact.intro', locale)}</p>
	<p><strong>${t('contact.name', locale)}:</strong> ${escapeHtml(name)}</p>
	<p><strong>${t('contact.email', locale)}:</strong> ${escapeHtml(email)}</p>
	<p><strong>${t('contact.subject', locale)}:</strong> ${escapeHtml(subject)}</p>
	<p><strong>${t('contact.message', locale)}:</strong></p>
	<p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
</body>
</html>`;

	return { to, subject: mailSubject, html, text };
}
