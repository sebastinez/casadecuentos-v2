import type { PageServerLoad } from './$types';
import { createPocketBase } from '$lib/server/pocketbase';
import { listBanners, listFeaturedBooks } from '$lib/server/content';

// Landing-page load: the hero carousel + featured promo banners come from the
// `banners` collection (split by placement), and the curated strip from
// `featured_books`. All three are independent reads, fetched in parallel. The
// browser only ever sees minted image URLs — it never talks to PocketBase.
export const load: PageServerLoad = async () => {
	const pb = createPocketBase();

	const [heroBanners, featuredBanners, featuredBooks] = await Promise.all([
		listBanners(pb, 'hero'),
		listBanners(pb, 'featured'),
		listFeaturedBooks(pb)
	]);

	return { heroBanners, featuredBanners, featuredBooks };
};
