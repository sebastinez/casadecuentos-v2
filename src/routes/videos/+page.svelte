<script lang="ts">
	import type { PageData } from './$types';
	import { t } from '$lib/i18n';
	import VideoCard from '$lib/components/VideoCard.svelte';
	import LiveInterviewBanner from '$lib/components/LiveInterviewBanner.svelte';

	let { data }: { data: PageData } = $props();

	const locale = $derived(data.locale);
</script>

<svelte:head>
	<title>{t('videos.heading', locale)} — {t('site.name', locale)}</title>
	<meta name="description" content={t('videos.metaDescription', locale)} />
</svelte:head>

{#if data.liveInterview}
	<LiveInterviewBanner banner={data.liveInterview} />
{/if}

<h1 class="mb-6 text-2xl font-semibold">{t('videos.heading', locale)}</h1>

{#if data.videos.length === 0}
	<p class="text-gray-600">{t('videos.empty', locale)}</p>
{:else}
	<ul class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.videos as video (video.id)}
			<li>
				<VideoCard {video} />
			</li>
		{/each}
	</ul>
{/if}
