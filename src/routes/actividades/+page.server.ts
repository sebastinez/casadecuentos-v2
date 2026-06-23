import type { PageServerLoad } from './$types';
import { createPocketBase } from '$lib/server/pocketbase';
import { listUpcomingEvents } from '$lib/server/events';

// Events listing load: upcoming events only (past auto-hidden in the read), in
// the BFF shape. The browser hits this SvelteKit endpoint; SvelteKit talks to
// PocketBase.
export const load: PageServerLoad = async () => {
	const pb = createPocketBase();
	const events = await listUpcomingEvents(pb);
	return { events };
};
