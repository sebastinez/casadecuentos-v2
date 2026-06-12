import { describe, it, expect } from 'vitest';
import { contactMessageEmail, type ContactMessageData } from './contact-message';

const DATA: ContactMessageData = {
	to: 'hola@casadecuentos.ch',
	name: 'Ana',
	email: 'cliente@example.com',
	subject: '¿Tenéis este título?',
	message: 'Hola, busco un libro para mi hija.'
};

describe('contactMessageEmail', () => {
	it('addresses the business inbox and threads the sender subject', () => {
		const msg = contactMessageEmail(DATA);
		expect(msg.to).toBe('hola@casadecuentos.ch');
		expect(msg.subject).toContain('¿Tenéis este título?');
	});

	it('renders all four submitted fields in the body', () => {
		const { text } = contactMessageEmail(DATA);
		expect(text).toContain('Ana');
		expect(text).toContain('cliente@example.com');
		expect(text).toContain('¿Tenéis este título?');
		expect(text).toContain('Hola, busco un libro para mi hija.');
	});

	it('escapes HTML in every user-supplied field', () => {
		const { html } = contactMessageEmail({
			...DATA,
			name: '<b>x</b>',
			message: '<script>alert(1)</script>'
		});
		expect(html).not.toContain('<b>x</b>');
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
		expect(html).toContain('&lt;script&gt;');
	});
});
