// The cart's pure, framework-free core. All mutation, persistence, and parsing
// live here as pure functions over a `CartItem[]`, behind an injected storage
// port — so the whole thing is unit-testable in plain Node without runes or a
// real localStorage. The reactive Svelte layer (`cart.svelte.ts`) holds the
// `$state` and delegates every operation here. Mirrors the codebase split where
// `catalog-index.ts` is pure and `HeaderSearch.svelte` is the thin reactive shell.

// One cart line: a book id and a quantity. Deliberately the *whole* model — the
// cart never stores price, title, or any catalog detail (PRD: "book IDs +
// quantities only, never prices"). Price/stock are read server-authoritatively
// at checkout; the cart page fetches display detail fresh by id.
export interface CartItem {
	id: string;
	qty: number;
}

// The minimal slice of `localStorage` the cart needs. `window.localStorage`
// satisfies this as-is, and a test can pass a trivial in-memory fake — the
// "injected storage port" the PRD's cart test mandates. Sync, string-valued,
// matching the Web Storage signatures so no adapter is needed in the browser.
export interface StoragePort {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

// Versioned storage key: a future schema change bumps the suffix rather than
// silently mis-reading an old blob (which `parseCart` would defensively drop
// anyway).
export const CART_STORAGE_KEY = 'cdc.cart.v1';

// Coerce an arbitrary input to a whole quantity. Quantities are integers (you
// can't buy 1.5 books); fractional or non-finite input floors/zeroes so a
// garbage value can never persist or inflate the count. Returns 0 for anything
// below 1, which callers treat as "remove".
function toQty(value: number): number {
	if (!Number.isFinite(value)) return 0;
	const n = Math.floor(value);
	return n < 1 ? 0 : n;
}

// Add `qty` of a book, merging into the existing line if present (incrementing
// its quantity) or appending a new line otherwise. `qty` defaults to 1 and is
// coerced to a whole number; a non-positive `qty` is a no-op (returns the list
// unchanged) so a stray "add 0" can't create an empty line. Pure: returns a new
// array, never mutates the input.
export function addItem(items: CartItem[], id: string, qty = 1): CartItem[] {
	const add = toQty(qty);
	if (add < 1) return items;

	const existing = items.find((item) => item.id === id);
	if (existing) {
		return items.map((item) => (item.id === id ? { ...item, qty: item.qty + add } : item));
	}
	return [...items, { id, qty: add }];
}

// Set a line's quantity to an absolute value (the cart page's quantity stepper).
// `qty` at or below 0 removes the line. An id that isn't in the cart is a no-op
// — `setItemQty` only adjusts existing lines; use `addItem` to introduce one.
// Pure: returns a new array.
export function setItemQty(items: CartItem[], id: string, qty: number): CartItem[] {
	const next = toQty(qty);
	if (next < 1) return removeItem(items, id);
	if (!items.some((item) => item.id === id)) return items;
	return items.map((item) => (item.id === id ? { ...item, qty: next } : item));
}

// Drop a line entirely, regardless of its quantity. Pure: returns a new array.
export function removeItem(items: CartItem[], id: string): CartItem[] {
	return items.filter((item) => item.id !== id);
}

// Total number of books in the cart (sum of quantities), for the nav badge.
// Not the line count — three of one title reads as 3, not 1.
export function cartCount(items: CartItem[]): number {
	return items.reduce((sum, item) => sum + item.qty, 0);
}

// Parse a stored blob back into a clean `CartItem[]`. This is the trust boundary
// for localStorage: the value may be absent, corrupt, hand-edited, or a legacy
// shape carrying extra fields (e.g. a price). Every entry is rebuilt as exactly
// `{ id, qty }` with a valid whole quantity — so tampered or stale data can
// never inject prices or bad quantities into the running cart. Anything
// unparseable yields an empty cart rather than throwing.
export function parseCart(raw: string | null): CartItem[] {
	if (!raw) return [];

	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch {
		return [];
	}
	if (!Array.isArray(data)) return [];

	const items: CartItem[] = [];
	for (const entry of data) {
		if (typeof entry !== 'object' || entry === null) continue;
		const { id, qty } = entry as { id?: unknown; qty?: unknown };
		if (typeof id !== 'string' || id === '') continue;
		const n = typeof qty === 'number' ? toQty(qty) : 0;
		if (n < 1) continue;
		// Rebuilt explicitly — only id + qty survive, any extra fields are dropped.
		items.push({ id, qty: n });
	}
	return items;
}

// Serialize the cart for storage. Projects to exactly `{ id, qty }` so nothing
// beyond ids + quantities is ever written, even if a caller hands in a richer
// object.
export function serializeCart(items: CartItem[]): string {
	return JSON.stringify(items.map((item) => ({ id: item.id, qty: item.qty })));
}

// Read + parse the cart from the storage port. The round-trip entry point used
// on load/rehydrate.
export function loadCart(storage: StoragePort, key: string = CART_STORAGE_KEY): CartItem[] {
	return parseCart(storage.getItem(key));
}

// Serialize + write the cart to the storage port. The round-trip exit point used
// after every mutation.
export function saveCart(
	storage: StoragePort,
	items: CartItem[],
	key: string = CART_STORAGE_KEY
): void {
	storage.setItem(key, serializeCart(items));
}
