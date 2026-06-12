import { DEFAULT_LOCALE, type Locale } from './i18n';

// Pure date/time helpers for events. Events store their day/time as Europe/Zurich
// wall-clock text (`YYYY-MM-DD` / `HH:MM`), so the only real logic here is (a)
// computing "today" in Zurich for the upcoming-only filter, and (b) formatting a
// civil date for display. Both are pure (no I/O), so they're unit-tested — they're
// the most bug-prone part of Phase 9, where the thin PocketBase read-wrappers are
// not (per the PRD testing split).

const ZURICH = 'Europe/Zurich';

// Map locale → a BCP-47 tag for Intl. Spanish dates for v1; German ready for v2.
const INTL_LOCALE: Record<Locale, string> = { es: 'es-ES', de: 'de-DE' };

// "Today" as a Europe/Zurich civil date string `YYYY-MM-DD`. Used to build the
// upcoming-events filter: because event `date` is stored in the SAME civil-date
// representation, the comparison is a trivial lexical string compare against this
// — no instant↔timezone math, so no off-by-one-day at the UTC boundary. `en-CA`
// formats as `YYYY-MM-DD`; `timeZone: 'Europe/Zurich'` makes it DST-correct (the
// civil day rolls over at Zurich midnight, not UTC midnight).
export function zurichToday(now: Date = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: ZURICH,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
}

// Format a civil date `YYYY-MM-DD` as a long, human-readable date in the locale
// (e.g. `domingo, 5 de julio de 2026`). The string is a bare calendar day with no
// timezone, so we anchor it at noon UTC and format in UTC — noon avoids any
// midnight rollover, and formatting in UTC means the displayed day always equals
// the stored day regardless of the server's timezone. An unparseable value
// returns as-is rather than throwing.
export function formatEventDate(date: string, locale: Locale = DEFAULT_LOCALE): string {
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
	const at = new Date(`${date}T12:00:00Z`);
	return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
		timeZone: 'UTC',
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	}).format(at);
}
