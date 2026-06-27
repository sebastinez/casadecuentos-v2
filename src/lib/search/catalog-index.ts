import Fuse, { type IFuseOptions } from 'fuse.js';

// One row of the precomputed catalog index that drives the header fuzzy search. Only
// what the autocomplete needs: match (title/author/illustrator), link (slug), render
// (title, author, cover thumb). Not the full `Book` — bibliographic detail, price,
// and stock stay out so the index stays small. `cover` is a ready thumbnail URL (or
// null) built server-side; the client never touches PocketBase.
export interface SearchEntry {
	id: string;
	title: string;
	author: string;
	illustrator: string;
	slug: string;
	cover: string | null;
}

// Fuse keys, weighted so a title hit outranks an author/illustrator hit.
const KEYS: IFuseOptions<SearchEntry>['keys'] = [
	{ name: 'title', weight: 3 },
	{ name: 'author', weight: 2 },
	{ name: 'illustrator', weight: 1 }
];

// `threshold` balances typo tolerance against no-match. Fuse's default 0.6 is too
// loose (matches almost anything); 0.4 still matches a single typo in a real title
// but drops unrelated input. `ignoreLocation` lets a match land anywhere in the
// string (author surnames, mid-title words); without it Fuse only scores near the
// string start.
const FUSE_OPTIONS: IFuseOptions<SearchEntry> = {
	keys: KEYS,
	threshold: 0.4,
	ignoreLocation: true,
	// `shouldSort` (default true) orders results best-match-first; kept explicit
	// because the dropdown's ranking depends on it.
	shouldSort: true
};

// Build a fuzzy index over the precomputed entries. Pure and synchronous.
export function createCatalogIndex(entries: SearchEntry[]): Fuse<SearchEntry> {
	return new Fuse(entries, FUSE_OPTIONS);
}

// Run a fuzzy query, returning matches best-first, capped at `limit`. An empty or
// whitespace-only query returns `[]` (the dropdown shows nothing, not the whole
// catalog).
export function searchCatalog(index: Fuse<SearchEntry>, query: string, limit = 8): SearchEntry[] {
	const trimmed = query.trim();
	if (trimmed === '') {
		return [];
	}
	return index.search(trimmed, { limit }).map((result) => result.item);
}
