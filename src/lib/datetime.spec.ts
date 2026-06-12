import { describe, it, expect } from 'vitest';
import { zurichToday, formatEventDate } from './datetime';

describe('zurichToday', () => {
	it('returns the civil date in YYYY-MM-DD form', () => {
		expect(zurichToday(new Date('2026-06-11T09:00:00Z'))).toBe('2026-06-11');
	});

	// Summer: Zurich is UTC+2 (CEST). 22:30Z is already past midnight in Zurich.
	it('rolls to the next day after Zurich midnight in summer (UTC+2)', () => {
		expect(zurichToday(new Date('2026-06-30T22:30:00Z'))).toBe('2026-07-01');
	});

	// Winter: Zurich is UTC+1 (CET). 23:30Z crosses Zurich midnight.
	it('rolls to the next day after Zurich midnight in winter (UTC+1)', () => {
		expect(zurichToday(new Date('2026-01-01T23:30:00Z'))).toBe('2026-01-02');
	});

	// Just before Zurich midnight it is still the same civil day, even though it's
	// already tomorrow in UTC — the case a naive UTC `toISOString().slice(0,10)`
	// would get wrong.
	it('stays on the current day just before Zurich midnight (summer)', () => {
		expect(zurichToday(new Date('2026-07-01T21:30:00Z'))).toBe('2026-07-01');
	});
});

describe('formatEventDate', () => {
	it('formats a civil date as a long Spanish date', () => {
		// 2026-07-05 is a Sunday.
		const out = formatEventDate('2026-07-05', 'es');
		expect(out).toContain('5');
		expect(out).toContain('julio');
		expect(out).toContain('2026');
		expect(out.toLowerCase()).toContain('domingo');
	});

	it('shows the stored calendar day exactly (no timezone drift)', () => {
		// Anchored at noon UTC + formatted in UTC, so a date-only value never rolls
		// to the previous/next day regardless of the host timezone.
		expect(formatEventDate('2026-01-01', 'es')).toContain('1');
		expect(formatEventDate('2026-01-01', 'es')).toContain('enero');
	});

	it('returns a malformed value unchanged instead of throwing', () => {
		expect(formatEventDate('not-a-date')).toBe('not-a-date');
	});
});
