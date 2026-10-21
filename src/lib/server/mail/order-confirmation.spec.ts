import { describe, it, expect } from 'vitest';
import { orderConfirmationEmail, type OrderConfirmationData } from './order-confirmation';

// The address arrives exactly as Stripe hands it over (`collected_information.
// shipping_details`) and is snapshotted onto the order that way, so the fixture
// keeps the nested, snake_cased provider shape.
const ADDRESS = {
	name: 'Ada Lovelace',
	address: {
		line1: 'Bahnhofstrasse 1',
		line2: '3. Stock',
		postal_code: '8001',
		city: 'Zürich',
		country: 'CH'
	}
};

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
	currency: 'CHF',
	urgency: 'economy',
	shippingAddress: ADDRESS
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

	// --- Shipping details: the chosen tier + where the parcel goes ---

	it('names the chosen delivery tier, in the same words the cart used', () => {
		const economy = orderConfirmationEmail(DATA);
		expect(economy.text).toContain('Método de envío: Económico (2–3 días hábiles)');
		expect(economy.html).toContain('Económico (2–3 días hábiles)');

		const priority = orderConfirmationEmail({ ...DATA, urgency: 'priority' });
		expect(priority.text).toContain('Método de envío: Prioritario (1 día hábil)');
		expect(priority.html).toContain('Prioritario (1 día hábil)');
	});

	it('prints the shipping address, postcode before city, in both bodies', () => {
		const { text, html } = orderConfirmationEmail(DATA);

		expect(text).toContain('Dirección de envío:');
		expect(text).toContain('  Ada Lovelace');
		expect(text).toContain('  Bahnhofstrasse 1');
		expect(text).toContain('  3. Stock');
		expect(text).toContain('  8001 Zürich');
		expect(text).toContain('  CH');

		expect(html).toContain('Dirección de envío');
		expect(html).toContain('Ada Lovelace<br/>Bahnhofstrasse 1<br/>3. Stock<br/>8001 Zürich<br/>CH');
	});

	it('localizes the shipping labels and tier for the de locale', () => {
		const { text } = orderConfirmationEmail({ ...DATA, urgency: 'priority' }, 'de');
		expect(text).toContain('Versandart: Express (1 Werktag)');
		expect(text).toContain('Lieferadresse:');
		expect(text).toContain('  8001 Zürich');
	});

	it('skips absent address parts instead of printing blank lines', () => {
		const { text } = orderConfirmationEmail({
			...DATA,
			shippingAddress: { name: 'Ada', address: { city: 'Zürich', country: 'CH' } }
		});
		expect(text).toContain('  Ada\n  Zürich\n  CH');
		expect(text).not.toContain('undefined');
	});

	it('also accepts an already-flat address object', () => {
		const { text } = orderConfirmationEmail({
			...DATA,
			shippingAddress: { name: 'Ada', line1: 'Bahnhofstrasse 1', postalCode: '8001', city: 'Bern' }
		});
		expect(text).toContain('  Bahnhofstrasse 1');
		expect(text).toContain('  8001 Bern');
	});

	it('keeps the shipping method but drops the address block when there is no address', () => {
		for (const shippingAddress of [null, undefined, {}, 'nonsense']) {
			const { text, html } = orderConfirmationEmail({ ...DATA, shippingAddress });
			expect(text).toContain('Método de envío: Económico (2–3 días hábiles)');
			expect(text).not.toContain('Dirección de envío');
			expect(html).not.toContain('Dirección de envío');
			expect(text).not.toContain('undefined');
		}
	});

	it('escapes HTML-significant characters in the address', () => {
		const { html } = orderConfirmationEmail({
			...DATA,
			shippingAddress: { name: 'Tom & <Jerry>', address: { city: 'Zürich' } }
		});
		expect(html).toContain('Tom &amp; &lt;Jerry&gt;');
		expect(html).not.toContain('<Jerry>');
	});
});
