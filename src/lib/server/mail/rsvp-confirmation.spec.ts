import { describe, it, expect } from 'vitest';
import { rsvpConfirmationEmail, type RsvpConfirmationData } from './rsvp-confirmation';

const DATA: RsvpConfirmationData = {
	email: 'cliente@example.com',
	name: 'Ana',
	eventTitle: 'Cuentacuentos de primavera',
	eventDate: '2026-07-05',
	eventTime: '10:30',
	venueAddress: 'Langstrasse 1, 8004 Zürich',
	childName: 'Lucía',
	childAge: '5',
	favoriteBooks: 'Elmer, La oruga glotona',
	comments: 'Es alérgica a los frutos secos'
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

	it('echoes the child details back to the family', () => {
		const { text } = rsvpConfirmationEmail(DATA);
		expect(text).toContain('Lucía');
		expect(text).toContain('Elmer, La oruga glotona');
		expect(text).toContain('Es alérgica a los frutos secos');
	});

	it('omits the venue line when no address is set', () => {
		const { text } = rsvpConfirmationEmail({ ...DATA, venueAddress: '' });
		expect(text).not.toContain('Lugar:');
	});

	it('omits the optional child prompts when left blank', () => {
		const { text } = rsvpConfirmationEmail({ ...DATA, favoriteBooks: '', comments: '' });
		expect(text).not.toContain('Qué libros le gusta leer:');
		expect(text).not.toContain('Otros comentarios:');
		// The required child fields still render.
		expect(text).toContain('Nombre de la niña / niño: Lucía');
	});

	it('escapes HTML in user/owner supplied values', () => {
		const { html } = rsvpConfirmationEmail({ ...DATA, name: '<script>' });
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
	});

	it('renders inside the branded card, with sections and the help footer', () => {
		const { html } = rsvpConfirmationEmail(DATA);
		expect(html).toContain('assets.casadecuentos.ch/logo.webp');
		// Cream card background from the shared palette.
		expect(html).toContain('#faf4f1');
		// Rows are grouped under section headings.
		expect(html).toContain('Actividad');
		expect(html).toContain('Niña / niño');
		// Attendee-facing mail gets the "questions? write to us" band.
		expect(html).toContain('mailto:info@casadecuentos.ch');
	});
});
