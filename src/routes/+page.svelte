<script lang="ts">
	import type { PageData } from './$types';
	import { t, localizedField, DEFAULT_LOCALE, type Locale } from '$lib/i18n';
	import HeroCarousel from '$lib/components/HeroCarousel.svelte';

	let { data }: { data: PageData } = $props();

	const locale: Locale = DEFAULT_LOCALE;
	const priceFmt = new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' });
</script>

<svelte:head>
	<title>{t('site.name', locale)}</title>
	<meta name="description" content={t('home.tagline', locale)} />
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
			href="/libros"
			class="mt-6 inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
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
				href={banner.cta_link || '/libros'}
				class="group relative flex min-h-48 flex-col justify-end overflow-hidden rounded-xl border border-gray-200 bg-gradient-to-br from-gray-700 to-gray-500 bg-cover bg-center p-6 text-white"
				style={banner.image ? `background-image:url('${banner.image}')` : ''}
			>
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
						href="/libros/{book.slug}"
						class="flex h-full flex-col rounded-lg border border-gray-200 p-3 hover:border-gray-400"
					>
						{#if book.cover}
							<img
								src={book.cover}
								alt="{t('book.coverAlt', locale)} {book.title}"
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
							<span class="text-sm font-semibold">{priceFmt.format(book.price)}</span>
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
