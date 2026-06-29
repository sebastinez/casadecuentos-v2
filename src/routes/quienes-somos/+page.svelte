<script lang="ts">
	import { page } from '$app/state';
	import { t, getAboutContent } from '$lib/i18n';
	// `?enhanced` emits a responsive, multi-format picture (AVIF/webp + the listed
	// widths) with intrinsic dimensions baked in. The source is ~4000×6000, so we
	// pin widths to the actual render slot (≤480px CSS, ×2 for retina) instead of
	// letting the plugin ship multi-megabyte halvings of the original.
	import euge from '$lib/assets/euge.webp?enhanced&w=480;960;1440';

	const locale = $derived(page.data.locale);
	const about = $derived(getAboutContent(locale));
</script>

<svelte:head>
	<title>{t('about.heading', locale)} — {t('site.name', locale)}</title>
	<meta name="description" content={t('about.metaDescription', locale)} />
</svelte:head>

<div class="grid grid-cols-1 gap-8 md:grid-cols-2 md:items-start">
	<!-- <enhanced:img> emits a <picture>; the sticky/sizing must live on a real block
	     wrapper (the grid child), not on the inner <img>, for md:sticky to work. -->
	<div class="md:sticky md:top-8">
		<enhanced:img
			src={euge}
			alt={t('about.imageAlt', locale)}
			sizes="(min-width: 768px) 480px, 100vw"
			class="block w-full rounded-lg"
		/>
	</div>

	<article class="prose prose-sm max-w-none">
		<h1>{about.greeting}</h1>

		<!-- Paragraphs carry inline <strong> emphasis as trusted, owned HTML (no user
		     input) — same {@html} pattern as the book/event description prose. -->
		{#each about.paragraphs as paragraph (paragraph)}
			<p>{@html paragraph}</p>
		{/each}
	</article>
</div>
