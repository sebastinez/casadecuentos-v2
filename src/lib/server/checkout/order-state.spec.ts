import { describe, it, expect } from 'vitest';
import {
	canTransition,
	assertTransition,
	IllegalTransitionError,
	type OrderStatus
} from './order-state';

const STATES: OrderStatus[] = ['pending', 'paid', 'shipped'];

// The complete set of legal edges. Anything not listed here must be rejected —
// the exhaustive test below derives the illegal set from this so a future state
// can't slip through untested.
const LEGAL: ReadonlyArray<[OrderStatus, OrderStatus]> = [
	['pending', 'paid'],
	['paid', 'shipped']
];

describe('canTransition', () => {
	it('allows the two forward steps of the lifecycle', () => {
		expect(canTransition('pending', 'paid')).toBe(true);
		expect(canTransition('paid', 'shipped')).toBe(true);
	});

	it('rejects skipping a step (pending → shipped)', () => {
		expect(canTransition('pending', 'shipped')).toBe(false);
	});

	it('rejects moving backward (paid → pending, shipped → paid)', () => {
		expect(canTransition('paid', 'pending')).toBe(false);
		expect(canTransition('shipped', 'paid')).toBe(false);
	});

	it('rejects self-transitions — the webhook idempotency latch (paid → paid)', () => {
		expect(canTransition('pending', 'pending')).toBe(false);
		expect(canTransition('paid', 'paid')).toBe(false);
		expect(canTransition('shipped', 'shipped')).toBe(false);
	});

	it('treats every edge outside the legal set as illegal (exhaustive)', () => {
		const isLegal = (from: OrderStatus, to: OrderStatus) =>
			LEGAL.some(([f, t]) => f === from && t === to);

		for (const from of STATES) {
			for (const to of STATES) {
				expect(canTransition(from, to)).toBe(isLegal(from, to));
			}
		}
	});
});

describe('assertTransition', () => {
	it('returns silently for a legal transition', () => {
		expect(() => assertTransition('pending', 'paid')).not.toThrow();
		expect(() => assertTransition('paid', 'shipped')).not.toThrow();
	});

	it('throws IllegalTransitionError carrying both ends for an illegal step', () => {
		try {
			assertTransition('pending', 'shipped');
			expect.unreachable('should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(IllegalTransitionError);
			expect((err as IllegalTransitionError).from).toBe('pending');
			expect((err as IllegalTransitionError).to).toBe('shipped');
		}
	});
});
