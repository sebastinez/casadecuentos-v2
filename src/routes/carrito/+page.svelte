<script lang="ts">
	import { onMount } from 'svelte';
	import { cart } from '$lib/cart/cart.svelte';
	import type { CartBook } from '$lib/server/catalog';
	import { t, DEFAULT_LOCALE } from '$lib/i18n';

	const locale = DEFAULT_LOCALE;
	const priceFmt = new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' });

	// The cart is client-only (localStorage), so the server renders no contents;
	// we mirror that until mount, then reveal the real cart — avoiding a hydration
	// mismatch between the empty server render and the populated client render.
	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});

	// Per-id display detail, fetched fresh from the server (the cart stores only
	// id + qty). `requested` tracks ids we've already asked for so the effect
	// neither refetches nor loops on ids that resolve to nothing. Deliberately a
	// plain (non-reactive) array — it's a fetch-dedupe guard, not UI state, and
	// must not itself re-trigger the effect.
	let details = $state<Record<string, CartBook>>({});
	let loadError = $state(false);
	const requested: string[] = [];

	$effect(() => {
		const missing = cart.items.map((item) => item.id).filter((id) => !requested.includes(id));
		if (missing.length === 0) return;
		requested.push(...missing);

		fetch(`/api/carrito?ids=${missing.map(encodeURIComponent).join(',')}`)
			.then((res) => {
				if (!res.ok) throw new Error(String(res.status));
				return res.json() as Promise<CartBook[]>;
			})
			.then((books) => {
				const next = { ...details };
				for (const book of books) next[book.id] = book;
				details = next;
				// Ids that resolved to no book are stale (deleted in the catalog) —
				// drop them from the cart so the view and the count stay honest.
				const resolved = new Set(books.map((b) => b.id));
				for (const id of missing) {
					if (!resolved.has(id)) cart.remove(id);
				}
			})
			.catch(() => {
				loadError = true;
			});
	});

	// Render order + quantities come from the cart; detail is looked up by id.
	// Lines whose detail hasn't resolved yet are held back until it arrives.
	const lines = $derived(
		cart.items
			.map((item) => ({ item, book: details[item.id] }))
			.filter((line): line is { item: (typeof cart.items)[number]; book: CartBook } => !!line.book)
	);

	const total = $derived(lines.reduce((sum, { item, book }) => sum + book.price * item.qty, 0));

	// Checkout initiation. Posts the cart's ids + quantities to the BFF, which
	// builds a server-authoritative order + Stripe session and returns the hosted
	// Checkout URL to redirect to. Prices are never sent — the server reads them.
	let checkingOut = $state(false);
	let checkoutError = $state('');

	async function checkout() {
		checkingOut = true;
		checkoutError = '';
		try {
			const res = await fetch('/api/checkout', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ items: cart.items })
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				checkoutError =
					data?.message === 'out_of_stock'
						? t('cart.outOfStockError', locale)
						: t('cart.checkoutError', locale);
				return;
			}
			const { url } = (await res.json()) as { url: string };
			window.location.href = url;
		} catch {
			checkoutError = t('cart.checkoutError', locale);
		} finally {
			checkingOut = false;
		}
	}
</script>

<svelte:head>
	<title>{t('cart.heading', locale)} — {t('site.name', locale)}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<h1 class="mb-6 text-2xl font-semibold">{t('cart.heading', locale)}</h1>

{#if !mounted}
	<p class="text-gray-500">{t('cart.loading', locale)}</p>
{:else if loadError}
	<p class="text-red-600">{t('cart.error', locale)}</p>
{:else if cart.items.length === 0}
	<p class="text-gray-600">{t('cart.empty', locale)}</p>
	<a href="/libros" class="mt-3 inline-block text-sm text-gray-700 hover:underline">
		{t('cart.browse', locale)}
	</a>
{:else}
	<ul class="divide-y divide-gray-100 border-y border-gray-100">
		{#each lines as { item, book } (item.id)}
			<li class="flex items-center gap-4 py-4">
				<a href="/libros/{book.slug}" class="shrink-0">
					{#if book.cover}
						<img
							src={book.cover}
							alt=""
							width="56"
							height="56"
							class="h-14 w-14 rounded object-cover"
						/>
					{:else}
						<span class="block h-14 w-14 rounded bg-gray-100"></span>
					{/if}
				</a>

				<div class="min-w-0 flex-1">
					<a href="/libros/{book.slug}" class="block truncate font-medium hover:underline">
						{book.title}
					</a>
					<p class="text-sm text-gray-500">{priceFmt.format(book.price)}</p>
				</div>

				<div class="flex items-center gap-1" role="group" aria-label={t('cart.quantity', locale)}>
					<button
						type="button"
						onclick={() => cart.setQty(item.id, item.qty - 1)}
						aria-label={t('cart.decrease', locale)}
						class="h-8 w-8 rounded-md border border-gray-300 text-lg leading-none hover:bg-gray-50"
					>
						−
					</button>
					<span class="w-8 text-center text-sm tabular-nums">{item.qty}</span>
					<button
						type="button"
						onclick={() => cart.setQty(item.id, item.qty + 1)}
						aria-label={t('cart.increase', locale)}
						class="h-8 w-8 rounded-md border border-gray-300 text-lg leading-none hover:bg-gray-50"
					>
						+
					</button>
				</div>

				<div class="w-20 text-right text-sm font-medium tabular-nums">
					{priceFmt.format(book.price * item.qty)}
				</div>

				<button
					type="button"
					onclick={() => cart.remove(item.id)}
					class="text-sm text-gray-500 hover:text-red-600 hover:underline"
				>
					{t('cart.remove', locale)}
				</button>
			</li>
		{/each}
	</ul>

	<div class="mt-6 flex items-center justify-between">
		<button
			type="button"
			onclick={() => cart.clear()}
			class="text-sm text-gray-600 hover:text-red-600 hover:underline"
		>
			{t('cart.clear', locale)}
		</button>
		<p class="text-lg font-semibold">
			{t('cart.total', locale)}: {priceFmt.format(total)}
		</p>
	</div>

	<div class="mt-6 flex flex-col items-end gap-1">
		<button
			type="button"
			onclick={checkout}
			disabled={checkingOut}
			class="rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
		>
			{checkingOut ? t('cart.checkingOut', locale) : t('cart.checkout', locale)}
		</button>
		{#if checkoutError}
			<p class="text-sm text-red-600">{checkoutError}</p>
		{/if}
	</div>
{/if}
