import { describe, it, expect } from 'vitest';
import { rsvpConfirmationEmail, type RsvpConfirmationData } from './rsvp-confirmation';

const DATA: RsvpConfirmationData = {
	email: 'cliente@example.com',
	name: 'Ana',
	eventTitle: 'Cuentacuentos de primavera',
	eventDate: '2026-07-05',
	eventTime: '10:30',
	venueAddress: 'Langstrasse 1, 8004 Zürich'
};

describe('rsvpConfirmationEmail', () => {
	it('addresses the customer and names the event in the subject', () => {
		const msg = rsvpConfirmationEmail(DATA);
		expect(msg.to).toBe('cliente@example.com');
		expect(msg.subject).toContain('Cuentacuentos de primavera');
		// Spanish copy from the i18n layer (v1 default locale).
		expect(msg.subject).toContain('Confirmación de reserva');
	});

	it('renders the event, the Zurich wall-clock date/time and the venue', () => {
		const { text } = rsvpConfirmationEmail(DATA);
		expect(text).toContain('Ana');
		expect(text).toContain('Cuentacuentos de primavera');
		// Civil date formatted long in Spanish; time shown as the stored wall clock.
		expect(text).toContain('julio');
		expect(text).toContain('10:30');
		expect(text).toContain('Langstrasse 1, 8004 Zürich');
	});

	it('omits the venue line when no address is set', () => {
		const { text } = rsvpConfirmationEmail({ ...DATA, venueAddress: '' });
		expect(text).not.toContain('Lugar:');
	});

	it('escapes HTML in user/owner supplied values', () => {
		const { html } = rsvpConfirmationEmail({ ...DATA, name: '<script>' });
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
	});
});
