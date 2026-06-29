import { redirect, type Handle } from '@sveltejs/kit';
import { DEFAULT_LOCALE, LOCALES, isLocale, localeFromPathname, type Locale } from '$lib/i18n';

const LOCALE_COOKIE = 'locale';

// `/api/*` (BFF endpoints + the Stripe webhook) is locale-agnostic and must never be
// prefixed or redirected — the webhook URL in particular is fixed in the Stripe
// dashboard.
function needsLocalePrefix(pathname: string): boolean {
	return !pathname.startsWith('/api');
}

// Pick the locale for a first-time (unprefixed) visit: an explicit cookie choice wins,
// otherwise the browser's `Accept-Language` preference, otherwise Spanish.
function detectLocale(request: Request, cookieValue: string | undefined): Locale {
	if (cookieValue && isLocale(cookieValue)) return cookieValue;

	const header = request.headers.get('accept-language') ?? '';
	for (const part of header.split(',')) {
		const tag = part.trim().split(';')[0].toLowerCase().slice(0, 2);
		if (isLocale(tag)) return tag;
	}
	return DEFAULT_LOCALE;
}

export const handle: Handle = async ({ event, resolve }) => {
	const { pathname, search } = event.url;
	const fromUrl = localeFromPathname(pathname);

	if (fromUrl) {
		// Prefixed path: this is the source of truth. Remember the choice so direct
		// links and the switcher persist across the unprefixed entry points.
		event.locals.locale = fromUrl;
		event.cookies.set(LOCALE_COOKIE, fromUrl, { path: '/', maxAge: 60 * 60 * 24 * 365 });
	} else if (needsLocalePrefix(pathname)) {
		// Unprefixed page request → send the visitor to their locale's prefix, keeping
		// the rest of the path and query string intact.
		const target = detectLocale(event.request, event.cookies.get(LOCALE_COOKIE));
		const rest = pathname === '/' ? '' : pathname;
		redirect(307, `/${target}${rest}${search}`);
	} else {
		// `/api/*`: no URL prefix to read, so resolve the locale the same way a
		// first-time page visit would (cookie set on the last prefixed visit →
		// Accept-Language → Spanish). Lets BFF endpoints (e.g. checkout) localize
		// their side effects — the buyer's Stripe page + confirmation email.
		event.locals.locale = detectLocale(event.request, event.cookies.get(LOCALE_COOKIE));
	}

	return resolve(event, {
		transformPageChunk: ({ html }) => html.replace('%lang%', event.locals.locale)
	});
};

export { LOCALE_COOKIE, LOCALES };
