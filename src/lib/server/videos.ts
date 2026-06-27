import type PocketBase from 'pocketbase';
import { watchUrl, thumbnailUrl } from '$lib/youtube';

// The `videos` read. Videos store only a bare YouTube `video_id`; the watch +
// thumbnail URLs are derived server-side (via the pure `$lib/youtube`) so the BFF
// shape is ready to render.

// A video as the /videos page consumes it. `title`/`description` are localizable
// base columns (read through `localizedField`); `published` is the datetime that
// drives ordering. `watchUrl`/`thumbnailUrl` are derived from `video_id`. No
// `fields` projection, so any future `*_de` column carries through.
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

// Active videos, newest `published` first. The derived watch/thumbnail URLs are
// attached here so the page never sees a bare `video_id`.
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
