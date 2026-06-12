import { describe, it, expect } from 'vitest';
import {
	addItem,
	setItemQty,
	removeItem,
	cartCount,
	parseCart,
	serializeCart,
	loadCart,
	saveCart,
	CART_STORAGE_KEY,
	type CartItem,
	type StoragePort
} from './cart';

// In-memory implementation of the injected storage port. Stands in for
// localStorage so the cart's persistence is exercised without a browser — the
// PRD's "injected storage port" requirement. Behaviour, not localStorage
// internals: tests assert what comes back out, never how it's stored.
function fakeStorage(initial: Record<string, string> = {}): StoragePort & {
	store: Record<string, string>;
} {
	const store: Record<string, string> = { ...initial };
	return {
		store,
		getItem: (key) => (key in store ? store[key] : null),
		setItem: (key, value) => {
			store[key] = value;
		}
	};
}

describe('addItem', () => {
	it('adds a new line with the given quantity', () => {
		expect(addItem([], 'a', 2)).toEqual([{ id: 'a', qty: 2 }]);
	});

	it('defaults the quantity to 1', () => {
		expect(addItem([], 'a')).toEqual([{ id: 'a', qty: 1 }]);
	});

	it('merges into the existing line, summing quantities', () => {
		const items = addItem([{ id: 'a', qty: 1 }], 'a', 2);
		expect(items).toEqual([{ id: 'a', qty: 3 }]);
	});

	it('keeps distinct books on separate lines', () => {
		const items = addItem(addItem([], 'a'), 'b');
		expect(items).toEqual([
			{ id: 'a', qty: 1 },
			{ id: 'b', qty: 1 }
		]);
	});

	it('is a no-op for a non-positive quantity', () => {
		expect(addItem([], 'a', 0)).toEqual([]);
		expect(addItem([], 'a', -3)).toEqual([]);
	});

	it('floors a fractional quantity to a whole number', () => {
		expect(addItem([], 'a', 2.9)).toEqual([{ id: 'a', qty: 2 }]);
	});

	it('does not mutate the input array', () => {
		const original: CartItem[] = [{ id: 'a', qty: 1 }];
		addItem(original, 'a');
		expect(original).toEqual([{ id: 'a', qty: 1 }]);
	});
});

describe('setItemQty', () => {
	it('sets an existing line to an absolute quantity', () => {
		const items = setItemQty([{ id: 'a', qty: 1 }], 'a', 5);
		expect(items).toEqual([{ id: 'a', qty: 5 }]);
	});

	it('removes the line when quantity is zero or negative', () => {
		expect(setItemQty([{ id: 'a', qty: 3 }], 'a', 0)).toEqual([]);
		expect(setItemQty([{ id: 'a', qty: 3 }], 'a', -1)).toEqual([]);
	});

	it('is a no-op for an id that is not in the cart', () => {
		const items: CartItem[] = [{ id: 'a', qty: 1 }];
		expect(setItemQty(items, 'b', 4)).toEqual([{ id: 'a', qty: 1 }]);
	});

	it('floors a fractional quantity', () => {
		expect(setItemQty([{ id: 'a', qty: 1 }], 'a', 3.7)).toEqual([{ id: 'a', qty: 3 }]);
	});
});

describe('removeItem', () => {
	it('drops the matching line and leaves the rest', () => {
		const items: CartItem[] = [
			{ id: 'a', qty: 1 },
			{ id: 'b', qty: 2 }
		];
		expect(removeItem(items, 'a')).toEqual([{ id: 'b', qty: 2 }]);
	});

	it('is a no-op when the id is absent', () => {
		const items: CartItem[] = [{ id: 'a', qty: 1 }];
		expect(removeItem(items, 'z')).toEqual([{ id: 'a', qty: 1 }]);
	});
});

describe('cartCount', () => {
	it('sums quantities across lines (not the line count)', () => {
		const items: CartItem[] = [
			{ id: 'a', qty: 2 },
			{ id: 'b', qty: 3 }
		];
		expect(cartCount(items)).toBe(5);
	});

	it('is zero for an empty cart', () => {
		expect(cartCount([])).toBe(0);
	});
});

describe('parseCart', () => {
	it('returns an empty cart for null or empty input', () => {
		expect(parseCart(null)).toEqual([]);
		expect(parseCart('')).toEqual([]);
	});

	it('returns an empty cart for malformed JSON', () => {
		expect(parseCart('{not json')).toEqual([]);
	});

	it('returns an empty cart when the payload is not an array', () => {
		expect(parseCart('{"id":"a","qty":1}')).toEqual([]);
	});

	it('drops entries with a missing/invalid id or quantity', () => {
		const raw = JSON.stringify([
			{ id: 'a', qty: 2 },
			{ id: '', qty: 1 },
			{ id: 'b', qty: 0 },
			{ id: 'c', qty: -4 },
			{ qty: 1 },
			{ id: 'd' },
			'garbage',
			null
		]);
		expect(parseCart(raw)).toEqual([{ id: 'a', qty: 2 }]);
	});

	it('strips any extra fields — a tampered/legacy blob carrying a price keeps only id + qty', () => {
		const raw = JSON.stringify([{ id: 'a', qty: 1, price: 999, title: 'spoofed' }]);
		expect(parseCart(raw)).toEqual([{ id: 'a', qty: 1 }]);
	});
});

describe('persistence round-trip via the storage port', () => {
	it('saves then loads back the same cart through the port', () => {
		const storage = fakeStorage();
		const items: CartItem[] = [
			{ id: 'a', qty: 2 },
			{ id: 'b', qty: 1 }
		];
		saveCart(storage, items);
		expect(loadCart(storage)).toEqual(items);
	});

	it('rehydrates a cart written by an earlier session (fresh load from existing storage)', () => {
		const storage = fakeStorage({
			[CART_STORAGE_KEY]: serializeCart([{ id: 'a', qty: 3 }])
		});
		expect(loadCart(storage)).toEqual([{ id: 'a', qty: 3 }]);
	});

	it('loads an empty cart when storage has no entry', () => {
		expect(loadCart(fakeStorage())).toEqual([]);
	});

	it('serializes only id + qty even if richer objects are passed in', () => {
		const dirty = [{ id: 'a', qty: 1, price: 42 }] as unknown as CartItem[];
		expect(serializeCart(dirty)).toBe('[{"id":"a","qty":1}]');
	});

	it('survives a full mutate-and-persist sequence (add/update/remove/clear)', () => {
		const storage = fakeStorage();
		let items = loadCart(storage);
		items = addItem(items, 'a', 2);
		items = addItem(items, 'b');
		items = setItemQty(items, 'a', 5);
		items = removeItem(items, 'b');
		saveCart(storage, items);
		expect(loadCart(storage)).toEqual([{ id: 'a', qty: 5 }]);

		// Clear: an empty cart round-trips as empty.
		saveCart(storage, []);
		expect(loadCart(storage)).toEqual([]);
	});
});
