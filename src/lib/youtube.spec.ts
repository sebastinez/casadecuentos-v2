import { describe, it, expect } from 'vitest';
import { watchUrl, thumbnailUrl } from './youtube';

describe('watchUrl', () => {
	it('builds the canonical watch URL from a bare video id', () => {
		expect(watchUrl('dQw4w9WgXcQ')).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
	});
});

describe('thumbnailUrl', () => {
	it('builds an hqdefault thumbnail URL from a bare video id', () => {
		expect(thumbnailUrl('dQw4w9WgXcQ')).toBe(
			'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg'
		);
	});

	// hqdefault, not maxresdefault: hqdefault always exists, so no fallback logic.
	it('uses hqdefault rather than maxresdefault', () => {
		const url = thumbnailUrl('dQw4w9WgXcQ');
		expect(url).toContain('hqdefault');
		expect(url).not.toContain('maxresdefault');
	});
});
