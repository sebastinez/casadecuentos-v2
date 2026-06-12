<script lang="ts">
	import { createCatalogIndex, searchCatalog, type SearchEntry } from '$lib/search/catalog-index';
	import { portal } from '$lib/actions/portal';
	import { t, DEFAULT_LOCALE } from '$lib/i18n';

	const locale = DEFAULT_LOCALE;

	// The catalog index is fetched lazily on first open and cached for the session
	// — keystrokes match against this in-memory Fuse index, never the server.
	let open = $state(false);
	let query = $state('');
	let index = $state<ReturnType<typeof createCatalogIndex> | null>(null);
	let loading = $state(false);
	let loadError = $state(false);

	let buttonEl: HTMLButtonElement;
	let inputEl = $state<HTMLInputElement | null>(null);

	const trimmed = $derived(query.trim());
	const results = $derived(index && trimmed ? searchCatalog(index, query) : []);

	async function ensureIndex() {
		if (index || loading) return;
		loading = true;
		loadError = false;
		try {
			const res = await fetch('/api/catalogo');
			if (!res.ok) throw new Error(String(res.status));
			const entries: SearchEntry[] = await res.json();
			index = createCatalogIndex(entries);
		} catch {
			loadError = true;
		} finally {
			loading = false;
		}
	}

	function openSearch() {
		open = true;
		ensureIndex();
	}

	function closeSearch() {
		open = false;
		query = '';
		buttonEl?.focus();
	}

	function onKeydown(event: KeyboardEvent) {
		if (open && event.key === 'Escape') closeSearch();
	}

	// Move focus into the input as the panel opens; on close, `closeSearch`
	// returns focus to the toggle button. (Full focus-trap/scroll-lock is the
	// mobile drawer's job in Phase 11 — this dropdown keeps it light.)
	$effect(() => {
		if (open && inputEl) inputEl.focus();
	});
</script>

<svelte:window onkeydown={onKeydown} />

<button
	bind:this={buttonEl}
	type="button"
	onclick={openSearch}
	aria-label={t('search.open', locale)}
	aria-expanded={open}
	class="rounded-md p-2 text-gray-700 hover:bg-gray-100"
>
	<svg
		xmlns="http://www.w3.org/2000/svg"
		viewBox="0 0 24 24"
		fill="none"
		stroke="currentColor"
		stroke-width="2"
		stroke-linecap="round"
		stroke-linejoin="round"
		class="h-5 w-5"
		aria-hidden="true"
	>
		<circle cx="11" cy="11" r="8" />
		<line x1="21" y1="21" x2="16.65" y2="16.65" />
	</svg>
</button>

{#if open}
	<!-- Backdrop: a real button so click + keyboard both dismiss without a11y
	     warnings; the panel below sits at a higher z-index so it stays usable. -->
	<button
		use:portal
		type="button"
		class="fixed inset-0 z-40 cursor-default bg-black/30"
		aria-label={t('search.close', locale)}
		onclick={closeSearch}
	></button>

	<div
		use:portal
		role="dialog"
		aria-modal="true"
		aria-label={t('search.label', locale)}
		class="fixed top-16 left-1/2 z-50 w-[min(40rem,92vw)] -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-4 shadow-xl"
	>
		<input
			bind:this={inputEl}
			bind:value={query}
			type="search"
			placeholder={t('search.placeholder', locale)}
			class="w-full rounded-md border border-gray-300 px-3 py-2"
		/>

		<div class="mt-3">
			{#if loadError}
				<p class="px-1 py-2 text-sm text-red-600">{t('search.error', locale)}</p>
			{:else if loading && !index}
				<p class="px-1 py-2 text-sm text-gray-500">…</p>
			{:else if trimmed && index}
				{#if results.length > 0}
					<ul class="max-h-80 divide-y divide-gray-100 overflow-y-auto">
						{#each results as entry (entry.id)}
							<li>
								<a
									href="/libros/{entry.slug}"
									onclick={closeSearch}
									class="flex items-center gap-3 rounded-md px-1 py-2 hover:bg-gray-50"
								>
									{#if entry.cover}
										<img
											src={entry.cover}
											alt=""
											width="40"
											height="40"
											class="h-10 w-10 shrink-0 rounded object-cover"
										/>
									{:else}
										<span class="h-10 w-10 shrink-0 rounded bg-gray-100"></span>
									{/if}
									<span class="min-w-0">
										<span class="block truncate text-sm font-medium">{entry.title}</span>
										{#if entry.author}
											<span class="block truncate text-xs text-gray-500">{entry.author}</span>
										{/if}
									</span>
								</a>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="px-1 py-2 text-sm text-gray-500">{t('search.noResults', locale)}</p>
				{/if}
			{/if}
		</div>
	</div>
{/if}
