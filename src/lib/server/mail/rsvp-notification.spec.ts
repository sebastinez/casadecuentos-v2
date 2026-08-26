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
	venueAddress: 'Langstrasse 1, 8004 Zürich',
	childName: 'Lucía',
	childAge: '5',
	favoriteBooks: 'Elmer, La oruga glotona',
	comments: 'Es alérgica a los frutos secos'
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

	it('renders the child details the owner needs to prepare the session', () => {
		const { text } = rsvpNotificationEmail(DATA);
		expect(text).toContain('Nombre de la niña / niño: Lucía');
		expect(text).toContain('Edad de la niña / niño: 5');
		expect(text).toContain('Elmer, La oruga glotona');
		expect(text).toContain('Es alérgica a los frutos secos');
	});

	it('omits the venue line when no address is set', () => {
		const { text } = rsvpNotificationEmail({ ...DATA, venueAddress: '' });
		expect(text).not.toContain('Lugar:');
	});

	it('omits the optional child prompts when left blank', () => {
		const { text } = rsvpNotificationEmail({ ...DATA, favoriteBooks: '', comments: '' });
		expect(text).not.toContain('Qué libros le gusta leer:');
		expect(text).not.toContain('Otros comentarios:');
	});

	it('escapes HTML in user supplied values', () => {
		const { html } = rsvpNotificationEmail({ ...DATA, name: '<script>' });
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
	});

	it('renders inside the branded card and skips the help footer', () => {
		const { html } = rsvpNotificationEmail(DATA);
		expect(html).toContain('assets.casadecuentos.ch/logo.webp');
		expect(html).toContain('#faf4f1');
		// Rows are grouped under section headings.
		expect(html).toContain('Contacto');
		expect(html).toContain('Niña / niño');
		// This one lands in info@ — no band pointing the owner at their own inbox.
		expect(html).not.toContain('mailto:');
	});

	it('headlines the event title instead of repeating it as a row', () => {
		const { html, text } = rsvpNotificationEmail(DATA);
		expect(html).toContain('<h1 style="margin:0 0 12px;');
		expect(text.split('\n')[0]).toBe('Cuentacuentos de primavera');
		expect(text).not.toContain('Evento:');
	});
});
