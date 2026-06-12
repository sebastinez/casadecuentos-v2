import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createPocketBase } from '$lib/server/pocketbase';
import { listSearchEntries } from '$lib/server/catalog';

// Serves the precomputed, lightweight catalog index that drives the header fuzzy
// search. The browser fetches this once (lazily, on first opening the search),
// builds a client-side Fuse index from it, and matches locally — so keystrokes
// never hit the server (that's Phase 3's `?q=` listing search, a different need).
// This endpoint deliberately does no matching; it only assembles the index.
//
// Cached briefly at the edge/browser: the catalog changes rarely and a slightly
// stale autocomplete index is harmless, while `stale-while-revalidate` keeps the
// fetch instant on repeat opens.
export const GET: RequestHandler = async ({ setHeaders }) => {
	const pb = createPocketBase();
	const entries = await listSearchEntries(pb);

	setHeaders({
		'cache-control': 'public, max-age=300, stale-while-revalidate=3600'
	});

	return json(entries);
};
