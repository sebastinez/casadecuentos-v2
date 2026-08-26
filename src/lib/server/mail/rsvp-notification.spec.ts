import { describe, it, expect } from 'vitest';
import { rsvpNotificationEmail, type RsvpNotificationData } from './rsvp-notification';

const DATA: RsvpNotificationData = {
	to: 'info@casadecuentos.ch',
	name: 'Ana',
	familyName: 'García',
	email: 'cliente@example.com',
	phone: '+41 79 123 45 67',
	eventTitle: 'Cuentacuentos de primavera',
	eventDate: '2026-07-05',
	eventTime: '10:30',
	venueAddress: 'Langstrasse 1, 8004 Zürich'
};

describe('rsvpNotificationEmail', () => {
	it('goes to the business inbox and names the event in the subject', () => {
		const msg = rsvpNotificationEmail(DATA);
		expect(msg.to).toBe('info@casadecuentos.ch');
		expect(msg.subject).toContain('Cuentacuentos de primavera');
		// Spanish copy from the i18n layer (v1 default locale).
		expect(msg.subject).toContain('Nueva reserva');
	});

	it('renders the event details and every attendee field', () => {
		const { text } = rsvpNotificationEmail(DATA);
		expect(text).toContain('Cuentacuentos de primavera');
		// Civil date formatted long in Spanish; time shown as the stored wall clock.
		expect(text).toContain('julio');
		expect(text).toContain('10:30');
		expect(text).toContain('Langstrasse 1, 8004 Zürich');
		expect(text).toContain('Ana');
		expect(text).toContain('García');
		expect(text).toContain('cliente@example.com');
		expect(text).toContain('+41 79 123 45 67');
	});

	it('omits the venue line when no address is set', () => {
		const { text } = rsvpNotificationEmail({ ...DATA, venueAddress: '' });
		expect(text).not.toContain('Lugar:');
	});

	it('escapes HTML in user supplied values', () => {
		const { html } = rsvpNotificationEmail({ ...DATA, name: '<script>' });
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
	});
});
