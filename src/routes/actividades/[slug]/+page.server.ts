import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { createPocketBase, createAdminPocketBase } from '$lib/server/pocketbase';
import { getEventBySlug } from '$lib/server/events';
import { createMailTransport, rsvpConfirmationEmail } from '$lib/server/mail';
import { localizedField, DEFAULT_LOCALE, LOCALES, localeFromPathname } from '$lib/i18n';

// Event detail load: one event by slug (404 on miss). `canonicalUrl` carries the
// active locale prefix (per-locale indexing) and `alternates` advertises the sibling
// locale(s) via hreflang, so OG/canonical tags are correct when shared.
export const load: PageServerLoad = async ({ params, url }) => {
	const pb = createPocketBase();
	const event = await getEventBySlug(pb, params.slug);

	if (!event) {
		throw error(404, 'Evento no encontrado');
	}

	// Locale from the URL prefix (not `locals.locale`) so reading `url.pathname` makes
	// this load rerun on a client-side switch, keeping canonical/hreflang in step.
	const locale = localeFromPathname(url.pathname) ?? DEFAULT_LOCALE;
	const canonicalUrl = `${url.origin}/${locale}/actividades/${event.slug}`;
	const alternates = LOCALES.map((locale) => ({
		locale,
		url: `${url.origin}/${locale}/actividades/${event.slug}`
	}));
	return { event, canonicalUrl, alternates };
};

// Basic email shape check — enough to reject obvious typos before we store/send.
// Not RFC-exhaustive on purpose (that path lies madness); the real validation is
// whether Resend accepts it.
function looksLikeEmail(value: string): boolean {
	return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

export const actions: Actions = {
	// RSVP to a free event. The event is resolved from the route slug (not a
	// spoofable hidden field), the reservation is written by the BFF as a superuser
	// (the `rsvps` collection is fully closed — no public create), and the Spanish
	// confirmation email is best-effort: a Resend outage must not lose a reservation
	// the owner can already see in the admin. No capacity/waitlist in v1.
	rsvp: async ({ request, params, locals }) => {
		const form = await request.formData();
		const name = String(form.get('name') ?? '').trim();
		const family_name = String(form.get('family_name') ?? '').trim();
		const email = String(form.get('email') ?? '').trim();
		const phone = String(form.get('phone') ?? '').trim();

		const values = { name, family_name, email, phone };

		if (!name || !family_name || !phone || !looksLikeEmail(email)) {
			return fail(400, { ...values, invalid: true });
		}

		// Resolve the event server-side from the route, so the RSVP can't be aimed at
		// an arbitrary id and the email carries authoritative event details.
		const pubPb = createPocketBase();
		const event = await getEventBySlug(pubPb, params.slug);
		if (!event) {
			throw error(404, 'Actividad no encontrada');
		}

		const pb = await createAdminPocketBase();
		await pb.collection('rsvps').create({ event: event.id, name, family_name, email, phone });

		// Best-effort confirmation email (mirrors the order-confirmation posture):
		// the reservation is recorded regardless of send success.
		try {
			const message = rsvpConfirmationEmail(
				{
					email,
					name,
					eventTitle: localizedField(event, 'title', locals.locale),
					eventDate: event.date,
					eventTime: event.time,
					venueAddress: event.venue_address
				},
				locals.locale
			);
			await createMailTransport().send(message);
		} catch (err) {
			console.error('[rsvp] confirmation email failed:', err);
		}

		return { success: true };
	}
};
