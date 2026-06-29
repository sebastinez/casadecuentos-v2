<script lang="ts">
	import type { PageData } from './$types';
	import { t, localizedField, localizeHref } from '$lib/i18n';
	import HeroCarousel from '$lib/components/HeroCarousel.svelte';

	let { data }: { data: PageData } = $props();

	const locale = $derived(data.locale);
	const priceFmt = new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' });

	// Fade promo covers in over the brand gradient, only when they arrive after this
	// action runs. Mirrors HeroCarousel: the img defaults to visible (no `opacity-0`
	// in SSR markup) so it paints without JS and degrades gracefully.
	function fadeIn(node: HTMLImageElement) {
		if (node.complete && node.naturalWidth > 0) return;
		node.style.opacity = '0';
		node.addEventListener('load', () => (node.style.opacity = '1'), { once: true });
	}
</script>

<svelte:head>
	<title>{t('site.name', locale)}</title>
	<meta name="description" content={t('home.tagline', locale)} />
	<!-- Preload the first hero cover (the LCP element) so it downloads immediately
	     instead of waiting on CSS/JS discovery. -->
	{#if data.heroBanners[0]?.image}
		<link
			rel="preload"
			as="image"
			href={data.heroBanners[0].image}
			imagesrcset={data.heroBanners[0].srcset}
			imagesizes="(min-width: 1024px) 992px, 100vw"
		/>
	{/if}
</svelte:head>

<!-- Hero: the curated carousel when banners exist; otherwise a simple branded
     fallback so `/` is never empty (e.g. before the owner adds banners). -->
{#if data.heroBanners.length > 0}
	<HeroCarousel banners={data.heroBanners} />
{:else}
	<section class="rounded-xl border border-gray-200 bg-gray-50 px-8 py-16 text-center">
		<h1 class="text-3xl font-semibold tracking-tight">{t('site.name', locale)}</h1>
		<p class="mx-auto mt-3 max-w-prose text-gray-600">{t('home.tagline', locale)}</p>
		<a
			href={localizeHref('/libros', locale)}
			class="mt-6 inline-block rounded-md bg-terracotta-600 px-4 py-2 text-sm font-medium text-white hover:bg-terracotta-700"
		>
			{t('nav.books', locale)}
		</a>
	</section>
{/if}

<!-- Featured promo banners: a grid of CTA cards driven by the same collection,
     `type = featured`. -->
{#if data.featuredBanners.length > 0}
	<div class="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2">
		{#each data.featuredBanners as banner (banner.id)}
			{@const title = localizedField(banner, 'title', locale)}
			{@const subtitle = localizedField(banner, 'subtitle', locale)}
			{@const ctaLabel = localizedField(banner, 'cta_label', locale)}
			<a
				href={localizeHref(banner.cta_link || '/libros', locale)}
				class="group relative flex min-h-72 flex-col justify-end overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-green-700 to-green-500 p-6 text-white"
			>
				{#if banner.image}
					<img
						src={banner.image}
						srcset={banner.srcset}
						sizes="(min-width: 640px) 480px, 100vw"
						alt=""
						loading="lazy"
						decoding="async"
						use:fadeIn
						class="absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500"
					/>
				{/if}
				<div class="absolute inset-0 bg-black/25 transition group-hover:bg-black/35"></div>
				<div class="relative">
					{#if title}
						<h3 class="text-xl font-semibold drop-shadow">{title}</h3>
					{/if}
					{#if subtitle}
						<p class="mt-1 text-sm text-white/90 drop-shadow">{subtitle}</p>
					{/if}
					{#if ctaLabel}
						<span class="mt-3 inline-block text-sm font-medium underline underline-offset-4">
							{ctaLabel}
						</span>
					{/if}
				</div>
			</a>
		{/each}
	</div>
{/if}

<!-- Curated featured-books strip, in the owner-defined order. -->
{#if data.featuredBooks.length > 0}
	<section class="mt-12">
		<h2 class="mb-6 text-2xl font-semibold">{t('home.featured.heading', locale)}</h2>
		<ul class="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
			{#each data.featuredBooks as book (book.id)}
				<li>
					<a
						href={localizeHref(`/libros/${book.slug}`, locale)}
						class="flex h-full flex-col rounded-lg border border-gray-200 p-3 hover:border-gray-400"
					>
						{#if book.cover}
							<img
								src={book.cover}
								alt="{t('book.coverAlt', locale)} {book.title}"
								loading="lazy"
								decoding="async"
								class="mb-3 aspect-3/4 w-full rounded-md object-cover"
							/>
						{:else}
							<div
								class="mb-3 flex aspect-3/4 w-full items-center justify-center rounded-md border border-dashed border-gray-300 bg-gray-50 text-xs text-gray-400"
							>
								{t('site.name', locale)}
							</div>
						{/if}
						<h3 class="text-sm font-medium">{book.title}</h3>
						{#if book.author}
							<p class="text-xs text-gray-600">{book.author}</p>
						{/if}
						<div class="mt-2 flex items-center justify-between">
							<span class="text-sm font-semibold text-terracotta-700"
								>{priceFmt.format(book.price)}</span
							>
							{#if book.stock <= 0}
								<span class="text-xs text-red-600">{t('books.outOfStock', locale)}</span>
							{/if}
						</div>
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}
