import type { LayoutServerLoad } from './$types';
import { DEFAULT_LOCALE, localeFromPathname } from '$lib/i18n';

// Surface the active locale to every page and component via `page.data.locale`, so
// leaf components read it from `$app/state` rather than having it prop-drilled.
//
// Derived from `url.pathname` (not `locals.locale`) on purpose: reading `url` registers
// it as a load dependency, so this load *reruns* on a client-side locale switch. With
// `reroute` collapsing `/es/...` and `/de/...` onto one canonical route, a switch
// changes only `url.pathname` — a load that read only `locals` would track no changed
// dependency and serve stale data, leaving the switcher stuck on the old locale.
// hooks.server.ts redirects unprefixed paths, so `url.pathname` is always prefixed here.
export const load: LayoutServerLoad = ({ url }) => {
	return { locale: localeFromPathname(url.pathname) ?? DEFAULT_LOCALE };
};
