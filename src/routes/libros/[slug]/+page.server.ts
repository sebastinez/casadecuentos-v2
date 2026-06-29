import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { createPocketBase } from '$lib/server/pocketbase';
import { getBookBySlug } from '$lib/server/catalog';
import { DEFAULT_LOCALE, LOCALES, localeFromPathname } from '$lib/i18n';

// Server-only load for the product detail page. Reads one book (with taxonomy
// expanded) from PocketBase; an unknown slug yields a 404. Image URLs are minted
// here server-side (the image file itself is the one resource the browser fetches
// from PocketBase directly). `canonicalUrl` is absolute so OG/canonical tags are
// correct when shared on WhatsApp/Instagram.
export const load: PageServerLoad = async ({ params, url }) => {
	const pb = createPocketBase();
	const book = await getBookBySlug(pb, params.slug);

	if (!book) {
		throw error(404, 'Libro no encontrado');
	}

	// Derive the locale from the URL prefix (not `locals.locale`): reading `url.pathname`
	// makes this load rerun on a client-side locale switch, keeping the canonical/hreflang
	// tags in step with the active language.
	const locale = localeFromPathname(url.pathname) ?? DEFAULT_LOCALE;
	const coverUrl = book.cover ? pb.files.getURL(book, book.cover, { thumb: '600x0' }) : null;
	const ogImageUrl = book.cover ? pb.files.getURL(book, book.cover, { thumb: '1200x630' }) : null;
	// Canonical carries the active locale prefix so each language is indexed as its
	// own URL; `alternates` advertises the sibling locale(s) via hreflang.
	const canonicalUrl = `${url.origin}/${locale}/libros/${book.slug}`;
	const alternates = LOCALES.map((locale) => ({
		locale,
		url: `${url.origin}/${locale}/libros/${book.slug}`
	}));

	return { book, coverUrl, ogImageUrl, canonicalUrl, alternates };
};
