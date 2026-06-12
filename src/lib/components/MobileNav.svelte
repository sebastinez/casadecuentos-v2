<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { MediaQuery } from 'svelte/reactivity';
	import { portal } from '$lib/actions/portal';
	import { t, DEFAULT_LOCALE } from '$lib/i18n';

	type NavItem = { href: string; label: string };
	let { nav }: { nav: NavItem[] } = $props();

	const locale = DEFAULT_LOCALE;

	// `prefers-reduced-motion: reduce` → zero-duration transitions. The second arg
	// is the SSR fallback (no media to match on the server): assume motion is fine.
	const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)', false);
	const duration = $derived(reducedMotion.current ? 0 : 200);

	let open = $state(false);
	let toggleEl: HTMLButtonElement;
	let panelEl = $state<HTMLElement | null>(null);

	function close() {
		open = false;
		toggleEl?.focus();
	}

	function focusable(): HTMLElement[] {
		if (!panelEl) return [];
		return Array.from(
			panelEl.querySelectorAll<HTMLElement>(
				'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
			)
		);
	}

	function onKeydown(event: KeyboardEvent) {
		if (!open) return;
		if (event.key === 'Escape') {
			close();
			return;
		}
		if (event.key !== 'Tab') return;
		// Trap focus inside the drawer: wrap at both ends.
		const items = focusable();
		if (items.length === 0) return;
		const first = items[0];
		const last = items[items.length - 1];
		const active = document.activeElement;
		if (event.shiftKey && active === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && active === last) {
			event.preventDefault();
			first.focus();
		}
	}

	// Move focus into the drawer on open, and lock background scroll while it's
	// open — restoring the prior overflow on close/unmount so we never clobber a
	// value some other component set.
	$effect(() => {
		if (!open) return;
		focusable()[0]?.focus();
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = prevOverflow;
		};
	});
</script>

<svelte:window onkeydown={onKeydown} />

<button
	bind:this={toggleEl}
	type="button"
	onclick={() => (open = true)}
	aria-label={t('nav.openMenu', locale)}
	aria-expanded={open}
	aria-controls="mobile-nav-drawer"
	class="rounded-md p-2 text-gray-700 hover:bg-gray-100 md:hidden"
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
		<line x1="3" y1="6" x2="21" y2="6" />
		<line x1="3" y1="12" x2="21" y2="12" />
		<line x1="3" y1="18" x2="21" y2="18" />
	</svg>
</button>

{#if open}
	<!-- Dimmed backdrop: a real button so pointer + keyboard both dismiss without
	     a11y warnings; the drawer sits above it. -->
	<button
		use:portal
		type="button"
		class="fixed inset-0 z-40 cursor-default bg-black/40 md:hidden"
		aria-label={t('nav.closeMenu', locale)}
		onclick={close}
		transition:fade={{ duration }}
	></button>

	<div
		use:portal
		bind:this={panelEl}
		id="mobile-nav-drawer"
		role="dialog"
		aria-modal="true"
		aria-label={t('nav.menu', locale)}
		class="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[80vw] flex-col bg-white shadow-xl md:hidden"
		transition:fly={{ x: -300, duration }}
	>
		<div class="flex items-center justify-between border-b border-gray-200 px-4 py-3">
			<span class="text-lg font-semibold tracking-tight">{t('site.name', locale)}</span>
			<button
				type="button"
				onclick={close}
				aria-label={t('nav.closeMenu', locale)}
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
					<line x1="18" y1="6" x2="6" y2="18" />
					<line x1="6" y1="6" x2="18" y2="18" />
				</svg>
			</button>
		</div>
		<nav aria-label={t('nav.menu', locale)} class="px-2 py-4">
			<ul class="flex flex-col gap-1">
				{#each nav as item (item.href)}
					<li>
						<a
							href={item.href}
							onclick={close}
							class="block rounded-md px-3 py-2 text-base hover:bg-gray-100"
						>
							{item.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>
	</div>
{/if}
