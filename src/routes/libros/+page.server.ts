import type { PageServerLoad } from './$types';
import { createPocketBase } from '$lib/server/pocketbase';
import { listBooks, listTaxonomy } from '$lib/server/catalog';

// Server-only load: the browser hits this SvelteKit endpoint, which talks to
// PocketBase. Filtering/search/sort come in as URL query params (shareable,
// bookmarkable, back-button correct) and resolve to a PocketBase filter query
// server-side — never a client-side filter of a full dump.
export const load: PageServerLoad = async ({ url }) => {
	const pb = createPocketBase();

	// Parse the facet/search/sort state straight off the URL. Missing params read
	// as '' (the catalog treats empty as "not set"), so the same parsing covers a
	// native GET form's empty controls and a hand-typed/shared URL alike.
	const filters = {
		age: url.searchParams.get('age') ?? '',
		genre: url.searchParams.get('genre') ?? '',
		publisher: url.searchParams.get('publisher') ?? '',
		language: url.searchParams.get('language') ?? '',
		q: url.searchParams.get('q') ?? '',
		sort: url.searchParams.get('sort') ?? ''
	};

	// 1-based listing page off the URL. Coerce defensively: `?page=abc` → NaN,
	// `?page=0`/negatives are out of range — all clamp to page 1. Changing a
	// filter via the GET form produces a URL with no `page`, which lands here as
	// 1, so filtering always resets to the first page.
	const page = Math.max(1, Math.floor(Number(url.searchParams.get('page'))) || 1);

	// Facets for the filter dropdowns load alongside the (filtered) listing.
	const [result, genres, publishers, languages] = await Promise.all([
		listBooks(pb, { ...filters, page }),
		listTaxonomy(pb, 'genres'),
		listTaxonomy(pb, 'publishers'),
		listTaxonomy(pb, 'book_languages')
	]);

	// `listBooks` returns raw records (`cover` is the stored filename). Mint the
	// public thumbnail URL here — same load-level minting the detail page does —
	// so the browser fetches covers straight from PocketBase's file endpoint
	// instead of resolving a bare filename against the current page (→ 404).
	const books = result.items.map((b) => ({
		...b,
		cover: b.cover ? pb.files.getURL(b, b.cover, { thumb: '300x0' }) : null
	}));

	return {
		books,
		filters,
		facets: { genres, publishers, languages },
		pagination: {
			page: result.page,
			totalPages: result.totalPages,
			totalItems: result.totalItems
		}
	};
};
