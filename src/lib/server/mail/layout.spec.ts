import { describe, it, expect } from 'vitest';
import { brandedEmailHtml, brandedEmailText, type BrandedEmail } from './layout';

const EMAIL: BrandedEmail = {
	locale: 'es',
	eyebrow: 'Confirmación',
	heading: 'Hola Ana,',
	intro: ['Gracias por reservar.'],
	sections: [
		{
			heading: 'Actividad',
			rows: [
				{ label: 'Evento', value: 'Cuentacuentos' },
				{ label: 'Lugar', value: '' }
			]
		},
		{
			heading: 'Vacía',
			rows: [{ label: 'Comentarios', value: '' }]
		}
	],
	closing: ['Te esperamos.', 'Casa de Cuentos']
};

describe('branded email shell', () => {
	it('drops empty rows and the sections left empty by them', () => {
		const text = brandedEmailText(EMAIL);
		const html = brandedEmailHtml(EMAIL);
		expect(text).toContain('Evento: Cuentacuentos');
		expect(text).not.toContain('Lugar');
		// The section whose only row was blank disappears entirely, heading included.
		expect(text).not.toContain('Vacía');
		expect(html).not.toContain('Vacía');
	});

	it('mirrors every rendered value in both bodies', () => {
		const text = brandedEmailText(EMAIL);
		const html = brandedEmailHtml(EMAIL);
		for (const fragment of [
			'Hola Ana,',
			'Gracias por reservar.',
			'Cuentacuentos',
			'Te esperamos.'
		]) {
			expect(text).toContain(fragment);
			expect(html).toContain(fragment);
		}
	});

	it('escapes every caller-supplied string, trusted copy included', () => {
		const html = brandedEmailHtml({
			...EMAIL,
			heading: '<script>alert(1)</script>',
			sections: [{ heading: 'X', rows: [{ label: 'L', value: '"><img onerror=1>' }] }]
		});
		expect(html).not.toContain('<script>');
		expect(html).not.toContain('<img onerror');
		expect(html).toContain('&lt;script&gt;');
		expect(html).toContain('&quot;&gt;&lt;img onerror=1&gt;');
	});

	it('renders the help footer only when asked', () => {
		expect(brandedEmailHtml(EMAIL)).not.toContain('mailto:');
		expect(brandedEmailHtml({ ...EMAIL, showHelpFooter: true })).toContain(
			'mailto:info@casadecuentos.ch'
		);
	});
});
