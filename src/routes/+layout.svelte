<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.ico';
	import logo from '$lib/assets/logo.webp';
	import { t, localizeHref } from '$lib/i18n';
	import { site } from '$lib/site';
	import HeaderSearch from '$lib/components/HeaderSearch.svelte';
	import CartIcon from '$lib/components/CartIcon.svelte';
	import MobileNav from '$lib/components/MobileNav.svelte';
	import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
	import { announcer } from '$lib/a11y/announcer.svelte';

	let { children, data } = $props();

	// Active locale comes from the URL prefix (resolved in hooks.server.ts) via the
	// layout load. Nav/footer hrefs are reactive so they re-prefix when the locale
	// switches; labels resolve through the i18n message layer.
	const locale = $derived(data.locale);
	const nav = $derived([
		{ href: localizeHref('/', locale), label: t('nav.home', locale) },
		{ href: localizeHref('/libros', locale), label: t('nav.books', locale) },
		{ href: localizeHref('/actividades', locale), label: t('nav.events', locale) },
		{ href: localizeHref('/videos', locale), label: t('nav.videos', locale) },
		{ href: localizeHref('/quienes-somos', locale), label: t('nav.about', locale) },
		{ href: localizeHref('/contacto', locale), label: t('nav.contact', locale) }
	]);

	// Footer policy links, separate from the primary nav: the "information" links —
	// About + the hardcoded legal pages + contact.
	const footerLinks = $derived([
		{ href: localizeHref('/quienes-somos', locale), label: t('footer.about', locale) },
		{ href: localizeHref('/envios-devoluciones', locale), label: t('footer.shipping', locale) },
		{ href: localizeHref('/privacidad', locale), label: t('footer.privacy', locale) },
		{ href: localizeHref('/terminos', locale), label: t('footer.terms', locale) },
		{ href: localizeHref('/contacto', locale), label: t('footer.contact', locale) }
	]);
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="flex min-h-screen flex-col">
	<header class="sticky top-0 z-10 border-b border-terracotta-100 bg-cream/90 backdrop-blur">
		<nav class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
			<a
				href={localizeHref('/', locale)}
				class="flex items-center gap-2 font-serif text-xl font-semibold tracking-tight text-terracotta-700 hover:text-terracotta-800"
			>
				<img src={logo} alt="" width="80" height="80" class="h-30 w-30 shrink-0" />
			</a>
			<div class="flex items-center gap-4">
				<!-- Primary nav collapses into the mobile drawer below the `md` breakpoint;
				     search + cart stay visible at all widths (stories 35/36). -->
				<ul class="hidden items-center gap-4 text-sm md:flex">
					{#each nav as item (item.href)}
						<li>
							<a href={item.href} class="text-gray-700 hover:text-terracotta-700 hover:underline"
								>{item.label}</a
							>
						</li>
					{/each}
				</ul>
				<HeaderSearch />
				<LocaleSwitcher {locale} />
				<CartIcon />
				<MobileNav {nav} />
			</div>
		</nav>
	</header>

	<main class="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
		{@render children()}
	</main>

	<footer class="border-t border-terracotta-100 bg-terracotta-50/50">
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
						<span>Maria Eugenia Raffo</span>
						<span>Bücherei Casa de Cuentos von M.E. Raffo</span>
						<span>{site.address}</span>
						<a href="mailto:{site.email}" class="inline-flex items-center gap-2 hover:underline">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								class="h-4 w-4 shrink-0"
								aria-hidden="true"
							>
								<path
									d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"
								/>
							</svg>
							{site.email}
						</a>
						<a
							href={site.instagramUrl}
							class="inline-flex items-center gap-2 hover:underline"
							rel="noopener"
							target="_blank"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								class="h-4 w-4 shrink-0"
								aria-hidden="true"
							>
								<path
									d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3z"
								/>
							</svg>
							{site.instagram}
						</a>
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

<!-- Single app-wide polite live region: visual-only UI changes (e.g. the
     add-to-cart morph) push a message here so screen readers are told too. -->
<div aria-live="polite" aria-atomic="true" class="sr-only">{announcer.message}</div>
