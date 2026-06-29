<script lang="ts">
	import { page } from '$app/state';
	import { LOCALES, localizeHref, type Locale } from '$lib/i18n';

	let { locale }: { locale: Locale } = $props();

	// Each alternative locale links to the *current* page under its own prefix,
	// preserving the query string. Navigating there lets hooks.server.ts persist the
	// choice in the locale cookie, so unprefixed entry points remember it afterwards.
	const links = $derived(
		LOCALES.map((l) => ({
			locale: l,
			href: localizeHref(page.url.pathname, l) + page.url.search,
			active: l === locale
		}))
	);
</script>

<div class="flex items-center gap-1 text-sm" aria-label="Idioma / Sprache">
	{#each links as link, i (link.locale)}
		{#if i > 0}<span class="text-terracotta-200" aria-hidden="true">/</span>{/if}
		<a
			href={link.href}
			hreflang={link.locale}
			aria-current={link.active ? 'true' : undefined}
			class="uppercase hover:underline {link.active
				? 'font-semibold text-terracotta-700'
				: 'text-gray-500 hover:text-terracotta-700'}"
		>
			{link.locale}
		</a>
	{/each}
</div>
