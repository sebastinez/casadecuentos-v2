// Pure derivations from a bare YouTube `video_id` (e.g. `dQw4w9WgXcQ`). The
// `videos` collection stores only the ID — never a full URL — so both the
// watch link and the thumbnail are computed here. Pure (no I/O), so this is the
// unit-tested half of the videos feature; `listVideos` (the PocketBase read) is
// integration-tested only, the same split as `$lib/datetime` vs `events.ts`.

// The canonical watch page for a video. Cards link out here (new tab) rather
// than embedding a player — the PRD keeps viewers on YouTube and the page light.
export function watchUrl(videoId: string): string {
	return `https://www.youtube.com/watch?v=${videoId}`;
}

// The hotlinked thumbnail. `hqdefault` is deliberate: it exists for EVERY video
// (480×360, letterboxed 16:9), unlike `maxresdefault`, which silently returns a
// gray placeholder for SD/older uploads — so there is no broken-image fallback
// logic to maintain.
export function thumbnailUrl(videoId: string): string {
	return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
