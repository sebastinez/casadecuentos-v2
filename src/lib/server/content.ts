import type PocketBase from 'pocketbase';

// Landing-page content reads (banners + curated featured books). Image URLs are
// minted server-side so the browser never talks to PocketBase.

// `live_interview` reuses this collection for the /videos live-interview
// announcement; `image`/`sort` are unused for that placement and its `cta_link`
// holds an absolute YouTube URL (hero/featured treat it as a relative path).
export type BannerType = 'hero' | 'featured' | 'live_interview';

// Banner as the landing page consumes it: localizable copy in base columns (read
// through `localizedField` in the component) plus a ready-to-render image URL (null
// → the page shows a gradient fallback). `start` carries through so the
// next-interview selector can pick the most imminent `live_interview`; the in-window
// check already happened inside `listBanners`.
export interface Banner {
	id: string;
	type: BannerType;
	title: string;
	subtitle: string;
	cta_label: string;
	cta_link: string;
	// `image` is a single mid-size URL (the <img> fallback / preload href);
	// `srcset` lists the same image at several widths so the browser fetches the
	// smallest one that fits. Both null → the component shows the gradient.
	image: string | null;
	srcset: string | null;
	start: string;
}

// Raw banner record. `image` is the stored filename; `start`/`end` are the optional
// schedule bounds (empty string when unset). No `fields` projection, so future
// `*_de` columns carry through for `localizedField`.
interface BannerSource {
	id: string;
	type: BannerType;
	title: string;
	subtitle: string;
	cta_label: string;
	cta_link: string;
	image: string;
	start: string;
	end: string;
	collectionId: string;
	collectionName: string;
}

// A banner shows only inside its (optional) schedule window; an empty bound means
// "no limit". Done in JS, not the PocketBase filter: PocketBase stores an unset date
// as an empty string, and folding that into a `@now` comparison risks silently
// dropping windowless banners. PocketBase emits dates as `YYYY-MM-DD HH:MM:SS.sssZ`;
// normalize the space to `T` for `Date.parse`.
function inWindow(banner: BannerSource, now: number): boolean {
	if (banner.start && Date.parse(banner.start.replace(' ', 'T')) > now) return false;
	if (banner.end && Date.parse(banner.end.replace(' ', 'T')) < now) return false;
	return true;
}

// Candidate render widths per placement. Hero spans the full content column
// (max ~992px, so 1800 covers retina); featured cards are at most ~480px wide.
const SRCSET_WIDTHS: Record<BannerType, number[]> = {
	hero: [600, 900, 1200, 1800],
	featured: [400, 600, 800],
	live_interview: [600] // no image rendered for this placement
};

// List active, in-window banners of one placement in the owner-defined sort order.
// `active` + type are filtered in PocketBase; the schedule window is applied here.
export async function listBanners(pb: PocketBase, type: BannerType): Promise<Banner[]> {
	const records = await pb.collection('banners').getFullList<BannerSource>({
		// Hero + featured read the same collection in one parallel `Promise.all`;
		// without a distinct request key the SDK auto-cancels the duplicate request.
		requestKey: `banners-${type}`,
		filter: pb.filter('type = {:type} && active = true', { type }),
		sort: 'sort'
	});

	const now = Date.now();
	const widths = SRCSET_WIDTHS[type];
	const fallbackWidth = type === 'hero' ? 1200 : 800;

	return records
		.filter((r) => inWindow(r, now))
		.map((r) => ({
			...r,
			image: r.image ? pb.files.getURL(r, r.image, { thumb: `${fallbackWidth}x0` }) : null,
			srcset: r.image
				? widths
						.map((w) => `${pb.files.getURL(r, r.image, { thumb: `${w}x0` })} ${w}w`)
						.join(', ')
				: null
		}));
}

// The featured-strip display shape: enough to render a book card and link to its
// detail page (the curation collection stores only book + sort + active).
export interface FeaturedBook {
	id: string;
	title: string;
	author: string;
	slug: string;
	price: number;
	stock: number;
	cover: string | null;
}

// Source book as it arrives under `expand.book`.
interface FeaturedBookSource {
	id: string;
	title: string;
	author: string;
	slug: string;
	price: number;
	stock: number;
	cover: string;
	collectionId: string;
	collectionName: string;
}

interface FeaturedRecord {
	id: string;
	expand?: { book?: FeaturedBookSource };
}

// List the curated featured books in the owner-defined order: `active` rows, sorted
// by `sort`, with the book relation expanded. A row whose book was deleted (or whose
// expand didn't resolve) is dropped so a stale row never renders blank.
export async function listFeaturedBooks(pb: PocketBase): Promise<FeaturedBook[]> {
	const records = await pb.collection('featured_books').getFullList<FeaturedRecord>({
		filter: 'active = true',
		sort: 'sort',
		expand: 'book'
	});

	return records
		.map((r) => r.expand?.book)
		.filter((b): b is FeaturedBookSource => !!b)
		.map((b) => ({
			id: b.id,
			title: b.title,
			author: b.author,
			slug: b.slug,
			price: b.price,
			stock: b.stock,
			cover: b.cover ? pb.files.getURL(b, b.cover, { thumb: '300x0' }) : null
		}));
}
