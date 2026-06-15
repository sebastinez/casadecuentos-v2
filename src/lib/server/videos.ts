import type PocketBase from 'pocketbase';
import { watchUrl, thumbnailUrl } from '$lib/youtube';

// Phase: videos — the `videos` read. A thin read-wrapper over PocketBase
// (integration-tested, not unit-tested, per the repo split — the bug-prone
// logic lives in the pure `$lib/youtube` module, which IS unit-tested). Mirrors
// `listUpcomingEvents`/`listBanners`. Videos store only a bare YouTube
// `video_id`; the watch + thumbnail URLs are derived server-side so the BFF
// shape is ready to render.

// A video as the /videos page consumes it. `title`/`description` are localizable
// base columns (read through `localizedField` in the card for v2-readiness);
// `published` is the PocketBase datetime that drives ordering. `watchUrl` /
// `thumbnailUrl` are derived from `video_id`. No `fields` projection, so any
// future `*_de` column carries through implicitly for `localizedField`.
export interface VideoRecord {
	id: string;
	video_id: string;
	title: string;
	description: string;
	published: string;
	watchUrl: string;
	thumbnailUrl: string;
}

// Source video record (intrinsic fields; carries through any future `*_de`).
interface VideoSource {
	id: string;
	video_id: string;
	title: string;
	description: string;
	published: string;
}

// List the active videos, newest `published` first. `active = true` is filtered
// in PocketBase; ordering is purely by `published` (no manual reordering in v1).
// The derived watch/thumbnail URLs are attached here so the page never sees a
// bare `video_id`.
export async function listVideos(pb: PocketBase): Promise<VideoRecord[]> {
	const records = await pb.collection('videos').getFullList<VideoSource>({
		filter: 'active = true',
		sort: '-published'
	});

	return records.map((r) => ({
		...r,
		watchUrl: watchUrl(r.video_id),
		thumbnailUrl: thumbnailUrl(r.video_id)
	}));
}
