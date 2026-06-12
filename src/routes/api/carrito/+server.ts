import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createPocketBase } from '$lib/server/pocketbase';
import { getBooksByIds } from '$lib/server/catalog';

// Resolves the cart's book ids to display detail (title/price/stock/cover) for
// the cart page. The cart lives in the browser's localStorage (ids + quantities
// only), so the page sends the ids it holds and gets back fresh, server-
// authoritative detail to render — the browser still never talks to PocketBase
// directly. Quantities stay client-side; this endpoint is purely a lookup.
//
// Ids arrive as a comma-separated `ids` param; `getBooksByIds` parameterizes
// each one. Ids that resolve to nothing are simply omitted (stale/deleted
// books), and the page renders by walking its own cart, so order and quantities
// come from the cart, not this response.
export const GET: RequestHandler = async ({ url }) => {
	const ids = (url.searchParams.get('ids') ?? '')
		.split(',')
		.map((id) => id.trim())
		.filter((id) => id !== '');

	if (ids.length === 0) return json([]);

	const pb = createPocketBase();
	const books = await getBooksByIds(pb, ids);
	return json(books);
};
