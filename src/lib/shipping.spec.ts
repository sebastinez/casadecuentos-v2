import { describe, it, expect } from 'vitest';
import { shippingCost, totalWeightGrams, parseUrgency, type ShippingRate } from './shipping';

// A two-tier table per urgency: ≤1000g and ≤5000g, priority dearer than economy.
const RATES: ShippingRate[] = [
	{ maxWeight: 1000, cost: 6.9, urgency: 'economy' },
	{ maxWeight: 5000, cost: 10.5, urgency: 'economy' },
	{ maxWeight: 1000, cost: 8.9, urgency: 'priority' },
	{ maxWeight: 5000, cost: 12.5, urgency: 'priority' }
];

describe('totalWeightGrams', () => {
	it('sums per-book weight times quantity', () => {
		expect(
			totalWeightGrams([
				{ weightGrams: 300, qty: 2 },
				{ weightGrams: 450, qty: 1 }
			])
		).toBe(1050);
	});

	it('treats a missing weight (0) as no contribution', () => {
		expect(totalWeightGrams([{ weightGrams: 0, qty: 3 }])).toBe(0);
	});

	it('is 0 for an empty cart', () => {
		expect(totalWeightGrams([])).toBe(0);
	});
});

describe('shippingCost', () => {
	it('picks the cheapest tier whose ceiling covers the weight', () => {
		expect(shippingCost(800, RATES, 'economy')).toBe(6.9);
		expect(shippingCost(1500, RATES, 'economy')).toBe(10.5);
	});

	it('selects by the chosen urgency', () => {
		expect(shippingCost(800, RATES, 'priority')).toBe(8.9);
		expect(shippingCost(1500, RATES, 'priority')).toBe(12.5);
	});

	it('includes weight exactly equal to a tier ceiling in that tier (boundary)', () => {
		expect(shippingCost(1000, RATES, 'economy')).toBe(6.9);
	});

	it('clamps to the heaviest tier when over every ceiling', () => {
		expect(shippingCost(99999, RATES, 'economy')).toBe(10.5);
	});

	it('uses the lightest tier for a zero-weight order', () => {
		expect(shippingCost(0, RATES, 'economy')).toBe(6.9);
	});

	it('throws when no rate is configured for the urgency', () => {
		const economyOnly = RATES.filter((r) => r.urgency === 'economy');
		expect(() => shippingCost(800, economyOnly, 'priority')).toThrow();
	});
});

describe('parseUrgency', () => {
	it('accepts priority', () => {
		expect(parseUrgency('priority')).toBe('priority');
	});

	it('falls back to economy for anything else', () => {
		expect(parseUrgency('economy')).toBe('economy');
		expect(parseUrgency('express')).toBe('economy');
		expect(parseUrgency(undefined)).toBe('economy');
		expect(parseUrgency(null)).toBe('economy');
	});
});
