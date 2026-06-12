<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import { t, DEFAULT_LOCALE } from '$lib/i18n';
	import { site } from '$lib/site';
	import HeaderSearch from '$lib/components/HeaderSearch.svelte';
	import CartIcon from '$lib/components/CartIcon.svelte';
	import MobileNav from '$lib/components/MobileNav.svelte';

	let { children } = $props();

	// v1 is Spanish-only; locale is threaded explicitly so German is a data task,
	// not a rewrite.
	const locale = DEFAULT_LOCALE;
	const nav = [
		{ href: '/', label: t('nav.home', locale) },
		{ href: '/libros', label: t('nav.books', locale) },
		{ href: '/eventos', label: t('nav.events', locale) },
		{ href: '/nosotros', label: t('nav.about', locale) },
		{ href: '/contacto', label: t('nav.contact', locale) }
	];

	// Footer policy links (Phase 10). Separate from the primary nav: these are the
	// "information" links — About + the hardcoded legal pages + contact.
	const footerLinks = [
		{ href: '/nosotros', label: t('footer.about', locale) },
		{ href: '/envios-devoluciones', label: t('footer.shipping', locale) },
		{ href: '/privacidad', label: t('footer.privacy', locale) },
		{ href: '/terminos', label: t('footer.terms', locale) },
		{ href: '/contacto', label: t('footer.contact', locale) }
	];
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex min-h-screen flex-col">
	<header class="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
		<nav class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
			<a href="/" class="text-lg font-semibold tracking-tight">{t('site.name', locale)}</a>
			<div class="flex items-center gap-4">
				<!-- Primary nav collapses into the mobile drawer below the `md` breakpoint;
				     search + cart stay visible at all widths (stories 35/36). -->
				<ul class="hidden items-center gap-4 text-sm md:flex">
					{#each nav as item (item.href)}
						<li><a href={item.href} class="hover:underline">{item.label}</a></li>
					{/each}
				</ul>
				<HeaderSearch />
				<CartIcon />
				<MobileNav {nav} />
			</div>
		</nav>
	</header>

	<main class="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
		{@render children()}
	</main>

	<footer class="border-t border-gray-200 bg-gray-50">
		<div class="mx-auto max-w-5xl px-4 py-8 text-sm text-gray-600">
			<div class="flex flex-col gap-8 sm:flex-row sm:justify-between">
				<nav aria-label={t('footer.policies', locale)}>
					<h2 class="font-medium text-gray-900">{t('footer.policies', locale)}</h2>
					<ul class="mt-2 flex flex-col gap-1">
						{#each footerLinks as link (link.href)}
							<li><a href={link.href} class="hover:underline">{link.label}</a></li>
						{/each}
					</ul>
				</nav>
				<div>
					<h2 class="font-medium text-gray-900">{t('footer.contactHeading', locale)}</h2>
					<address class="mt-2 flex flex-col gap-1 not-italic">
						<span>{site.address}</span>
						<a href="mailto:{site.email}" class="hover:underline">{site.email}</a>
						<a href={site.instagramUrl} class="hover:underline" rel="noopener" target="_blank"
							>{site.instagram}</a
						>
					</address>
				</div>
			</div>
			<p class="mt-8 border-t border-gray-200 pt-6">
				&copy; {new Date().getFullYear()}
				{t('site.name', locale)}. {t('footer.rights', locale)}
			</p>
		</div>
	</footer>
</div>
