import { describe, it, expect } from 'vitest';
import { createCatalogIndex, searchCatalog, type SearchEntry } from './catalog-index';

// A small, deliberately-unambiguous fixture catalog. Each entry's matchable
// fields are chosen so a given query has one obviously-correct target, which
// keeps the ranking and field-coverage assertions from depending on Fuse
// scoring subtleties.
const entries: SearchEntry[] = [
	{
		id: '1',
		title: 'La pequeña oruga glotona',
		author: 'Eric Carle',
		illustrator: 'Eric Carle',
		slug: 'oruga',
		cover: null
	},
	{
		id: '2',
		title: 'Donde viven los monstruos',
		author: 'Maurice Sendak',
		illustrator: 'Maurice Sendak',
		slug: 'monstruos',
		cover: null
	},
	{
		id: '3',
		title: 'Cuentos de la selva',
		author: 'Horacio Quiroga',
		illustrator: 'Wanda Gág',
		slug: 'selva',
		cover: null
	},
	// Ranking pair: the term "Gato" appears as a full title on one book and only
	// as an author on another. The title weight must make the title hit win.
	{
		id: '4',
		title: 'Gato',
		author: 'Anónimo',
		illustrator: 'Anónimo',
		slug: 'gato-title',
		cover: null
	},
	{
		id: '5',
		title: 'Aventuras nocturnas',
		author: 'Gato Pérez',
		illustrator: 'Otro',
		slug: 'gato-author',
		cover: null
	}
];

const index = createCatalogIndex(entries);

const slugs = (results: SearchEntry[]) => results.map((r) => r.slug);

describe('searchCatalog', () => {
	it('returns an exact title hit', () => {
		const results = searchCatalog(index, 'oruga');
		expect(slugs(results)).toContain('oruga');
		expect(results[0].slug).toBe('oruga');
	});

	it('tolerates a one-character typo in a title', () => {
		// "orugo" is one substitution away from the title token "oruga".
		const results = searchCatalog(index, 'orugo');
		expect(slugs(results)).toContain('oruga');
	});

	it('ranks a title match above an author-only match for the same term', () => {
		const results = searchCatalog(index, 'Gato');
		const titleHit = slugs(results).indexOf('gato-title');
		const authorHit = slugs(results).indexOf('gato-author');
		expect(titleHit).toBeGreaterThanOrEqual(0);
		expect(authorHit).toBeGreaterThan(titleHit);
	});

	it('returns nothing for an empty or whitespace-only query', () => {
		expect(searchCatalog(index, '')).toEqual([]);
		expect(searchCatalog(index, '   ')).toEqual([]);
	});

	it('returns nothing for input that matches no book', () => {
		expect(searchCatalog(index, 'zzzzz')).toEqual([]);
	});

	it('covers all three searchable fields (title, author, illustrator)', () => {
		// Title-only term.
		expect(slugs(searchCatalog(index, 'monstruos'))).toContain('monstruos');
		// Author-only term (surname mid-string — relies on ignoreLocation).
		expect(slugs(searchCatalog(index, 'Quiroga'))).toContain('selva');
		// Illustrator-only term (appears in no title or author).
		expect(slugs(searchCatalog(index, 'Wanda'))).toContain('selva');
	});

	it('caps results at the requested limit', () => {
		// "a" is a loose query that fuzzily touches many entries; the limit must
		// still bound the returned list.
		const results = searchCatalog(index, 'a', 2);
		expect(results.length).toBeLessThanOrEqual(2);
	});
});
