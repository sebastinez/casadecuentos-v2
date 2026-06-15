<script lang="ts">
	import { t, localizedField, DEFAULT_LOCALE, type Locale } from '$lib/i18n';
	import { formatPublishedDate } from '$lib/datetime';
	import type { VideoRecord } from '$lib/server/videos';

	let { video }: { video: VideoRecord } = $props();

	const locale: Locale = DEFAULT_LOCALE;

	const title = $derived(localizedField(video, 'title', locale));
	const description = $derived(localizedField(video, 'description', locale));
</script>

<!-- Whole-card link out to YouTube in a new tab: the customer keeps the store
     open behind them and watches on the platform (no embedded player). -->
<a
	href={video.watchUrl}
	target="_blank"
	rel="noopener noreferrer"
	class="flex h-full flex-col overflow-hidden rounded-lg border border-gray-200 hover:border-gray-400"
>
	<!-- 16:9 thumbnail. `hqdefault` is letterboxed 4:3, so `object-cover` crops
	     the bars away. The play-icon overlay marks it as a video. -->
	<div class="relative aspect-video overflow-hidden bg-gray-100">
		<img
			src={video.thumbnailUrl}
			alt={t('video.thumbnailAlt', locale)}
			loading="lazy"
			class="h-full w-full object-cover"
		/>
		<div class="absolute inset-0 flex items-center justify-center">
			<span
				class="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white"
				aria-hidden="true"
			>
				<svg viewBox="0 0 24 24" fill="currentColor" class="ml-0.5 h-6 w-6">
					<path d="M8 5v14l11-7z" />
				</svg>
			</span>
		</div>
	</div>

	<div class="flex flex-1 flex-col p-4">
		<h2 class="line-clamp-2 font-medium">{title}</h2>
		<p class="mt-1 text-sm text-gray-500">{formatPublishedDate(video.published, locale)}</p>
		{#if description}
			<p class="mt-2 line-clamp-2 text-sm text-gray-600">{description}</p>
		{/if}
	</div>
</a>
