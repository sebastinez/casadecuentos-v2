<script lang="ts">
	import type { PageData } from './$types';
	import { t, DEFAULT_LOCALE } from '$lib/i18n';
	import { AGE_BANDS } from '$lib/age-bands';

	let { data }: { data: PageData } = $props();

	const locale = DEFAULT_LOCALE;
	const priceFmt = new Intl.NumberFormat('de-CH', {
		style: 'currency',
		currency: 'CHF'
	});

	const f = $derived(data.filters);
	// Whether any facet/search is active — picks the "no results" vs "empty
	// catalog" message and decides if the Clear link is worth showing.
	const hasFilters = $derived(!!(f.age || f.genre || f.publisher || f.language || f.q));

	const sortOptions = [
		{ value: 'newest', label: t('sort.newest', locale) },
		{ value: 'price-asc', label: t('sort.priceAsc', locale) },
		{ value: 'price-desc', label: t('sort.priceDesc', locale) }
	];
</script>

<h1 class="mb-6 text-2xl font-semibold">{t('books.heading', locale)}</h1>

<!-- Native GET form: submitting navigates to /libros?… so the filter state
     lives in the URL (shareable, bookmarkable, back-button correct) and the
     server `load` re-runs the PocketBase filter query. No client JS needed. -->
<form
	method="GET"
	action="/libros"
	class="mb-8 grid grid-cols-1 gap-4 rounded-lg border border-gray-200 p-4 sm:grid-cols-2 lg:grid-cols-3"
>
	<label class="flex flex-col gap-1 text-sm">
		<span class="text-gray-500">{t('filter.search', locale)}</span>
		<input
			type="search"
			name="q"
			value={f.q}
			placeholder={t('filter.searchPlaceholder', locale)}
			class="rounded-md border border-gray-300 px-3 py-2"
		/>
	</label>

	<label class="flex flex-col gap-1 text-sm">
		<span class="text-gray-500">{t('filter.age', locale)}</span>
		<select name="age" class="rounded-md border border-gray-300 px-3 py-2">
			<option value="" selected={f.age === ''}>{t('filter.all', locale)}</option>
			{#each AGE_BANDS as band (band)}
				<option value={band} selected={f.age === band}>{t(`age.${band}`, locale)}</option>
			{/each}
		</select>
	</label>

	<label class="flex flex-col gap-1 text-sm">
		<span class="text-gray-500">{t('filter.genre', locale)}</span>
		<select name="genre" class="rounded-md border border-gray-300 px-3 py-2">
			<option value="" selected={f.genre === ''}>{t('filter.all', locale)}</option>
			{#each data.facets.genres as g (g.id)}
				<option value={g.slug} selected={f.genre === g.slug}>{g.name}</option>
			{/each}
		</select>
	</label>

	<label class="flex flex-col gap-1 text-sm">
		<span class="text-gray-500">{t('filter.publisher', locale)}</span>
		<select name="publisher" class="rounded-md border border-gray-300 px-3 py-2">
			<option value="" selected={f.publisher === ''}>{t('filter.all', locale)}</option>
			{#each data.facets.publishers as p (p.id)}
				<option value={p.slug} selected={f.publisher === p.slug}>{p.name}</option>
			{/each}
		</select>
	</label>

	<label class="flex flex-col gap-1 text-sm">
		<span class="text-gray-500">{t('filter.language', locale)}</span>
		<select name="language" class="rounded-md border border-gray-300 px-3 py-2">
			<option value="" selected={f.language === ''}>{t('filter.all', locale)}</option>
			{#each data.facets.languages as l (l.id)}
				<option value={l.slug} selected={f.language === l.slug}>{l.name}</option>
			{/each}
		</select>
	</label>

	<label class="flex flex-col gap-1 text-sm">
		<span class="text-gray-500">{t('filter.sort', locale)}</span>
		<select name="sort" class="rounded-md border border-gray-300 px-3 py-2">
			{#each sortOptions as opt (opt.value)}
				<option
					value={opt.value}
					selected={f.sort === opt.value || (f.sort === '' && opt.value === 'newest')}
				>
					{opt.label}
				</option>
			{/each}
		</select>
	</label>

	<div class="flex items-end gap-3 sm:col-span-2 lg:col-span-3">
		<button type="submit" class="rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white">
			{t('filter.apply', locale)}
		</button>
		{#if hasFilters}
			<a href="/libros" class="text-sm text-gray-600 hover:underline">{t('filter.clear', locale)}</a
			>
		{/if}
	</div>
</form>

{#if data.books.length === 0}
	<p class="text-gray-600">
		{hasFilters ? t('books.noResults', locale) : t('books.empty', locale)}
	</p>
{:else}
	<ul class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.books as book (book.id)}
			<li>
				<a
					href="/libros/{book.slug}"
					class="flex h-full flex-col rounded-lg border border-gray-200 p-4 hover:border-gray-400"
				>
					<h2 class="font-medium">{book.title}</h2>
					{#if book.author}
						<p class="text-sm text-gray-600">{book.author}</p>
					{/if}
					<div class="mt-3 flex items-center justify-between">
						<span class="font-semibold">{priceFmt.format(book.price)}</span>
						{#if book.stock <= 0}
							<span class="text-sm text-red-600">{t('books.outOfStock', locale)}</span>
						{/if}
					</div>
				</a>
			</li>
		{/each}
	</ul>
{/if}
