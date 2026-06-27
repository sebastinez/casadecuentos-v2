import type { CartItem } from '$lib/cart/cart';
import { totalWeightGrams, type Urgency } from '$lib/shipping';

// The security-critical entry to payment. Given the cart's *ids + quantities* only,
// builds the authoritative order — price and stock are read from a catalog port,
// never trusting a browser-supplied price. Pure and port-injected so the
// price-integrity contract is unit-testable. Builds and validates only; persisting,
// charging, and the stock decrement happen later (stock is only *checked* here,
// overselling tolerated in v1).

// catalog.ts's `getBooksByIds` returns a superset of this, so the real PocketBase
// read satisfies the port structurally.
export interface AuthoritativeBook {
	id: string;
	title: string;
	price: number;
	stock: number;
	// Shipping weight in grams (0 when unset); summed across the cart to price shipping.
	weightGrams: number;
}

// Resolve a set of ids to their authoritative price + stock. Async because the
// production implementation hits PocketBase.
export interface CatalogPort {
	getBooksByIds(ids: string[]): Promise<AuthoritativeBook[]>;
}

// One built order line, snapshotted into the `pending` order and turned into a
// Stripe line item.
export interface OrderLine {
	id: string;
	title: string;
	unitPrice: number;
	qty: number;
	lineTotal: number;
}

// Validated lines + weight-based shipping + totals, in CHF. `urgency` and
// `totalWeightGrams` are carried for the order snapshot and the Stripe
// shipping-option label.
export interface BuiltOrder {
	lines: OrderLine[];
	itemsTotal: number;
	totalWeightGrams: number;
	urgency: Urgency;
	shipping: number;
	total: number;
}

export type CheckoutErrorCode = 'empty_cart' | 'invalid_id' | 'out_of_stock';

// A typed, expected checkout failure. Carries the offending book ids so the cart
// page can name the problem line. The endpoint maps these to a 4xx with the code;
// anything else propagates as a 500.
export class CheckoutError extends Error {
	constructor(
		public readonly code: CheckoutErrorCode,
		public readonly bookIds: string[] = []
	) {
		super(code);
		this.name = 'CheckoutError';
	}
}

// Build the authoritative order from the cart's ids + quantities. The input is
// treated as id + qty only (the endpoint sanitizes the body through `parseCart`
// first), so a browser-supplied price can never reach here — every price and stock
// value is read fresh from the catalog port. Rejects (as `CheckoutError`): an empty
// cart, an id that resolves to no book (`invalid_id`), or a quantity over stock
// (`out_of_stock`). `resolveShipping` is injected (not folded in) so the PocketBase
// rate-table read stays out of this pure builder.
export async function buildOrder(
	items: CartItem[],
	catalog: CatalogPort,
	opts: { resolveShipping: (totalWeightGrams: number) => number; urgency: Urgency }
): Promise<BuiltOrder> {
	if (items.length === 0) {
		throw new CheckoutError('empty_cart');
	}

	const books = await catalog.getBooksByIds(items.map((item) => item.id));
	const byId = new Map(books.map((book) => [book.id, book]));

	// Reject ids the catalog didn't return rather than silently dropping them, so
	// the customer isn't charged for a partial cart.
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

	// Sum each book's per-unit weight × qty, then resolve the tiered cost for the
	// chosen urgency via the injected callback.
	const weightGrams = totalWeightGrams(
		items.map((item) => ({ weightGrams: byId.get(item.id)!.weightGrams, qty: item.qty }))
	);
	const shipping = opts.resolveShipping(weightGrams);

	return {
		lines,
		itemsTotal,
		totalWeightGrams: weightGrams,
		urgency: opts.urgency,
		shipping,
		total: itemsTotal + shipping
	};
}
