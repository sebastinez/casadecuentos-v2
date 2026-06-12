<script lang="ts">
	import { onMount } from 'svelte';
	import { cart } from '$lib/cart/cart.svelte';
	import { t, DEFAULT_LOCALE } from '$lib/i18n';

	const locale = DEFAULT_LOCALE;

	// The customer landed here after Stripe Checkout. This page marks NOTHING as
	// paid — fulfilment is driven solely by the signature-verified webhook (Phase
	// 6b). Clearing the cart is a UX convenience (their selection has been ordered),
	// not a payment signal.
	onMount(() => {
		cart.clear();
	});
</script>

<svelte:head>
	<title>{t('pago.success.heading', locale)} — {t('site.name', locale)}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-lg py-12 text-center">
	<h1 class="text-2xl font-semibold">{t('pago.success.heading', locale)}</h1>
	<p class="mt-4 text-gray-600">{t('pago.success.body', locale)}</p>
	<a href="/libros" class="mt-6 inline-block text-sm text-gray-700 hover:underline">
		{t('pago.keepBrowsing', locale)}
	</a>
</div>
