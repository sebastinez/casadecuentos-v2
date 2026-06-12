import type { Actions } from './$types';
import { fail } from '@sveltejs/kit';
import { createAdminPocketBase } from '$lib/server/pocketbase';
import { createMailTransport, contactMessageEmail } from '$lib/server/mail';
import { createRateLimiter } from '$lib/server/rate-limit';
import { site } from '$lib/site';

// Basic email shape check — enough to reject obvious typos before we store/send.
// Not RFC-exhaustive on purpose; Resend is the real validator.
function looksLikeEmail(value: string): boolean {
	return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

// Module-scoped so the window persists across requests (a per-request limiter
// would reset every time and throttle nothing). Five submissions per IP per
// 10 minutes — generous for a human, hostile to a flood. Bots are caught
// earlier by the honeypot; this bounds abuse from a determined sender.
const limiter = createRateLimiter(5, 10 * 60_000);

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const email = String(form.get('email') ?? '').trim();
		const subject = String(form.get('subject') ?? '').trim();
		const message = String(form.get('message') ?? '').trim();
		// Honeypot: a hidden field real users never fill. Bots that blindly fill
		// every input trip it.
		const honeypot = String(form.get('website') ?? '').trim();

		const values = { name, email, subject, message };

		// Honeypot tripped → silently pretend success. Returning an error would tell
		// the bot it was detected; a success-looking response wastes its time and
		// stores/sends nothing.
		if (honeypot) {
			return { success: true };
		}

		// Rate limit is visible to humans (distinct from the silent honeypot): a
		// person hitting it gets a friendly "try later" rather than a generic error.
		if (!limiter.check(getClientAddress())) {
			return fail(429, { ...values, rateLimited: true });
		}

		if (!name || !subject || !message || !looksLikeEmail(email)) {
			return fail(400, { ...values, invalid: true });
		}

		// Store is the source of truth ("stored copy is reliability insurance"): the
		// record MUST be durably written before we consider the submission handled.
		// If this throws, the user sees a real error — their message wasn't saved.
		// Closed collection, so the BFF writes as a superuser (see the migration).
		const pb = await createAdminPocketBase();
		await pb.collection('contact_messages').create({ name, email, subject, message });

		// Owner notification is best-effort, AFTER the durable store: a Resend outage
		// must not lose a message the owner can already read in the admin.
		try {
			const mail = contactMessageEmail({ to: site.email, name, email, subject, message });
			await createMailTransport().send(mail);
		} catch (err) {
			console.error('[contact] owner notification email failed:', err);
		}

		return { success: true };
	}
};
