// The cart's pure, framework-free core: all mutation, persistence, and parsing as
// pure functions over a `CartItem[]`, behind an injected storage port — so the whole
// thing is unit-testable in plain Node. The reactive Svelte layer (`cart.svelte.ts`)
// holds the `$state` and delegates every operation here.

// One cart line: a book id and a quantity — deliberately the *whole* model. The cart
// never stores price, title, or any catalog detail; price/stock are read
// server-authoritatively at checkout, and the cart page fetches display detail fresh.
export interface CartItem {
	id: string;
	qty: number;
}

// The minimal slice of `localStorage` the cart needs. `window.localStorage` satisfies
// it as-is, and a test can pass a trivial in-memory fake. Sync and string-valued,
// matching the Web Storage signatures so no adapter is needed in the browser.
export interface StoragePort {
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
}

// Versioned storage key: a future schema change bumps the suffix rather than silently
// mis-reading an old blob (which `parseCart` would defensively drop anyway).
export const CART_STORAGE_KEY = 'cdc.cart.v1';

// Coerce an arbitrary input to a whole quantity. Integers only (you can't buy 1.5
// books); fractional or non-finite input floors/zeroes so garbage can't persist or
// inflate the count. Returns 0 for anything below 1, which callers treat as "remove".
function toQty(value: number): number {
	if (!Number.isFinite(value)) return 0;
	const n = Math.floor(value);
	return n < 1 ? 0 : n;
}

// Add `qty` of a book, merging into the existing line if present or appending a new
// one. `qty` defaults to 1 and is coerced to a whole number; a non-positive `qty` is
// a no-op so a stray "add 0" can't create an empty line.
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
// `qty` at or below 0 removes the line; an id that isn't in the cart is a no-op (use
// `addItem` to introduce one).
export function setItemQty(items: CartItem[], id: string, qty: number): CartItem[] {
	const next = toQty(qty);
	if (next < 1) return removeItem(items, id);
	if (!items.some((item) => item.id === id)) return items;
	return items.map((item) => (item.id === id ? { ...item, qty: next } : item));
}

// Drop a line entirely, regardless of its quantity.
export function removeItem(items: CartItem[], id: string): CartItem[] {
	return items.filter((item) => item.id !== id);
}

// Total number of books in the cart (sum of quantities), for the nav badge — not the
// line count, so three of one title reads as 3.
export function cartCount(items: CartItem[]): number {
	return items.reduce((sum, item) => sum + item.qty, 0);
}

// Parse a stored blob into a clean `CartItem[]`. The trust boundary for localStorage:
// the value may be absent, corrupt, hand-edited, or a legacy shape carrying extra
// fields (e.g. a price). Every entry is rebuilt as exactly `{ id, qty }` with a valid
// whole quantity, so tampered or stale data can't inject prices or bad quantities.
// Anything unparseable yields an empty cart rather than throwing.
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

// Serialize the cart for storage, projecting to exactly `{ id, qty }` so nothing
// beyond ids + quantities is ever written, even if a caller hands in a richer object.
export function serializeCart(items: CartItem[]): string {
	return JSON.stringify(items.map((item) => ({ id: item.id, qty: item.qty })));
}

// Read + parse the cart from the storage port (the load/rehydrate entry point).
export function loadCart(storage: StoragePort, key: string = CART_STORAGE_KEY): CartItem[] {
	return parseCart(storage.getItem(key));
}

// Serialize + write the cart to the storage port (called after every mutation).
export function saveCart(
	storage: StoragePort,
	items: CartItem[],
	key: string = CART_STORAGE_KEY
): void {
	storage.setItem(key, serializeCart(items));
}
