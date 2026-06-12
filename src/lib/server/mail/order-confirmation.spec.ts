import { describe, it, expect } from 'vitest';
import { orderConfirmationEmail, type OrderConfirmationData } from './order-confirmation';

const DATA: OrderConfirmationData = {
	orderNumber: 1042,
	email: 'cliente@example.com',
	lines: [
		{ id: 'a', title: 'El Principito', unitPrice: 24.9, qty: 2, lineTotal: 49.8 },
		{ id: 'b', title: 'La Oruga', unitPrice: 12, qty: 1, lineTotal: 12 }
	],
	itemsTotal: 61.8,
	shipping: 8,
	total: 69.8,
	currency: 'CHF'
};

describe('orderConfirmationEmail', () => {
	it('addresses the customer and threads the order number into the subject', () => {
		const msg = orderConfirmationEmail(DATA);
		expect(msg.to).toBe('cliente@example.com');
		expect(msg.subject).toContain('#1042');
		// Spanish copy from the i18n layer (v1 default locale).
		expect(msg.subject).toContain('Confirmación de pedido');
	});

	it('lists every line with quantity, title and CHF amounts in the text body', () => {
		const { text } = orderConfirmationEmail(DATA);
		expect(text).toContain('2× El Principito');
		expect(text).toContain('1× La Oruga');
		expect(text).toContain('CHF 49.80');
		expect(text).toContain('CHF 12.00');
	});

	it('renders subtotal, shipping and total formatted to two decimals', () => {
		const { text } = orderConfirmationEmail(DATA);
		expect(text).toContain('CHF 61.80');
		expect(text).toContain('CHF 8.00');
		expect(text).toContain('CHF 69.80');
	});

	it('produces an HTML body alongside the text part', () => {
		const { html } = orderConfirmationEmail(DATA);
		expect(html).toContain('<table');
		expect(html).toContain('El Principito');
		expect(html).toContain('CHF 69.80');
	});

	it('escapes HTML-significant characters in book titles', () => {
		const msg = orderConfirmationEmail({
			...DATA,
			lines: [{ id: 'x', title: 'Tom & <Jerry>', unitPrice: 10, qty: 1, lineTotal: 10 }]
		});
		expect(msg.html).toContain('Tom &amp; &lt;Jerry&gt;');
		expect(msg.html).not.toContain('<Jerry>');
	});
});
