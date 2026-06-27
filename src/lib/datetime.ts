import { DEFAULT_LOCALE, type Locale } from './i18n';

// Pure date/time helpers for events. Events store day/time as Europe/Zurich
// wall-clock text (`YYYY-MM-DD` / `HH:MM`), so the only real logic here is computing
// "today" in Zurich for the upcoming-only filter and formatting a civil date for
// display — the bug-prone parts, kept pure and unit-tested.

const ZURICH = 'Europe/Zurich';

// Map locale → a BCP-47 tag for Intl. Spanish dates for v1; German ready for v2.
const INTL_LOCALE: Record<Locale, string> = { es: 'es-ES', de: 'de-DE' };

// "Today" as a Europe/Zurich civil date `YYYY-MM-DD`, for the upcoming-events filter.
// Event `date` is stored in the same civil-date form, so the comparison is a lexical
// string compare — no instant↔timezone math, no off-by-one-day at the UTC boundary.
// `en-CA` formats as `YYYY-MM-DD`; `timeZone` makes the rollover DST-correct (Zurich
// midnight, not UTC).
export function zurichToday(now: Date = new Date()): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: ZURICH,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).format(now);
}

// Format a civil date `YYYY-MM-DD` as a long localized date (e.g. `domingo, 5 de
// julio de 2026`). The string is a bare calendar day, so anchor at noon UTC and
// format in UTC — noon avoids any midnight rollover, UTC keeps the displayed day
// equal to the stored day regardless of the server's timezone. Unparseable → as-is.
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

// Format a video's `published` as a short localized date (e.g. `5 de julio de 2026`).
// Unlike events' civil-date text, `published` is a PocketBase datetime
// (`YYYY-MM-DD HH:MM:SS.sssZ`); we take the leading 10 chars (the calendar day) and,
// like `formatEventDate`, anchor at noon UTC. Unparseable → as-is.
export function formatPublishedDate(published: string, locale: Locale = DEFAULT_LOCALE): string {
	const day = published.slice(0, 10);
	if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return published;
	const at = new Date(`${day}T12:00:00Z`);
	return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
		timeZone: 'UTC',
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	}).format(at);
}
