import { describe, it, expect } from 'vitest';
import { buildSessionParams, toMinorUnits } from './stripe-params';
import type { BuiltOrder } from './order';

describe('toMinorUnits', () => {
	it('converts plain CHF to integer rappen', () => {
		expect(toMinorUnits(8)).toBe(800);
		expect(toMinorUnits(12)).toBe(1200);
	});

	it('rounds rather than truncates — 24.90 → 2490, not 2489 (float guard)', () => {
		// 24.90 * 100 is 2489.9999… in IEEE-754; truncation would drop a rappen.
		expect(toMinorUnits(24.9)).toBe(2490);
	});

	it('rounds a half-rappen to the nearest minor unit', () => {
		expect(toMinorUnits(19.995)).toBe(2000);
		expect(toMinorUnits(19.994)).toBe(1999);
	});
});

const ORDER: BuiltOrder = {
	lines: [
		{ id: 'a', title: 'El Principito', unitPrice: 24.9, qty: 2, lineTotal: 49.8 },
		{ id: 'b', title: 'La Oruga', unitPrice: 12, qty: 1, lineTotal: 12 }
	],
	itemsTotal: 61.8,
	shipping: 8,
	total: 69.8
};

describe('buildSessionParams', () => {
	const params = buildSessionParams({
		order: ORDER,
		orderId: 'ord123',
		successUrl: 'https://shop.test/pago/exito',
		cancelUrl: 'https://shop.test/pago/cancelado'
	});

	it('maps each order line to a CHF line item with rounded unit_amount', () => {
		expect(params.line_items).toEqual([
			{
				quantity: 2,
				price_data: {
					currency: 'chf',
					unit_amount: 2490,
					product_data: { name: 'El Principito' }
				}
			},
			{
				quantity: 1,
				price_data: { currency: 'chf', unit_amount: 1200, product_data: { name: 'La Oruga' } }
			}
		]);
	});

	it('adds the flat shipping as a fixed-amount CHF shipping option', () => {
		const rate = params.shipping_options?.[0].shipping_rate_data;
		expect(rate?.type).toBe('fixed_amount');
		expect(rate?.fixed_amount).toEqual({ currency: 'chf', amount: 800 });
	});

	it('configures Spanish hosted checkout, TWINT + cards, CH-only address', () => {
		expect(params.mode).toBe('payment');
		expect(params.locale).toBe('es');
		expect(params.payment_method_types).toEqual(['card', 'twint']);
		expect(params.shipping_address_collection?.allowed_countries).toEqual(['CH']);
	});

	it('does not enable automatic tax (not VAT-registered, books-only)', () => {
		expect(params.automatic_tax).toBeUndefined();
	});

	it('carries the order id in metadata and the success/cancel URLs', () => {
		expect(params.metadata).toEqual({ orderId: 'ord123' });
		expect(params.success_url).toBe('https://shop.test/pago/exito');
		expect(params.cancel_url).toBe('https://shop.test/pago/cancelado');
	});
});
