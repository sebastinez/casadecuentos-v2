import type PocketBase from 'pocketbase';

// Phase 8 — landing-page content reads (banners + curated featured books).
// Thin read-wrappers over PocketBase, integration-tested rather than unit-tested
// (PRD: "Content" reads are covered by a real PocketBase, not mock-heavy unit
// tests). Image URLs are minted server-side so the browser never talks to
// PocketBase — same invariant the catalog reads keep.

export type BannerType = 'hero' | 'featured';

// Banner as the landing page consumes it: localizable copy in base columns
// (read through `localizedField` in the component for v2-readiness) plus a
// ready-to-render image URL (or null → the page shows a gradient fallback).
export interface Banner {
	id: string;
	type: BannerType;
	title: string;
	subtitle: string;
	cta_label: string;
	cta_link: string;
	image: string | null;
}

// Raw banner record. `image` is the stored filename here; `start`/`end` are the
// optional schedule bounds (empty string when unset). `collectionId`/
// `collectionName` are needed by `pb.files.getURL`. Carries through any future
// `*_de` columns implicitly (no `fields` projection), so `localizedField` works.
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

// A banner is shown only while inside its (optional) schedule window. An empty
// bound means "no limit". Done in JS rather than the PocketBase filter on
// purpose: PocketBase stores an unset date as an empty string, and folding that
// into a `@now` comparison risks silently dropping windowless banners — the
// explicit empty-check here is unambiguous. PocketBase emits dates as
// `YYYY-MM-DD HH:MM:SS.sssZ`; normalize the space to `T` for `Date.parse`.
function inWindow(banner: BannerSource, now: number): boolean {
	if (banner.start && Date.parse(banner.start.replace(' ', 'T')) > now) return false;
	if (banner.end && Date.parse(banner.end.replace(' ', 'T')) < now) return false;
	return true;
}

// List active, in-window banners of one placement (`hero` | `featured`) in the
// owner-defined sort order. `active = true` and the type are filtered in
// PocketBase; the schedule window is applied here. `type` is a fixed literal,
// not user input, but it is still parameterized through `pb.filter` for
// consistency with the catalog reads.
export async function listBanners(pb: PocketBase, type: BannerType): Promise<Banner[]> {
	const records = await pb.collection('banners').getFullList<BannerSource>({
		// Hero + featured are read from the same collection in one parallel
		// `Promise.all`; without a distinct request key the SDK auto-cancels the
		// duplicate `banners` request. Key per-type to keep them independent.
		requestKey: `banners-${type}`,
		filter: pb.filter('type = {:type} && active = true', { type }),
		sort: 'sort'
	});

	const now = Date.now();
	const thumb = type === 'hero' ? '1200x0' : '800x0';

	return records
		.filter((r) => inWindow(r, now))
		.map((r) => ({
			...r,
			image: r.image ? pb.files.getURL(r, r.image, { thumb }) : null
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

// Source book as it arrives under `expand.book` (intrinsic fields + the cover
// filename and the file-URL metadata to mint a thumbnail).
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

// List the curated featured books in the owner-defined order. Only `active`
// rows, sorted by `sort`, with the book relation expanded. A curation row whose
// book was deleted (or whose expand didn't resolve) is dropped — same posture as
// `getBooksByIds` dropping unresolved ids — so a stale row never renders blank.
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
