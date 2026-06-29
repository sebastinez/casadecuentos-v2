<script lang="ts">
	import type { PageData } from './$types';
	import { t, localizedField, localizeHref } from '$lib/i18n';
	import { AGE_BANDS } from '$lib/age-bands';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import AddToCartButton from '$lib/components/AddToCartButton.svelte';

	let { data }: { data: PageData } = $props();

	const locale = $derived(data.locale);
	const priceFmt = new Intl.NumberFormat('de-CH', {
		style: 'currency',
		currency: 'CHF'
	});

	const f = $derived(data.filters);
	// Whether any facet/search is active — picks the "no results" vs "empty
	// catalog" message and decides if the Clear link is worth showing.
	const hasFilters = $derived(!!(f.age || f.genre || f.publisher || f.language || f.q));

	const pagination = $derived(data.pagination);

	// Windowed page index: always show the first and last page, the current page
	// with its 3 neighbours on each side, and a `…` gap wherever a stretch of
	// pages is collapsed. Keeps the control compact on a 29-page catalog while
	// still offering one-click jumps to the ends. Items are typed so the `…`
	// placeholders carry stable keys for the `{#each}`.
	const WINDOW = 3;
	type PageItem = { type: 'page'; n: number } | { type: 'gap'; key: string };
	const pageItems = $derived.by<PageItem[]>(() => {
		const { page, totalPages } = pagination;
		const start = Math.max(2, page - WINDOW);
		const end = Math.min(totalPages - 1, page + WINDOW);

		const items: PageItem[] = [{ type: 'page', n: 1 }];
		if (start > 2) items.push({ type: 'gap', key: 'gap-left' });
		for (let n = start; n <= end; n++) items.push({ type: 'page', n });
		if (end < totalPages - 1) items.push({ type: 'gap', key: 'gap-right' });
		items.push({ type: 'page', n: totalPages });
		return items;
	});

	// Build a /libros URL for a given page that preserves the active
	// filter/search/sort state. `URLSearchParams` encodes values (a `q` with
	// spaces/special chars stays intact), and empty filters are omitted so the
	// links stay clean.
	function pageHref(page: number): string {
		const params = new SvelteURLSearchParams();
		if (f.q) params.set('q', f.q);
		if (f.age) params.set('age', f.age);
		if (f.genre) params.set('genre', f.genre);
		if (f.publisher) params.set('publisher', f.publisher);
		if (f.language) params.set('language', f.language);
		if (f.sort) params.set('sort', f.sort);
		if (page > 1) params.set('page', String(page));
		const qs = params.toString();
		return localizeHref(qs ? `/libros?${qs}` : '/libros', locale);
	}

	const sortOptions = $derived([
		{ value: 'newest', label: t('sort.newest', locale) },
		{ value: 'price-asc', label: t('sort.priceAsc', locale) },
		{ value: 'price-desc', label: t('sort.priceDesc', locale) }
	]);
</script>

<!-- Native <details>: the filter panel is collapsed by default and toggled with
     no client JS. The <summary> spans the heading row so the title sits on the
     left and the toggle on the right. Opens automatically when filters are
     active so a shared/bookmarked URL shows its applied facets. -->
<details class="group mb-8" open={hasFilters}>
	<summary
		class="flex cursor-pointer list-none items-center justify-between [&::-webkit-details-marker]:hidden"
	>
		<h1 class="text-2xl font-semibold">{t('books.heading', locale)}</h1>
		<span class="flex items-center gap-1.5 text-sm font-medium text-gray-600 hover:text-gray-900">
			{t('filter.toggle', locale)}
			<svg
				class="size-4 transition-transform group-open:rotate-180"
				viewBox="0 0 20 20"
				fill="currentColor"
				aria-hidden="true"
			>
				<path
					fill-rule="evenodd"
					d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
					clip-rule="evenodd"
				/>
			</svg>
		</span>
	</summary>

	<!-- Native GET form: submitting navigates to /libros?… so the filter state
	     lives in the URL (shareable, bookmarkable, back-button correct) and the
	     server `load` re-runs the PocketBase filter query. No client JS needed. -->
	<form
		method="GET"
		action={localizeHref('/libros', locale)}
		class="mt-4 grid grid-cols-1 gap-4 rounded-lg border border-gray-200 p-4 sm:grid-cols-2 lg:grid-cols-3"
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
					<option value={g.slug} selected={f.genre === g.slug}
						>{localizedField(g, 'name', locale)}</option
					>
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
					<option value={l.slug} selected={f.language === l.slug}
						>{localizedField(l, 'name', locale)}</option
					>
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
			<button
				type="submit"
				class="rounded-md bg-terracotta-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-terracotta-700"
			>
				{t('filter.apply', locale)}
			</button>
			{#if hasFilters}
				<a href={localizeHref('/libros', locale)} class="text-sm text-gray-600 hover:underline"
					>{t('filter.clear', locale)}</a
				>
			{/if}
		</div>
	</form>
</details>

{#if data.books.length === 0}
	<p class="text-gray-600">
		{hasFilters ? t('books.noResults', locale) : t('books.empty', locale)}
	</p>
{:else}
	<ul class="grid grid-cols-2 gap-6 sm:grid-cols-2 lg:grid-cols-3">
		{#each data.books as book (book.id)}
			<li class="flex h-full flex-col rounded-lg border border-gray-200 p-4">
				<!-- Card is no longer one big <a>: only the cover and title link to the
				     detail page, leaving the add-to-cart button as a valid sibling
				     (a <button> can't be nested inside an <a>). -->
				<a href={localizeHref(`/libros/${book.slug}`, locale)} class="group">
					<img
						src={book.cover}
						alt=""
						loading="lazy"
						decoding="async"
						class="mb-4 aspect-3/4 w-full object-cover transition-opacity group-hover:opacity-90"
					/>
				</a>
				<h2 class="font-medium">
					<a href={localizeHref(`/libros/${book.slug}`, locale)} class="hover:underline"
						>{book.title}</a
					>
				</h2>
				{#if book.author}
					<p class="text-sm text-gray-600">{book.author}</p>
				{/if}
				<div class="mt-auto flex items-center justify-between gap-2 pt-3">
					<span class="font-semibold text-terracotta-700">{priceFmt.format(book.price)}</span>
					<AddToCartButton book={{ id: book.id, stock: book.stock }} compact />
				</div>
			</li>
		{/each}
	</ul>

	{#if pagination.totalPages > 1}
		<nav aria-label={t('pagination.label', locale)} class="mt-10 flex justify-center">
			<ul class="flex flex-wrap items-center gap-1">
				<li>
					{#if pagination.page > 1}
						<a
							href={pageHref(pagination.page - 1)}
							rel="prev"
							class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:border-gray-400"
						>
							{t('pagination.previous', locale)}
						</a>
					{:else}
						<span
							aria-disabled="true"
							class="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-300"
						>
							{t('pagination.previous', locale)}
						</span>
					{/if}
				</li>

				{#each pageItems as item (item.type === 'page' ? item.n : item.key)}
					<li>
						{#if item.type === 'gap'}
							<span class="px-2 py-2 text-sm text-gray-400" aria-hidden="true">…</span>
						{:else if item.n === pagination.page}
							<span
								aria-current="page"
								class="rounded-md border border-terracotta-600 bg-terracotta-600 px-3.5 py-2 text-sm font-medium text-white"
							>
								{item.n}
							</span>
						{:else}
							<a
								href={pageHref(item.n)}
								aria-label="{t('pagination.goToPage', locale)} {item.n}"
								class="rounded-md border border-gray-300 px-3.5 py-2 text-sm hover:border-gray-400"
							>
								{item.n}
							</a>
						{/if}
					</li>
				{/each}

				<li>
					{#if pagination.page < pagination.totalPages}
						<a
							href={pageHref(pagination.page + 1)}
							rel="next"
							class="rounded-md border border-gray-300 px-3 py-2 text-sm hover:border-gray-400"
						>
							{t('pagination.next', locale)}
						</a>
					{:else}
						<span
							aria-disabled="true"
							class="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-300"
						>
							{t('pagination.next', locale)}
						</span>
					{/if}
				</li>
			</ul>
		</nav>
	{/if}
{/if}
