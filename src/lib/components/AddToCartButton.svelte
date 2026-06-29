<script lang="ts">
	import { onDestroy } from 'svelte';
	import { cart } from '$lib/cart/cart.svelte';
	import { announcer } from '$lib/a11y/announcer.svelte';
	import { t, DEFAULT_LOCALE } from '$lib/i18n';

	// Shared add-to-cart control for the PDP and the listing grid. The only
	// differences between the two surfaces are `qty` (the PDP feeds its stepper
	// value; the grid is always 1) and `compact` (the grid sits inline beside the
	// price), so the morph + announcement + stock logic live here once.
	let {
		book,
		qty = 1,
		compact = false,
		class: className = ''
	}: {
		book: { id: string; stock: number };
		qty?: number;
		compact?: boolean;
		class?: string;
	} = $props();

	const locale = DEFAULT_LOCALE;

	// Disable against the *live cart*, not just catalog stock: once the cart
	// already holds the book's full stock there's nothing left to add. Reactive,
	// so the button disables the instant the last unit goes in. (Checkout still
	// re-validates the true available quantity server-side.)
	const inCart = $derived(cart.qtyOf(book.id));
	const soldOut = $derived(book.stock <= 0);
	const maxedOut = $derived(!soldOut && inCart >= book.stock);
	const canAdd = $derived(!soldOut && !maxedOut);

	// Visual "✓ Añadido" confirmation. Reverts after ~1.5s; the button is never
	// disabled while addable, so a rapid second click just re-fires. Screen
	// readers get the same confirmation via the app-level live region.
	let added = $state(false);
	let timer: ReturnType<typeof setTimeout> | undefined;
	onDestroy(() => clearTimeout(timer));

	function add() {
		cart.add(book.id, qty);
		announcer.announce(t('cart.added', locale));
		added = true;
		clearTimeout(timer);
		timer = setTimeout(() => (added = false), 1500);
	}

	const sizeClass = $derived(compact ? 'px-3 py-1.5 text-xs' : 'px-5 py-2.5 text-sm');
</script>

<button
	type="button"
	disabled={!canAdd}
	onclick={add}
	class="inline-flex items-center justify-center gap-1.5 rounded-md font-medium text-white transition-colors disabled:cursor-not-allowed disabled:bg-terracotta-200 {sizeClass} {added
		? 'bg-green-600 hover:bg-green-600'
		: 'bg-terracotta-600 hover:bg-terracotta-700'} {className}"
>
	{#if soldOut}
		{t('books.outOfStock', locale)}
	{:else if maxedOut}
		{t('book.maxInCart', locale)}
	{:else if added}
		<svg class="size-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
			<path
				fill-rule="evenodd"
				d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0l-3.5-3.5a1 1 0 1 1 1.4-1.4l2.8 2.79 6.8-6.79a1 1 0 0 1 1.4 0Z"
				clip-rule="evenodd"
			/>
		</svg>
		{t('book.added', locale)}
	{:else}
		{t('book.addToCart', locale)}
	{/if}
</button>
