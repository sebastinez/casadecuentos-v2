import type { PageServerLoad } from './$types';
import { createPocketBase } from '$lib/server/pocketbase';
import { listVideos } from '$lib/server/videos';
import { listBanners } from '$lib/server/content';
import { selectNextInterview } from '$lib/server/interviews';

// Videos listing load: the active videos (newest first) plus the single most
// imminent live-interview banner (or null). The interview is composed from the
// reused `listBanners('live_interview')` read — already filtered by type +
// active + schedule window — narrowed to one by the pure next-interview
// selector. The browser hits this SvelteKit endpoint; SvelteKit talks to
// PocketBase.
export const load: PageServerLoad = async () => {
	const pb = createPocketBase();
	const [videos, interviews] = await Promise.all([
		listVideos(pb),
		listBanners(pb, 'live_interview')
	]);

	return { videos, liveInterview: selectNextInterview(interviews) };
};
