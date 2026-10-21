import { describe, it, expect } from 'vitest';
import {
	emptyShippingAddress,
	isCompleteShippingAddress,
	parseShippingAddress,
	validateShippingAddress,
	type ShippingAddress
} from './shipping-address';

const VALID: ShippingAddress = {
	name: 'Ada Lovelace',
	line1: 'Bahnhofstrasse 1',
	line2: '3. Stock',
	postalCode: '8001',
	city: 'Zürich',
	country: 'CH'
};

// The same address after a round-trip through the parser (the blank line2 stays blank).
const VALID_TRIMMED: ShippingAddress = { ...VALID, line2: '' };

describe('parseShippingAddress (the untrusted-input boundary)', () => {
	it('trims every field and fixes the country to CH', () => {
		expect(
			parseShippingAddress({
				name: '  Ada Lovelace ',
				line1: ' Bahnhofstrasse 1',
				line2: '',
				postalCode: ' 8001 ',
				city: 'Zürich ',
				country: 'DE'
			})
		).toEqual(VALID_TRIMMED);
	});

	it('drops non-string and missing fields to empty strings rather than throwing', () => {
		expect(parseShippingAddress({ name: 42, line1: null, city: ['Bern'] })).toEqual(
			emptyShippingAddress()
		);
	});

	it('survives a non-object body', () => {
		for (const input of [null, undefined, 'nonsense', 7, []]) {
			expect(parseShippingAddress(input)).toEqual(emptyShippingAddress());
		}
	});
});

describe('validateShippingAddress', () => {
	it('accepts a complete Swiss address', () => {
		expect(validateShippingAddress(VALID)).toEqual([]);
		expect(isCompleteShippingAddress(VALID)).toBe(true);
	});

	it('accepts an address with no second line (it is optional)', () => {
		expect(validateShippingAddress({ ...VALID, line2: '' })).toEqual([]);
	});

	it('names every missing required field at once, in form order', () => {
		expect(validateShippingAddress(emptyShippingAddress())).toEqual([
			'name',
			'line1',
			'postalCode',
			'city'
		]);
	});

	it('rejects a one-character recipient or town and a too-short street', () => {
		expect(validateShippingAddress({ ...VALID, name: 'A' })).toEqual(['name']);
		expect(validateShippingAddress({ ...VALID, city: 'Z' })).toEqual(['city']);
		expect(validateShippingAddress({ ...VALID, line1: 'Bl' })).toEqual(['line1']);
	});

	it('requires a four-digit Swiss postcode with no leading zero', () => {
		for (const postalCode of ['', '800', '80011', '0800', '8oo1', '8001 ', 'CH-8001']) {
			expect(validateShippingAddress({ ...VALID, postalCode })).toEqual(['postalCode']);
		}
		for (const postalCode of ['1000', '8001', '9658']) {
			expect(validateShippingAddress({ ...VALID, postalCode })).toEqual([]);
		}
	});

	it('caps field length, including the optional second line', () => {
		const long = 'x'.repeat(101);
		expect(validateShippingAddress({ ...VALID, name: long })).toEqual(['name']);
		expect(validateShippingAddress({ ...VALID, line2: long })).toEqual(['line2']);
		expect(validateShippingAddress({ ...VALID, line2: 'x'.repeat(100) })).toEqual([]);
	});

	it('reports an untrusted body as incomplete once parsed', () => {
		expect(isCompleteShippingAddress(parseShippingAddress({ name: 'Ada' }))).toBe(false);
	});
});
