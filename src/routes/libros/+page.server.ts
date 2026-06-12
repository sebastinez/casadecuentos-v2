import type { PageServerLoad } from './$types';
import { createPocketBase } from '$lib/server/pocketbase';
import { listBooks, listTaxonomy, type BookListOptions } from '$lib/server/catalog';

// Server-only load: the browser hits this SvelteKit endpoint, which talks to
// PocketBase. Filtering/search/sort come in as URL query params (shareable,
// bookmarkable, back-button correct) and resolve to a PocketBase filter query
// server-side — never a client-side filter of a full dump.
export const load: PageServerLoad = async ({ url }) => {
	const pb = createPocketBase();

	// Parse the facet/search/sort state straight off the URL. Missing params read
	// as '' (the catalog treats empty as "not set"), so the same parsing covers a
	// native GET form's empty controls and a hand-typed/shared URL alike.
	const filters: Required<BookListOptions> = {
		age: url.searchParams.get('age') ?? '',
		genre: url.searchParams.get('genre') ?? '',
		publisher: url.searchParams.get('publisher') ?? '',
		language: url.searchParams.get('language') ?? '',
		q: url.searchParams.get('q') ?? '',
		sort: url.searchParams.get('sort') ?? ''
	};

	// Facets for the filter dropdowns load alongside the (filtered) listing.
	const [books, genres, publishers, languages] = await Promise.all([
		listBooks(pb, filters),
		listTaxonomy(pb, 'genres'),
		listTaxonomy(pb, 'publishers'),
		listTaxonomy(pb, 'book_languages')
	]);

	return { books, filters, facets: { genres, publishers, languages } };
};
