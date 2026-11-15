import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { subscribeToNewsletter } from '$lib/server/newsletter';
import { createRateLimiter } from '$lib/server/rate-limit';

// Footer newsletter sign-up. Lives under /api because the form is in the root
// layout (every page), so it can't be a page form action. The browser posts
// JSON; the Resend key never leaves the server.

function looksLikeEmail(value: string): boolean {
	return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) && value.length <= 254;
}

// Module-scoped so the window persists across requests. Five sign-ups per IP
// per 10 minutes — plenty for a human, hostile to a flood.
const limiter = createRateLimiter(5, 10 * 60_000);

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	const body = (await request.json().catch(() => null)) as {
		email?: unknown;
		website?: unknown;
	} | null;
	const email = String(body?.email ?? '').trim();

	// Honeypot tripped → pretend success so the bot learns nothing.
	if (String(body?.website ?? '').trim()) {
		return json({ ok: true });
	}

	if (!limiter.check(getClientAddress())) {
		return json({ error: 'rateLimited' }, { status: 429 });
	}

	if (!looksLikeEmail(email)) {
		return json({ error: 'invalid' }, { status: 400 });
	}

	try {
		await subscribeToNewsletter(email);
	} catch (err) {
		console.error('[newsletter] subscribe failed:', err);
		return json({ error: 'failed' }, { status: 502 });
	}

	return json({ ok: true });
};
