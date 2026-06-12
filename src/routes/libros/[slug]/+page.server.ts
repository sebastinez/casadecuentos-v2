import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { createPocketBase } from '$lib/server/pocketbase';
import { getBookBySlug } from '$lib/server/catalog';

// Server-only load for the product detail page. Reads one book (with taxonomy
// expanded) from PocketBase; an unknown slug yields a 404. Image URLs are built
// here server-side from PocketBase file storage — per the PRD, images are the
// one resource the browser fetches from PocketBase directly (thumbnails via its
// query params), so the BFF only mints the URLs. `canonicalUrl` is absolute so
// OG/canonical tags are correct when shared on WhatsApp/Instagram.
export const load: PageServerLoad = async ({ params, url }) => {
	const pb = createPocketBase();
	const book = await getBookBySlug(pb, params.slug);

	if (!book) {
		throw error(404, 'Libro no encontrado');
	}

	const coverUrl = book.cover ? pb.files.getURL(book, book.cover, { thumb: '600x0' }) : null;
	const ogImageUrl = book.cover ? pb.files.getURL(book, book.cover, { thumb: '1200x630' }) : null;
	const canonicalUrl = `${url.origin}/libros/${book.slug}`;

	return { book, coverUrl, ogImageUrl, canonicalUrl };
};
