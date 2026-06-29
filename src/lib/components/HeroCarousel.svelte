<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { t, localizedField, localizeHref } from '$lib/i18n';
	import type { Banner } from '$lib/server/content';

	let { banners }: { banners: Banner[] } = $props();

	const locale = $derived(page.data.locale);

	let current = $state(0);
	// Auto-advance pauses while the customer is interacting (hover/focus) so the
	// slide doesn't move out from under them.
	let paused = $state(false);

	// Controls + auto-advance only make sense with more than one slide.
	const multiple = $derived(banners.length > 1);

	function go(index: number) {
		current = (index + banners.length) % banners.length;
	}

	// Fade the cover in over the brand gradient, but only when it actually arrives
	// after this action runs. The image defaults to visible (no `opacity-0` in the
	// SSR class), so it paints without waiting on hydration and still shows with JS
	// disabled; we hide-then-fade solely for the not-yet-loaded case.
	function fadeIn(node: HTMLImageElement) {
		if (node.complete && node.naturalWidth > 0) return;
		node.style.opacity = '0';
		node.addEventListener('load', () => (node.style.opacity = '1'), { once: true });
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
			class="relative flex min-h-72 flex-col items-start justify-end overflow-hidden bg-gradient-to-br from-green-800 to-green-600 p-8 text-white sm:min-h-[36rem]"
			class:hidden={i !== current}
			role="group"
			aria-roledescription="slide"
			aria-label={`${i + 1} / ${banners.length}`}
			aria-hidden={i !== current}
		>
			{#if banner.image}
				<!-- Real <img> (not a CSS background) so the first slide can be preloaded
				     and prioritised, and so each cover can fade in via use:fadeIn. -->
				<img
					src={banner.image}
					srcset={banner.srcset}
					sizes="(min-width: 1024px) 992px, 100vw"
					alt=""
					fetchpriority={i === 0 ? 'high' : null}
					loading={i === 0 ? 'eager' : 'lazy'}
					decoding="async"
					use:fadeIn
					class="absolute inset-0 h-full w-full object-cover object-bottom transition-opacity duration-500"
				/>
			{/if}
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
						href={localizeHref(banner.cta_link, locale)}
						class="mt-6 inline-block rounded-md bg-white px-5 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-100"
					>
						{ctaLabel}
					</a>
				{/if}
			</div>
		</div>
	{/each}

	{#if multiple}
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
