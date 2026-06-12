import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRateLimiter } from './rate-limit';

afterEach(() => vi.useRealTimers());

describe('createRateLimiter', () => {
	it('allows up to the limit then blocks within the window', () => {
		const rl = createRateLimiter(2, 60_000);
		expect(rl.check('1.1.1.1')).toBe(true);
		expect(rl.check('1.1.1.1')).toBe(true);
		expect(rl.check('1.1.1.1')).toBe(false);
	});

	it('tracks keys independently', () => {
		const rl = createRateLimiter(1, 60_000);
		expect(rl.check('a')).toBe(true);
		expect(rl.check('b')).toBe(true);
		expect(rl.check('a')).toBe(false);
	});

	it('resets after the window elapses', () => {
		vi.useFakeTimers();
		const rl = createRateLimiter(1, 60_000);
		expect(rl.check('a')).toBe(true);
		expect(rl.check('a')).toBe(false);
		vi.advanceTimersByTime(60_001);
		expect(rl.check('a')).toBe(true);
	});
});
