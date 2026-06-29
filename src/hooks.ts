import type { Reroute } from '@sveltejs/kit';
import { stripLocale } from '$lib/i18n';

// Map both `/es/<path>` and `/de/<path>` onto the single canonical route tree, so we
// don't duplicate every route under a `[[lang]]` directory. The locale itself is read
// back from the original URL in `hooks.server.ts` (and on the client from `page.url`).
// Unprefixed paths are left untouched here; `hooks.server.ts` redirects them to the
// active locale before they reach routing.
export const reroute: Reroute = ({ url }) => stripLocale(url.pathname);
