<script lang="ts">
	import type { PageData } from './$types';
	import { t, localizedField, DEFAULT_LOCALE } from '$lib/i18n';
	import { cart } from '$lib/cart/cart.svelte';

	let { data }: { data: PageData } = $props();

	const locale = DEFAULT_LOCALE;
	const priceFmt = new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' });

	const book = $derived(data.book);
	const description = $derived(localizedField(book, 'description', locale));
	const inStock = $derived(book.stock > 0);

	// Plain-text excerpt of the HTML blurb for the <meta>/OG description.
	const metaDescription = $derived(
		description
			.replace(/<[^>]*>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 200)
	);

	// Bibliographic rows; only those with a value render. Genre/publisher/
	// language come from the expanded relations.
	const details = $derived(
		[
			{ label: t('book.author', locale), value: book.author },
			{ label: t('book.illustrator', locale), value: book.illustrator },
			{ label: t('book.publisher', locale), value: book.expand?.publisher?.name },
			{ label: t('book.year', locale), value: book.publication_year || '' },
			{ label: t('book.language', locale), value: book.expand?.language?.name },
			{ label: t('book.genre', locale), value: book.expand?.genre?.name },
			{
				label: t('book.ageBand', locale),
				value: book.age_band ? t(`age.${book.age_band}`, locale) : ''
			},
			{ label: t('book.format', locale), value: book.format },
			{ label: t('book.pages', locale), value: book.page_count || '' },
			{ label: t('book.size', locale), value: book.book_size },
			{ label: t('book.isbn', locale), value: book.ISBN }
		].filter((row) => row.value !== '' && row.value != null)
	);
</script>

<svelte:head>
	<title>{book.title} — {t('site.name', locale)}</title>
	<meta name="description" content={metaDescription} />
	<link rel="canonical" href={data.canonicalUrl} />
	<meta property="og:type" content="product" />
	<meta property="og:title" content={book.title} />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:url" content={data.canonicalUrl} />
	{#if data.ogImageUrl}
		<meta property="og:image" content={data.ogImageUrl} />
	{/if}
	<meta name="twitter:card" content={data.ogImageUrl ? 'summary_large_image' : 'summary'} />
	<meta name="twitter:title" content={book.title} />
	<meta name="twitter:description" content={metaDescription} />
	{#if data.ogImageUrl}
		<meta name="twitter:image" content={data.ogImageUrl} />
	{/if}
</svelte:head>

<article class="grid grid-cols-1 gap-8 md:grid-cols-2">
	<div>
		{#if data.coverUrl}
			<img
				src={data.coverUrl}
				alt="{t('book.coverAlt', locale)} {book.title}"
				class="w-full rounded-lg border border-gray-200 object-contain"
			/>
		{:else}
			<div
				class="flex aspect-3/4 w-full items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-gray-400"
			>
				{t('site.name', locale)}
			</div>
		{/if}
	</div>

	<div class="flex flex-col">
		<h1 class="text-2xl font-semibold">{book.title}</h1>
		{#if book.author}
			<p class="mt-1 text-gray-600">{book.author}</p>
		{/if}

		<p class="mt-4 text-xl font-semibold">{priceFmt.format(book.price)}</p>

		<div class="mt-4">
			<button
				type="button"
				disabled={!inStock}
				onclick={() => cart.add(book.id)}
				class="rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
			>
				{inStock ? t('book.addToCart', locale) : t('books.outOfStock', locale)}
			</button>
			{#if !inStock}
				<p class="mt-2 text-sm text-red-600">{t('books.outOfStock', locale)}</p>
			{/if}
		</div>

		{#if description}
			<section class="mt-8">
				<h2 class="mb-2 text-lg font-medium">{t('book.description', locale)}</h2>
				<!-- Owner-authored blurb from the PocketBase `editor` field. Writes are
				     superuser-only (no public create/update rule on `books`), so this is
				     trusted content, not user input — {@html} is safe here. -->
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				<div class="prose prose-sm max-w-none">{@html description}</div>
			</section>
		{/if}

		{#if details.length > 0}
			<section class="mt-8">
				<h2 class="mb-2 text-lg font-medium">{t('book.details', locale)}</h2>
				<dl class="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
					{#each details as row (row.label)}
						<div class="flex justify-between gap-4 border-b border-gray-100 py-1">
							<dt class="text-gray-500">{row.label}</dt>
							<dd class="text-right font-medium">{row.value}</dd>
						</div>
					{/each}
				</dl>
			</section>
		{/if}
	</div>
</article>
