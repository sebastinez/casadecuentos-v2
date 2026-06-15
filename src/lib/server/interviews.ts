import type { Banner } from './content';

// Pure tie-break for the /videos live-interview banner. The page shows at most
// ONE interview announcement; given the active, in-window `live_interview`
// banners (already filtered by `listBanners`), pick the single most imminent one
// — the earliest `start`. Isolated and unit-tested because it is the one bit of
// real logic here; the PocketBase read that feeds it is integration-tested.
//
// `start` is the schedule-window lower bound (empty string when the owner left
// it unset). An unset `start` sorts last: a banner with no explicit start is
// "always on" with no announced moment, so a banner that names an imminent time
// takes precedence. Returns `null` when there are no interviews.
export function selectNextInterview(banners: Banner[]): Banner | null {
	let next: Banner | null = null;

	for (const banner of banners) {
		if (next === null || sortsBefore(banner.start, next.start)) {
			next = banner;
		}
	}

	return next;
}

// Is `start` more imminent than `other`? A set `start` always beats an unset
// one; between two set values the lexically-earlier wins (PocketBase dates are
// ISO-ish `YYYY-MM-DD HH:MM:SS...`, so a string compare is chronological).
function sortsBefore(start: string, other: string): boolean {
	if (start && !other) return true;
	if (!start) return false;
	return start < other;
}
