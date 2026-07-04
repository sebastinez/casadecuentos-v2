import type PocketBase from 'pocketbase';
import { ClientResponseError } from 'pocketbase';
import { zurichToday } from '$lib/datetime';

// Event reads. Thin read-wrappers over PocketBase; the bug-prone civil-date logic
// lives in the pure, unit-tested `$lib/datetime`. Events carry no images, so nothing
// here mints file URLs.

// An event as the listing/detail pages consume it. `title`/`description` are
// localizable base columns (read through `localizedField`); `date`/`time` are
// Europe/Zurich wall-clock text; lat/lng are the optional map pin (0 when unset → the
// detail page hides the map). No `fields` projection, so any future `*_de` column
// carries through for `localizedField`.
export interface EventRecord {
	id: string;
	// Localizable (read via `localizedField`); `_de` falls back to `_es`.
	title_es: string;
	title_de?: string;
	description_es: string;
	description_de?: string;
	date: string;
	time: string;
	venue_address: string;
	latitude: number;
	longitude: number;
	slug: string;
}

// Upcoming events (today onward, Europe/Zurich), soonest first. The lexical compare
// against today's Zurich civil date is sound because `date` is stored as
// `YYYY-MM-DD`; an event stays visible through its whole day (`>=`). Secondary sort
// by `time` roughly orders same-day events, but `time` is now free text (it can hold
// ranges/multiple blocks like "09:30 - 11:00 & 17:30 - 20:00"), so the lexical
// tiebreak is best-effort, not guaranteed chronological.
export async function listUpcomingEvents(pb: PocketBase): Promise<EventRecord[]> {
	return pb.collection('events').getFullList<EventRecord>({
		filter: pb.filter('date >= {:today}', { today: zurichToday() }),
		sort: 'date,time'
	});
}

// Returns `null` when no event matches (the route turns that into a 404); any other
// error propagates so real failures aren't masked. `pb.filter` parameterizes the slug.
export async function getEventBySlug(pb: PocketBase, slug: string): Promise<EventRecord | null> {
	try {
		return await pb
			.collection('events')
			.getFirstListItem<EventRecord>(pb.filter('slug = {:slug}', { slug }));
	} catch (err) {
		if (err instanceof ClientResponseError && err.status === 404) {
			return null;
		}
		throw err;
	}
}
