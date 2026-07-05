<script lang="ts">
	// Static shipping & returns notice. The prose lives in `legal-content`
	// (per-locale, es fallback); this template is locale-agnostic.
	import { page } from '$app/state';
	import { t, getLegalPage } from '$lib/i18n';

	const locale = $derived(page.data.locale);
	const content = $derived(getLegalPage('shipping', locale));
</script>

<svelte:head>
	<title>{t('shipping.heading', locale)} — {t('site.name', locale)}</title>
	<meta name="description" content={content.metaDescription} />
</svelte:head>

<article class="prose prose-sm max-w-none">
	<h1>{t('shipping.heading', locale)}</h1>

	<!-- Sections are trusted, owned HTML (no user input) — same {@html} pattern as
	     the book/event description prose. -->
	{#each content.sections as section (section.body)}
		{#if section.heading}<h2>{section.heading}</h2>{/if}
		{@html section.body}
	{/each}
</article>
