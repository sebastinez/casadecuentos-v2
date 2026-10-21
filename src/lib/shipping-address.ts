// The delivery address, the pure core. Outside `$lib/server` on purpose: the cart
// page (client) validates with exactly the same rules the checkout BFF (server)
// enforces, so the customer never gets past a form the server would reject — and
// the server never trusts that the form ran. Framework- and side-effect-free,
// unit-testable in plain Node.
//
// v1 ships inside Switzerland only (the `shipping_rates` table is Swiss Post), so
// the country is fixed rather than asked for.

export const SHIPPING_COUNTRY = 'CH';

// A delivery address as the customer enters it. Every field is a plain (trimmed)
// string — `line2` is the only optional *content*, carried as `''` when unused so
// the shape never goes partial between the form, the order snapshot and Stripe.
export interface ShippingAddress {
	name: string;
	line1: string;
	line2: string;
	postalCode: string;
	city: string;
	country: typeof SHIPPING_COUNTRY;
}

// The fields the form renders, in render order. `country` is absent: it is fixed.
export const SHIPPING_ADDRESS_FIELDS = ['name', 'line1', 'line2', 'postalCode', 'city'] as const;

export type ShippingAddressField = (typeof SHIPPING_ADDRESS_FIELDS)[number];

// Generous per-field ceiling: longer than any real Swiss address line, short
// enough to keep junk out of the order snapshot and inside Stripe's own limits.
// Exported so the form's `maxlength` can't drift from what validation enforces.
export const MAX_ADDRESS_FIELD_LENGTH = 100;

// Swiss postcodes (NPA/PLZ) are four digits and never start with 0 — 1000 (Lausanne)
// through 9658. A stricter range check would need the full NPA list; the leading
// digit catches the realistic typos (3 digits, 5 digits, a leading zero).
const SWISS_POSTAL_CODE = /^[1-9]\d{3}$/;

// An empty address, the form's starting state.
export function emptyShippingAddress(): ShippingAddress {
	return { name: '', line1: '', line2: '', postalCode: '', city: '', country: SHIPPING_COUNTRY };
}

// Narrow an untrusted value (request body / form state) to the address shape:
// every field trimmed to a string, anything non-string dropped to `''`, the
// country forced to CH. Never throws — `validateShippingAddress` reports what is
// wrong with the result.
export function parseShippingAddress(value: unknown): ShippingAddress {
	const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
	const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

	return {
		name: str(raw.name),
		line1: str(raw.line1),
		line2: str(raw.line2),
		postalCode: str(raw.postalCode),
		city: str(raw.city),
		country: SHIPPING_COUNTRY
	};
}

// The fields that fail validation, in form order — empty means the address is
// deliverable. Required: a recipient, a street line, a 4-digit Swiss postcode and
// a town. `line2` is optional, but still length-capped when filled.
export function validateShippingAddress(address: ShippingAddress): ShippingAddressField[] {
	const tooLong = (value: string): boolean => value.length > MAX_ADDRESS_FIELD_LENGTH;
	const invalid: ShippingAddressField[] = [];

	// A single character is a typo, not a recipient; the same for a street.
	if (address.name.length < 2 || tooLong(address.name)) invalid.push('name');
	if (address.line1.length < 3 || tooLong(address.line1)) invalid.push('line1');
	if (tooLong(address.line2)) invalid.push('line2');
	if (!SWISS_POSTAL_CODE.test(address.postalCode)) invalid.push('postalCode');
	if (address.city.length < 2 || tooLong(address.city)) invalid.push('city');

	return invalid;
}

// Deliverable? The guard the checkout BFF uses before it creates an order.
export function isCompleteShippingAddress(address: ShippingAddress): boolean {
	return validateShippingAddress(address).length === 0;
}
