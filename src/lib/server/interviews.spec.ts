import { describe, it, expect } from 'vitest';
import { selectNextInterview } from './interviews';
import type { Banner } from './content';

// Minimal `live_interview` banner factory — only `id`/`start` matter to the
// selector; the rest are filled to satisfy the type.
function banner(id: string, start: string): Banner {
	return {
		id,
		type: 'live_interview',
		title: `Interview ${id}`,
		subtitle: '',
		cta_label: '',
		cta_link: '',
		image: null,
		srcset: null,
		start
	};
}

describe('selectNextInterview', () => {
	it('returns null when there are no interviews', () => {
		expect(selectNextInterview([])).toBeNull();
	});

	it('passes a single interview through', () => {
		const only = banner('a', '2026-07-01 18:00:00.000Z');
		expect(selectNextInterview([only])).toBe(only);
	});

	it('picks the earliest start among several', () => {
		const later = banner('later', '2026-08-01 18:00:00.000Z');
		const earliest = banner('earliest', '2026-06-20 18:00:00.000Z');
		const middle = banner('middle', '2026-07-15 18:00:00.000Z');
		expect(selectNextInterview([later, earliest, middle])).toBe(earliest);
	});

	it('prefers a banner with a set start over one with an unset start', () => {
		const unset = banner('unset', '');
		const set = banner('set', '2026-07-01 18:00:00.000Z');
		expect(selectNextInterview([unset, set])).toBe(set);
		expect(selectNextInterview([set, unset])).toBe(set);
	});

	it('falls back to an unset-start banner when it is the only one', () => {
		const unset = banner('unset', '');
		expect(selectNextInterview([unset])).toBe(unset);
	});
});
