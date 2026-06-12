import type PocketBase from 'pocketbase';
import { ClientResponseError } from 'pocketbase';
import type { SearchEntry } from '$lib/search/catalog-index';

// A taxonomy record (genre / publisher / book language). Small relation lists
// powering filters and rename-without-code; `name` is the displayed label.
export interface Taxon {
	id: string;
	name: string;
	slug: string;
}

// Phase 2 shape of a catalog book — the full model. Intrinsic bibliographic
// fields (title/author/illustrator/ISBN/…) are never translated; only the
// store's own `description` blurb is localizable (read via `localizedField`).
// Taxonomy lives in relations (`genre`/`publisher`/`language`); their full
// records arrive under `expand` when the read requests it. Newer fields are
// optional because not every record fills them.
export interface Book {
	id: string;
	title: string;
	author: string;
	illustrator: string;
	slug: string;
	description: string;
	ISBN: string;
	format: string;
	page_count: number;
	book_size: string;
	publication_year: number;
	price: number;
	stock: number;
	cover: string;
	gallery: string[];
	age_band: string;
	genre: string;
	publisher: string;
	language: string;
	expand?: {
		genre?: Taxon;
		publisher?: Taxon;
		language?: Taxon;
	};
}

// Closed whitelist of sort modes → PocketBase `sort` expressions. Keys are the
// values used in the `sort` URL param; an unknown/absent key falls back to
// newest. Never pass a raw param straight to PocketBase — an unknown column
// errors the query.
const SORTS = {
	newest: '-created',
	'price-asc': 'price',
	'price-desc': '-price'
} as const;

export type BookSort = keyof typeof SORTS;

// Listing query: facet filters keyed by taxonomy slug / age-band value, a
// substring search, and a sort mode. All optional — an empty object lists the
// whole catalog newest-first (the Phase 1/2 behavior). Empty strings are
// treated as "not set" so a native GET form's empty controls are ignored.
export interface BookListOptions {
	age?: string;
	genre?: string;
	publisher?: string;
	language?: string;
	q?: string;
	sort?: string;
}

// Thin read-wrapper over PocketBase (integration-tested, not unit-tested, per
// the PRD). Builds a server-side PocketBase filter from the facet/search params
// and applies the whitelisted sort. Relations are matched by their `slug`
// sub-field (e.g. `genre.slug`), so URL params stay human-readable and stable
// across renames. `pb.filter` parameterizes every value, so user-supplied
// search text and slugs can't inject into the filter expression.
export async function listBooks(pb: PocketBase, opts: BookListOptions = {}): Promise<Book[]> {
	const parts: string[] = [];

	if (opts.age) parts.push(pb.filter('age_band = {:age}', { age: opts.age }));
	if (opts.genre) parts.push(pb.filter('genre.slug = {:genre}', { genre: opts.genre }));
	if (opts.publisher)
		parts.push(pb.filter('publisher.slug = {:publisher}', { publisher: opts.publisher }));
	if (opts.language)
		parts.push(pb.filter('language.slug = {:language}', { language: opts.language }));
	if (opts.q) {
		parts.push(pb.filter('(title ~ {:q} || author ~ {:q} || illustrator ~ {:q})', { q: opts.q }));
	}

	const sort = opts.sort && opts.sort in SORTS ? SORTS[opts.sort as BookSort] : SORTS.newest;

	return pb.collection('books').getFullList<Book>({
		filter: parts.join(' && '),
		sort
	});
}

// List a taxonomy collection (`genres` / `publishers` / `book_languages`) for
// the listing's filter facets, alphabetically by label. Thin read-wrapper,
// integration-tested per the PRD.
export async function listTaxonomy(
	pb: PocketBase,
	collection: 'genres' | 'publishers' | 'book_languages'
): Promise<Taxon[]> {
	return pb.collection(collection).getFullList<Taxon>({ sort: 'name' });
}

// The subset of book fields needed to build a search-index entry. `cover` is the
// raw filename here; the URL is minted below. `collectionId`/`collectionName`
// are required by `pb.files.getURL` to construct a thumbnail URL.
interface SearchEntrySource {
	id: string;
	title: string;
	author: string;
	illustrator: string;
	slug: string;
	cover: string;
	collectionId: string;
	collectionName: string;
}

// Build the lightweight, precomputed catalog index served to the header fuzzy
// search. Projects only the matchable + display fields (PocketBase `fields`
// keeps the payload small) and mints a small cover thumbnail URL server-side —
// the browser never talks to PocketBase. Thin read-wrapper, integration-tested
// per the PRD. Fuzzy matching itself is client-side (in `catalog-index.ts`); this
// only assembles the data.
export async function listSearchEntries(pb: PocketBase): Promise<SearchEntry[]> {
	const records = await pb.collection('books').getFullList<SearchEntrySource>({
		fields: 'id,title,author,illustrator,slug,cover,collectionId,collectionName',
		sort: 'title'
	});

	return records.map((r) => ({
		id: r.id,
		title: r.title,
		author: r.author,
		illustrator: r.illustrator,
		slug: r.slug,
		cover: r.cover ? pb.files.getURL(r, r.cover, { thumb: '100x100' }) : null
	}));
}

// The display shape the cart page needs per line: enough to render a row and a
// running total, resolved fresh by id (the cart itself stores only id + qty).
// `price`/`stock` are read server-authoritatively here for *display*; the real
// pricing + stock check happen at checkout (Phase 6a). `cover` is a minted
// thumbnail URL (or null) so the browser never touches PocketBase.
export interface CartBook {
	id: string;
	title: string;
	slug: string;
	price: number;
	stock: number;
	cover: string | null;
}

// As above plus the file-URL fields PocketBase needs to mint a thumbnail.
interface CartBookSource extends Omit<CartBook, 'cover'> {
	cover: string;
	collectionId: string;
	collectionName: string;
}

// Resolve a set of book ids to their cart-display detail. Thin read-wrapper,
// integration-tested per the PRD. Each id is parameterized through `pb.filter`
// (never string-concatenated) so the comma-separated `ids` query param can't
// inject into the filter. An empty id list short-circuits to no query. Ids that
// match no book are simply absent from the result — the caller renders only what
// resolves (a stale/deleted id drops out of the cart view).
export async function getBooksByIds(pb: PocketBase, ids: string[]): Promise<CartBook[]> {
	if (ids.length === 0) return [];

	const filter = ids.map((id) => pb.filter('id = {:id}', { id })).join(' || ');
	const records = await pb.collection('books').getFullList<CartBookSource>({
		filter,
		fields: 'id,title,slug,price,stock,cover,collectionId,collectionName'
	});

	return records.map((r) => ({
		id: r.id,
		title: r.title,
		slug: r.slug,
		price: r.price,
		stock: r.stock,
		cover: r.cover ? pb.files.getURL(r, r.cover, { thumb: '100x100' }) : null
	}));
}

// Fetch a single book by its slug, expanding the taxonomy relations so the
// detail page can show genre/publisher/language labels. Returns `null` when no
// book matches (the route turns that into a 404); any other error propagates so
// real failures aren't masked as "not found". `pb.filter` parameterizes the
// slug so it is safe against filter injection.
export async function getBookBySlug(pb: PocketBase, slug: string): Promise<Book | null> {
	try {
		return await pb
			.collection('books')
			.getFirstListItem<Book>(pb.filter('slug = {:slug}', { slug }), {
				expand: 'genre,publisher,language'
			});
	} catch (err) {
		if (err instanceof ClientResponseError && err.status === 404) {
			return null;
		}
		throw err;
	}
}
