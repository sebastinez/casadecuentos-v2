<script lang="ts">
	import { onMount } from 'svelte';
	import { t, localizedField, DEFAULT_LOCALE, type Locale } from '$lib/i18n';
	import type { Banner } from '$lib/server/content';

	let { banners }: { banners: Banner[] } = $props();

	const locale: Locale = DEFAULT_LOCALE;

	let current = $state(0);
	// Auto-advance pauses while the customer is interacting (hover/focus) so the
	// slide doesn't move out from under them.
	let paused = $state(false);

	// Controls + auto-advance only make sense with more than one slide.
	const multiple = $derived(banners.length > 1);

	function go(index: number) {
		current = (index + banners.length) % banners.length;
	}

	onMount(() => {
		if (banners.length <= 1) return;
		// Respect prefers-reduced-motion: no automatic movement. The customer can
		// still advance manually via the controls.
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		const id = setInterval(() => {
			if (!paused) go(current + 1);
		}, 6000);
		return () => clearInterval(id);
	});
</script>

<section
	class="relative overflow-hidden rounded-xl border border-gray-200"
	aria-roledescription="carousel"
	aria-label={t('home.hero.label', locale)}
	onmouseenter={() => (paused = true)}
	onmouseleave={() => (paused = false)}
	onfocusin={() => (paused = true)}
	onfocusout={() => (paused = false)}
>
	{#each banners as banner, i (banner.id)}
		{@const title = localizedField(banner, 'title', locale)}
		{@const subtitle = localizedField(banner, 'subtitle', locale)}
		{@const ctaLabel = localizedField(banner, 'cta_label', locale)}
		<div
			class="flex min-h-[18rem] flex-col items-start justify-end bg-gradient-to-br from-gray-800 to-gray-600 bg-cover bg-center p-8 text-white sm:min-h-[24rem]"
			class:hidden={i !== current}
			style={banner.image ? `background-image:url('${banner.image}')` : ''}
			role="group"
			aria-roledescription="slide"
			aria-label={`${i + 1} / ${banners.length}`}
			aria-hidden={i !== current}
		>
			<!-- Scrim so light cover art keeps the text legible. -->
			<div class="absolute inset-0 bg-black/30"></div>
			<div class="relative max-w-xl">
				{#if title}
					<h2 class="text-3xl font-semibold tracking-tight drop-shadow sm:text-4xl">{title}</h2>
				{/if}
				{#if subtitle}
					<p class="mt-3 text-lg text-white/90 drop-shadow">{subtitle}</p>
				{/if}
				{#if banner.cta_link && ctaLabel}
					<a
						href={banner.cta_link}
						class="mt-6 inline-block rounded-md bg-white px-5 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100"
					>
						{ctaLabel}
					</a>
				{/if}
			</div>
		</div>
	{/each}

	{#if multiple}
		<button
			type="button"
			onclick={() => go(current - 1)}
			aria-label={t('home.hero.prev', locale)}
			class="absolute top-1/2 left-3 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-gray-900 hover:bg-white"
		>
			<span aria-hidden="true">‹</span>
		</button>
		<button
			type="button"
			onclick={() => go(current + 1)}
			aria-label={t('home.hero.next', locale)}
			class="absolute top-1/2 right-3 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-gray-900 hover:bg-white"
		>
			<span aria-hidden="true">›</span>
		</button>
		<div class="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-2">
			{#each banners as banner, i (banner.id)}
				<button
					type="button"
					onclick={() => go(i)}
					aria-label={`${t('home.hero.goTo', locale)} ${i + 1}`}
					aria-current={i === current}
					class="h-2.5 w-2.5 rounded-full {i === current ? 'bg-white' : 'bg-white/50'}"
				></button>
			{/each}
		</div>
	{/if}
</section>
