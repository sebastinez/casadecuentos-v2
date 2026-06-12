import type { CartItem } from '$lib/cart/cart';

// The security-critical entry to payment. Given the cart's *ids + quantities*
// only, this builds the authoritative order: it reads price and stock from a
// catalog port (PocketBase in production, a stub in tests) and never trusts any
// price the browser might have sent. Pure and port-injected so the whole
// price-integrity contract is unit-testable without real I/O or Stripe.
//
// This module builds and validates; it does not persist, charge, or decrement
// stock. Stock is *checked* here (overselling tolerated, no reservation in v1)
// and only decremented later on the `paid` webhook (Phase 6b).

// The authoritative shape the builder needs per book. `getBooksByIds` in
// `catalog.ts` returns a superset of this (it also carries slug/cover), so the
// real PocketBase read satisfies the port structurally.
export interface AuthoritativeBook {
	id: string;
	title: string;
	price: number;
	stock: number;
}

// The injected catalog port: resolve a set of ids to their authoritative price
// and stock. Async because the production implementation hits PocketBase.
export interface CatalogPort {
	getBooksByIds(ids: string[]): Promise<AuthoritativeBook[]>;
}

// One built order line: server-authoritative price captured at session creation.
// This is exactly what gets snapshotted into the `pending` order and turned into
// a Stripe line item.
export interface OrderLine {
	id: string;
	title: string;
	unitPrice: number;
	qty: number;
	lineTotal: number;
}

// The built order: validated lines + flat shipping + totals, all in plain CHF.
export interface BuiltOrder {
	lines: OrderLine[];
	itemsTotal: number;
	shipping: number;
	total: number;
}

export type CheckoutErrorCode = 'empty_cart' | 'invalid_id' | 'out_of_stock';

// A typed, expected checkout failure (vs. an unexpected throw). Carries the
// offending book ids so the cart page can name the problem line (e.g. "X is out
// of stock"). The endpoint maps these to a 4xx with the code; anything else
// propagates as a 500.
export class CheckoutError extends Error {
	constructor(
		public readonly code: CheckoutErrorCode,
		public readonly bookIds: string[] = []
	) {
		super(code);
		this.name = 'CheckoutError';
	}
}

// Build the authoritative order from the cart's ids + quantities.
//
// Trust boundary: the input `items` are treated as *only* id + qty (the
// `CartItem` type carries nothing else, and the endpoint sanitizes the request
// body through `parseCart` first), so a browser-supplied price can never reach
// here. Every price and stock value is read fresh from the catalog port.
//
// Rejects (as `CheckoutError`): an empty cart, any requested id that resolves to
// no book (`invalid_id`), and any line whose quantity exceeds available stock
// (`out_of_stock`). On success the lines carry server-authoritative prices.
export async function buildOrder(
	items: CartItem[],
	catalog: CatalogPort,
	opts: { shipping: number }
): Promise<BuiltOrder> {
	if (items.length === 0) {
		throw new CheckoutError('empty_cart');
	}

	const books = await catalog.getBooksByIds(items.map((item) => item.id));
	const byId = new Map(books.map((book) => [book.id, book]));

	// Ids the catalog didn't return are stale/unknown — reject rather than
	// silently dropping them, so the customer isn't charged for a partial cart.
	const missing = items.filter((item) => !byId.has(item.id)).map((item) => item.id);
	if (missing.length > 0) {
		throw new CheckoutError('invalid_id', missing);
	}

	// Stock check (never a decrement). Collect *all* under-stocked ids so the
	// customer sees every problem line at once, not one per retry.
	const understocked = items
		.filter((item) => item.qty > byId.get(item.id)!.stock)
		.map((item) => item.id);
	if (understocked.length > 0) {
		throw new CheckoutError('out_of_stock', understocked);
	}

	const lines: OrderLine[] = items.map((item) => {
		const book = byId.get(item.id)!;
		return {
			id: book.id,
			title: book.title,
			unitPrice: book.price,
			qty: item.qty,
			lineTotal: book.price * item.qty
		};
	});

	const itemsTotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);

	return {
		lines,
		itemsTotal,
		shipping: opts.shipping,
		total: itemsTotal + opts.shipping
	};
}
