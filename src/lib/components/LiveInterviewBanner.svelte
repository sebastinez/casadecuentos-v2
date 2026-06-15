<script lang="ts">
	import { t, localizedField, DEFAULT_LOCALE, type Locale } from '$lib/i18n';
	import type { Banner } from '$lib/server/content';

	let { banner }: { banner: Banner } = $props();

	const locale: Locale = DEFAULT_LOCALE;

	const title = $derived(localizedField(banner, 'title', locale));
	const subtitle = $derived(localizedField(banner, 'subtitle', locale));
	const ctaLabel = $derived(localizedField(banner, 'cta_label', locale));
</script>

<!-- Live-interview announcement. Separate from `HeroCarousel`, which assumes
     internal same-tab links: here `cta_link` is an ABSOLUTE YouTube URL opened
     in a new tab. Rendered only when an interview is active + in-window. -->
<section
	class="mb-8 flex flex-col items-start gap-3 rounded-xl border border-terracotta-200 bg-terracotta-50 p-6 sm:flex-row sm:items-center sm:justify-between"
	aria-label={t('videos.liveLabel', locale)}
>
	<div>
		<p class="text-xs font-semibold tracking-wide text-terracotta-700 uppercase">
			{t('videos.liveBadge', locale)}
		</p>
		{#if title}
			<h2 class="mt-1 text-xl font-semibold text-gray-900">{title}</h2>
		{/if}
		{#if subtitle}
			<p class="mt-1 text-gray-600">{subtitle}</p>
		{/if}
	</div>
	{#if banner.cta_link && ctaLabel}
		<a
			href={banner.cta_link}
			target="_blank"
			rel="noopener noreferrer"
			class="inline-block shrink-0 rounded-md bg-terracotta-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-terracotta-800"
		>
			{ctaLabel}
		</a>
	{/if}
</section>
