import Fuse, { type IFuseOptions } from 'fuse.js';

// One row of the lightweight, precomputed catalog index that drives the header
// fuzzy search. Only what the autocomplete dropdown needs: enough to match
// (title/author/illustrator), link (slug), and render a result (title, author,
// cover thumb). Deliberately NOT the full `Book` — bibliographic detail, price,
// and stock stay out so the index stays small and cacheable. `cover` is a ready
// thumbnail URL (or null) built server-side; the client never touches PocketBase.
export interface SearchEntry {
	id: string;
	title: string;
	author: string;
	illustrator: string;
	slug: string;
	cover: string | null;
}

// Fuse keys, weighted so a title hit outranks an author/illustrator hit for the
// same query. These are the three fields the PRD says are searchable.
const KEYS: IFuseOptions<SearchEntry>['keys'] = [
	{ name: 'title', weight: 3 },
	{ name: 'author', weight: 2 },
	{ name: 'illustrator', weight: 1 }
];

// `threshold` is the knob that balances the two competing requirements: typo
// tolerance (a one-character slip must still match) against no-match (garbage
// must return nothing). Fuse's default of 0.6 is too loose — it matches almost
// anything — so we tighten to 0.4: a single typo in a real title still scores
// under it, but unrelated input stays above and is dropped. `ignoreLocation`
// lets a match land anywhere in the string (needed for author surnames and
// mid-title words); without it Fuse only scores matches near the string start.
const FUSE_OPTIONS: IFuseOptions<SearchEntry> = {
	keys: KEYS,
	threshold: 0.4,
	ignoreLocation: true,
	// `shouldSort` (default true) orders results best-match-first; kept explicit
	// because the dropdown's ranking depends on it.
	shouldSort: true
};

// Build a fuzzy index over the precomputed entries. Pure and synchronous: hand
// it the entries (fetched once from the catalog-index endpoint) and it returns a
// ready Fuse instance. No I/O — this is the unit under test.
export function createCatalogIndex(entries: SearchEntry[]): Fuse<SearchEntry> {
	return new Fuse(entries, FUSE_OPTIONS);
}

// Run a fuzzy query against the index, returning matching entries best-match
// first, capped at `limit` (the dropdown shows a short list). An empty or
// whitespace-only query returns `[]` — the dropdown shows nothing rather than
// the whole catalog.
export function searchCatalog(index: Fuse<SearchEntry>, query: string, limit = 8): SearchEntry[] {
	const trimmed = query.trim();
	if (trimmed === '') {
		return [];
	}
	return index.search(trimmed, { limit }).map((result) => result.item);
}
