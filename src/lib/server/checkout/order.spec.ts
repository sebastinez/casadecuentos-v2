import { describe, it, expect } from 'vitest';
import { buildOrder, CheckoutError, type AuthoritativeBook, type CatalogPort } from './order';
import type { CartItem } from '$lib/cart/cart';

// Stubbed catalog port — the "stubbed catalog port" the PRD's price-integrity
// test mandates. Resolves only the ids it was seeded with (an id it doesn't
// know is simply absent, mirroring a stale/deleted book in PocketBase). Records
// which ids it was asked for so we can assert the builder reads authoritative
// data by id rather than trusting its input.
function fakeCatalog(books: AuthoritativeBook[]): CatalogPort & { askedFor: string[] } {
	const byId = new Map(books.map((b) => [b.id, b]));
	const askedFor: string[] = [];
	return {
		askedFor,
		getBooksByIds: async (ids) => {
			askedFor.push(...ids);
			return ids.map((id) => byId.get(id)).filter((b): b is AuthoritativeBook => b !== undefined);
		}
	};
}

const CATALOG: AuthoritativeBook[] = [
	{ id: 'a', title: 'El Principito', price: 24.9, stock: 5 },
	{ id: 'b', title: 'La Oruga', price: 12, stock: 2 },
	{ id: 'c', title: 'Agotado', price: 30, stock: 0 }
];

describe('buildOrder', () => {
	it('builds correct line items with server-authoritative prices + flat shipping', async () => {
		const catalog = fakeCatalog(CATALOG);
		const items: CartItem[] = [
			{ id: 'a', qty: 2 },
			{ id: 'b', qty: 1 }
		];

		const order = await buildOrder(items, catalog, { shipping: 8 });

		expect(order.lines).toEqual([
			{ id: 'a', title: 'El Principito', unitPrice: 24.9, qty: 2, lineTotal: 49.8 },
			{ id: 'b', title: 'La Oruga', unitPrice: 12, qty: 1, lineTotal: 12 }
		]);
		expect(order.itemsTotal).toBeCloseTo(61.8, 5);
		expect(order.shipping).toBe(8);
		expect(order.total).toBeCloseTo(69.8, 5);
	});

	it('reads price + stock from the catalog port by id', async () => {
		const catalog = fakeCatalog(CATALOG);
		await buildOrder([{ id: 'a', qty: 1 }], catalog, { shipping: 8 });
		expect(catalog.askedFor).toContain('a');
	});

	it('rejects browser-supplied prices — uses authoritative price, never the input', async () => {
		const catalog = fakeCatalog(CATALOG);
		// A tampered client posts a spoofed cheap price alongside id + qty.
		const tampered = [{ id: 'a', qty: 1, price: 0.01, title: 'spoofed' }] as unknown as CartItem[];

		const order = await buildOrder(tampered, catalog, { shipping: 8 });

		expect(order.lines[0].unitPrice).toBe(24.9);
		expect(order.lines[0].title).toBe('El Principito');
		expect(order.total).toBeCloseTo(32.9, 5);
	});

	it('throws empty_cart for no items', async () => {
		const catalog = fakeCatalog(CATALOG);
		await expect(buildOrder([], catalog, { shipping: 8 })).rejects.toMatchObject({
			name: 'CheckoutError',
			code: 'empty_cart'
		});
	});

	it('throws invalid_id when an id resolves to no book, naming the offending id', async () => {
		const catalog = fakeCatalog(CATALOG);
		const items: CartItem[] = [
			{ id: 'a', qty: 1 },
			{ id: 'ghost', qty: 1 }
		];

		await expect(buildOrder(items, catalog, { shipping: 8 })).rejects.toMatchObject({
			code: 'invalid_id',
			bookIds: ['ghost']
		});
	});

	it('throws out_of_stock when a quantity exceeds available stock', async () => {
		const catalog = fakeCatalog(CATALOG);
		// `b` has stock 2; requesting 3 is over.
		await expect(buildOrder([{ id: 'b', qty: 3 }], catalog, { shipping: 8 })).rejects.toMatchObject(
			{ code: 'out_of_stock', bookIds: ['b'] }
		);
	});

	it('treats a zero-stock book as out of stock', async () => {
		const catalog = fakeCatalog(CATALOG);
		await expect(buildOrder([{ id: 'c', qty: 1 }], catalog, { shipping: 8 })).rejects.toMatchObject(
			{ code: 'out_of_stock', bookIds: ['c'] }
		);
	});

	it('collects every under-stocked id, not just the first', async () => {
		const catalog = fakeCatalog(CATALOG);
		const items: CartItem[] = [
			{ id: 'b', qty: 3 },
			{ id: 'c', qty: 1 }
		];
		try {
			await buildOrder(items, catalog, { shipping: 8 });
			expect.unreachable('should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(CheckoutError);
			expect((err as CheckoutError).bookIds).toEqual(['b', 'c']);
		}
	});

	it('allows a quantity exactly equal to stock (boundary)', async () => {
		const catalog = fakeCatalog(CATALOG);
		const order = await buildOrder([{ id: 'b', qty: 2 }], catalog, { shipping: 8 });
		expect(order.lines[0].qty).toBe(2);
	});
});
