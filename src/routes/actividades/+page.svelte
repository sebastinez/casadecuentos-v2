<script lang="ts">
	import type { PageData } from './$types';
	import { t, localizedField, localizeHref } from '$lib/i18n';
	import { formatEventDate } from '$lib/datetime';

	let { data }: { data: PageData } = $props();

	const locale = $derived(data.locale);

	// Unique (localized) event titles across all upcoming events, sorted for the dropdown.
	const eventNames = $derived(
		[...new Set(data.events.map((e) => localizedField(e, 'title', locale)))].sort((a, b) =>
			a.localeCompare(b, locale)
		)
	);

	let selectedName = $state('');

	// Drop a stale selection if the name disappears (e.g. locale switch or reload of data).
	$effect(() => {
		if (selectedName && !eventNames.includes(selectedName)) selectedName = '';
	});

	const filteredEvents = $derived(
		selectedName
			? data.events.filter((e) => localizedField(e, 'title', locale) === selectedName)
			: data.events
	);
</script>

<svelte:head>
	<title>{t('events.heading', locale)} — {t('site.name', locale)}</title>
	<meta name="description" content={t('events.upcoming', locale)} />
</svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
	<h1 class="text-2xl font-semibold">{t('events.heading', locale)}</h1>

	{#if eventNames.length > 1}
		<div class="flex items-center gap-2">
			<label for="event-filter" class="sr-only">{t('events.filterLabel', locale)}</label>
			<select
				id="event-filter"
				bind:value={selectedName}
				class="max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm"
			>
				<option value="">{t('events.filterAll', locale)}</option>
				{#each eventNames as name (name)}
					<option value={name}>{name}</option>
				{/each}
			</select>
			{#if selectedName}
				<button
					type="button"
					onclick={() => (selectedName = '')}
					class="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-gray-400"
					aria-label={t('events.filterClear', locale)}
					title={t('events.filterClear', locale)}
				>
					✕
				</button>
			{/if}
		</div>
	{/if}
</div>

{#if data.events.length === 0}
	<p class="text-gray-600">{t('events.empty', locale)}</p>
{:else}
	<ul class="grid grid-cols-1 gap-6">
		{#each filteredEvents as event (event.id)}
			<li>
				<a
					href={localizeHref(`/actividades/${event.slug}`, locale)}
					class="flex h-full flex-col rounded-lg border border-gray-200 p-4 hover:border-gray-400"
				>
					<p class="text-sm font-medium text-gray-500">
						{formatEventDate(event.date, locale)} · {event.time}
						{t('event.timeSuffix', locale)}
					</p>
					<h2 class="mt-1 font-medium">{localizedField(event, 'title', locale)}</h2>
					{#if event.venue_address}
						<p class="mt-2 text-sm text-gray-600">{event.venue_address}</p>
					{/if}
				</a>
			</li>
		{/each}
	</ul>
{/if}
