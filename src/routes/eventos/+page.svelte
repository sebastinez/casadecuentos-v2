<script lang="ts">
	import type { PageData } from './$types';
	import { t, localizedField, DEFAULT_LOCALE } from '$lib/i18n';
	import { formatEventDate } from '$lib/datetime';

	let { data }: { data: PageData } = $props();

	const locale = DEFAULT_LOCALE;
</script>

<svelte:head>
	<title>{t('events.heading', locale)} — {t('site.name', locale)}</title>
	<meta name="description" content={t('events.upcoming', locale)} />
</svelte:head>

<h1 class="mb-6 text-2xl font-semibold">{t('events.heading', locale)}</h1>

{#if data.events.length === 0}
	<p class="text-gray-600">{t('events.empty', locale)}</p>
{:else}
	<ul class="grid grid-cols-1 gap-6 sm:grid-cols-2">
		{#each data.events as event (event.id)}
			<li>
				<a
					href="/eventos/{event.slug}"
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
