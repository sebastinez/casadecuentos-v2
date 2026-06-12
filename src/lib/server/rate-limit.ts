// A tiny in-memory fixed-window rate limiter. Sufficient for v1: one VPS, one
// Node process (per the PRD's single-box deploy), so process-local state is the
// whole picture — no Redis, no shared store. Used to throttle contact-form
// submissions per client IP (honeypot handles bots; this handles flooding).
//
// Caveat for Phase 12: behind Caddy, `getClientAddress()` must see the real
// client IP (proxy forwards it), else every request shares one key and the
// limit becomes global. Not a concern in local dev.

interface Window {
	count: number;
	// Epoch ms when the current window opened.
	start: number;
}

export interface RateLimiter {
	// Returns true if this key is allowed (and records the hit), false if it has
	// exhausted its quota for the current window.
	check(key: string): boolean;
}

// Build a fixed-window limiter allowing `limit` hits per `windowMs` per key.
// Expired windows are pruned lazily on each `check` so the map can't grow
// unbounded under a stream of distinct IPs.
export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
	const windows = new Map<string, Window>();

	return {
		check(key: string): boolean {
			const now = Date.now();

			// Prune any window that has fully elapsed (cheap; bounds memory).
			for (const [k, w] of windows) {
				if (now - w.start >= windowMs) windows.delete(k);
			}

			const existing = windows.get(key);
			if (!existing || now - existing.start >= windowMs) {
				windows.set(key, { count: 1, start: now });
				return true;
			}

			if (existing.count >= limit) return false;
			existing.count += 1;
			return true;
		}
	};
}
