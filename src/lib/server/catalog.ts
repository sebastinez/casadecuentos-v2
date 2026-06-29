import type PocketBase from 'pocketbase';
import { ClientResponseError, type ListResult } from 'pocketbase';
import type { SearchEntry } from '$lib/search/catalog-index';

// Also drives the listing's page index. Passed explicitly because PocketBase
// defaults `perPage` to 30.
export const BOOKS_PER_PAGE = 20;

// A taxonomy record (genre / publisher / language). `genres` and `book_languages`
// carry localized `name_es`/`name_de` (read via `localizedField`); `publishers` keeps a
// single intrinsic `name` (proper nouns, not translated). All three flow through this
// one shape, so every label field is optional.
export interface Taxon {
	id: string;
	name?: string;
	name_es?: string;
	name_de?: string;
	slug: string;
}

// Bibliographic fields (title/author/illustrator/ISBN/…) are never translated;
// only `description` is localizable (via `localizedField`). Taxonomy lives in
// relations whose full records arrive under `expand` when the read requests it.
export interface Book {
	id: string;
	title: string;
	author: string;
	illustrator: string;
	slug: string;
	// Localizable (read via `localizedField`); German falls back to Spanish.
	description_es: string;
	description_de?: string;
	ISBN: string;
	format_es: string;
	format_de?: string;
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

// Whitelist of sort modes → PocketBase `sort` expressions. An unknown/absent key
// falls back to newest; a raw param passed straight through would error the query.
const SORTS = {
	newest: '-created',
	'price-asc': 'price',
	'price-desc': '-price'
} as const;

export type BookSort = keyof typeof SORTS;

// Listing query params, all optional. Empty strings count as "not set" so a
// native GET form's empty controls are ignored.
export interface BookListOptions {
	age?: string;
	genre?: string;
	publisher?: string;
	language?: string;
	q?: string;
	sort?: string;
	page?: number;
}

// Relations are matched by their `slug` sub-field (e.g. `genre.slug`) so URL
// params stay human-readable and stable across renames. `pb.filter` parameterizes
// every value, so search text and slugs can't inject into the filter expression.
// An out-of-range `page` (1-based) yields empty `items`, not an error.
export async function listBooks(
	pb: PocketBase,
	opts: BookListOptions = {}
): Promise<ListResult<Book>> {
	const parts: string[] = [pb.filter('stock > 0')];

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
	const page = opts.page && opts.page >= 1 ? opts.page : 1;

	return pb.collection('books').getList<Book>(page, BOOKS_PER_PAGE, {
		filter: parts.join(' && '),
		sort
	});
}

export async function listTaxonomy(
	pb: PocketBase,
	collection: 'genres' | 'publishers' | 'book_languages'
): Promise<Taxon[]> {
	// `publishers` sorts by its single `name`; `genres`/`book_languages` localized their
	// label into `name_es`/`name_de`, so the (Spanish) base sort key is `name_es`.
	const sort = collection === 'publishers' ? 'name' : 'name_es';
	return pb.collection(collection).getFullList<Taxon>({ sort });
}

// `cover` is the raw filename; `collectionId`/`collectionName` let `pb.files.getURL`
// mint the thumbnail URL below.
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

// Lightweight catalog index for the header fuzzy search. Mints a small cover
// thumbnail URL server-side so the browser never talks to PocketBase. Fuzzy
// matching itself is client-side (`catalog-index.ts`); this only assembles the data.
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

// One cart line, resolved fresh by id (the cart stores only id + qty).
// `price`/`stock` are read server-authoritatively for *display*; the real pricing
// and stock check happen at checkout. `cover` is a minted thumbnail URL (or null).
export interface CartBook {
	id: string;
	title: string;
	slug: string;
	price: number;
	stock: number;
	cover: string | null;
	// Shipping weight in grams (0 when unset). Lets the cart sum order weight and
	// the checkout port price shipping; structurally satisfies `AuthoritativeBook`.
	weightGrams: number;
}

// Raw record fields (snake_case) before projection, plus the file-URL fields.
interface CartBookSource extends Omit<CartBook, 'cover' | 'weightGrams'> {
	cover: string;
	weight_grams: number;
	collectionId: string;
	collectionName: string;
}

// Resolve book ids to cart-display detail. Each id is parameterized through
// `pb.filter` so the comma-separated `ids` query param can't inject. Ids matching
// no book are absent from the result (a stale/deleted id drops out of the cart).
export async function getBooksByIds(pb: PocketBase, ids: string[]): Promise<CartBook[]> {
	if (ids.length === 0) return [];

	const filter = ids.map((id) => pb.filter('id = {:id}', { id })).join(' || ');
	const records = await pb.collection('books').getFullList<CartBookSource>({
		filter,
		fields: 'id,title,slug,price,stock,cover,weight_grams,collectionId,collectionName'
	});

	return records.map((r) => ({
		id: r.id,
		title: r.title,
		slug: r.slug,
		price: r.price,
		stock: r.stock,
		cover: r.cover ? pb.files.getURL(r, r.cover, { thumb: '100x100' }) : null,
		weightGrams: r.weight_grams ?? 0
	}));
}

// Returns `null` when no book matches (the route turns that into a 404); any other
// error propagates so real failures aren't masked as "not found". `pb.filter`
// parameterizes the slug.
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
