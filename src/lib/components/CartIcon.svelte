<script lang="ts">
	import { onMount } from 'svelte';
	import { cart } from '$lib/cart/cart.svelte';
	import { t, DEFAULT_LOCALE } from '$lib/i18n';

	const locale = DEFAULT_LOCALE;

	// The cart lives in localStorage, so its count is only known on the client.
	// The server renders no badge; we mirror that until mount, then reveal the
	// live count — avoiding a hydration mismatch on the badge text.
	let mounted = $state(false);
	onMount(() => {
		mounted = true;
	});

	const count = $derived(mounted ? cart.count : 0);
</script>

<a
	href="/carrito"
	class="relative rounded-md p-2 text-gray-700 hover:bg-gray-100"
	aria-label={count > 0 ? `${t('nav.cart', locale)} (${count})` : t('nav.cart', locale)}
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
		<circle cx="9" cy="21" r="1" />
		<circle cx="20" cy="21" r="1" />
		<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
	</svg>
	{#if count > 0}
		<span
			class="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-900 px-1 text-xs font-medium text-white"
			aria-hidden="true"
		>
			{count}
		</span>
	{/if}
</a>
