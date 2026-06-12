<script lang="ts">
	import { t, DEFAULT_LOCALE } from '$lib/i18n';

	const locale = DEFAULT_LOCALE;

	// The customer cancelled or abandoned Stripe Checkout. No charge was made and
	// the cart is untouched (localStorage), so they can return to it and retry.
</script>

<svelte:head>
	<title>{t('pago.cancel.heading', locale)} — {t('site.name', locale)}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-lg py-12 text-center">
	<h1 class="text-2xl font-semibold">{t('pago.cancel.heading', locale)}</h1>
	<p class="mt-4 text-gray-600">{t('pago.cancel.body', locale)}</p>
	<a href="/carrito" class="mt-6 inline-block text-sm text-gray-700 hover:underline">
		{t('pago.backToCart', locale)}
	</a>
</div>
