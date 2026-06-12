import type PocketBase from 'pocketbase';
import { ClientResponseError } from 'pocketbase';
import { zurichToday } from '$lib/datetime';

// Phase 9 — event reads. Thin read-wrappers over PocketBase (integration-tested,
// not unit-tested, per the PRD; the bug-prone civil-date logic lives in the pure
// `$lib/datetime` module, which IS unit-tested). Events carry no images, so —
// unlike the catalog reads — nothing here mints file URLs.

// An event as the listing/detail pages consume it. `title`/`description` are
// localizable base columns (read through `localizedField` in the component for
// v2-readiness); `date`/`time` are Europe/Zurich wall-clock text; lat/lng are the
// optional map pin (0 when unset — the detail page hides the map unless both are
// real coordinates). No `fields` projection, so any future `*_de` column carries
// through implicitly for `localizedField`.
export interface EventRecord {
	id: string;
	title: string;
	description: string;
	date: string;
	time: string;
	venue_address: string;
	latitude: number;
	longitude: number;
	slug: string;
}

// List upcoming events (today onward, in Europe/Zurich), soonest first. Past
// events are auto-hidden by a lexical compare against today's Zurich civil date —
// sound because `date` is stored in the same `YYYY-MM-DD` representation. An event
// stays visible through the whole of its own day (`>=`). Secondary sort by `time`
// orders same-day events chronologically (zero-padded `HH:MM`, enforced by the
// collection's text pattern).
export async function listUpcomingEvents(pb: PocketBase): Promise<EventRecord[]> {
	return pb.collection('events').getFullList<EventRecord>({
		filter: pb.filter('date >= {:today}', { today: zurichToday() }),
		sort: 'date,time'
	});
}

// Fetch a single event by slug. Returns `null` when no event matches (the route
// turns that into a 404); any other error propagates so real failures aren't
// masked as "not found". `pb.filter` parameterizes the slug against injection.
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
