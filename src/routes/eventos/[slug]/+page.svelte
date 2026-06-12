<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { t, localizedField, DEFAULT_LOCALE } from '$lib/i18n';
	import { formatEventDate } from '$lib/datetime';
	import EventMap from '$lib/components/EventMap.svelte';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const locale = DEFAULT_LOCALE;

	const event = $derived(data.event);
	const title = $derived(localizedField(event, 'title', locale));
	const description = $derived(localizedField(event, 'description', locale));
	const when = $derived(
		`${formatEventDate(event.date, locale)} · ${event.time} ${t('event.timeSuffix', locale)}`
	);
	// Only render the map when the owner filled in real coordinates.
	const hasMap = $derived(!!event.latitude && !!event.longitude);

	// Plain-text excerpt of the HTML blurb for the <meta>/OG description.
	const metaDescription = $derived(
		description
			.replace(/<[^>]*>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
			.slice(0, 200)
	);

	let submitting = $state(false);
</script>

<svelte:head>
	<title>{title} — {t('site.name', locale)}</title>
	<meta name="description" content={metaDescription} />
	<link rel="canonical" href={data.canonicalUrl} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={metaDescription} />
	<meta property="og:url" content={data.canonicalUrl} />
	<meta name="twitter:card" content="summary" />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={metaDescription} />
</svelte:head>

<article class="flex flex-col gap-8">
	<header>
		<a href="/eventos" class="text-sm text-gray-600 hover:underline"
			>← {t('event.backTolist', locale)}</a
		>
		<h1 class="mt-2 text-2xl font-semibold">{title}</h1>
		<dl class="mt-3 flex flex-col gap-1 text-sm text-gray-700">
			<div class="flex gap-2">
				<dt class="font-medium text-gray-500">{t('event.when', locale)}:</dt>
				<dd>{when}</dd>
			</div>
			{#if event.venue_address}
				<div class="flex gap-2">
					<dt class="font-medium text-gray-500">{t('event.where', locale)}:</dt>
					<dd>{event.venue_address}</dd>
				</div>
			{/if}
		</dl>
	</header>

	{#if description}
		<!-- Owner-authored blurb from the PocketBase `editor` field. Writes are
		     superuser-only (no public create/update rule on `events`), so this is
		     trusted content, not user input — {@html} is safe here. -->
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="prose prose-sm max-w-none">{@html description}</div>
	{/if}

	{#if hasMap}
		<section>
			<h2 class="mb-2 text-lg font-medium">{t('event.where', locale)}</h2>
			<EventMap
				latitude={event.latitude}
				longitude={event.longitude}
				label={t('event.mapLabel', locale)}
			/>
		</section>
	{/if}

	<section class="rounded-lg border border-gray-200 p-4">
		<h2 class="text-lg font-medium">{t('rsvp.heading', locale)}</h2>

		{#if form?.success}
			<p class="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
				{t('rsvp.success', locale)}
			</p>
		{:else}
			<p class="mt-1 text-sm text-gray-600">{t('rsvp.intro', locale)}</p>

			{#if form?.invalid}
				<p class="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
					{t('rsvp.invalid', locale)}
				</p>
			{/if}

			<form
				method="POST"
				action="?/rsvp"
				class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}
			>
				<label class="flex flex-col gap-1 text-sm">
					<span class="text-gray-500">{t('rsvp.name', locale)}</span>
					<input
						type="text"
						name="name"
						required
						value={form?.name ?? ''}
						class="rounded-md border border-gray-300 px-3 py-2"
					/>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					<span class="text-gray-500">{t('rsvp.familyName', locale)}</span>
					<input
						type="text"
						name="family_name"
						required
						value={form?.family_name ?? ''}
						class="rounded-md border border-gray-300 px-3 py-2"
					/>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					<span class="text-gray-500">{t('rsvp.email', locale)}</span>
					<input
						type="email"
						name="email"
						required
						value={form?.email ?? ''}
						class="rounded-md border border-gray-300 px-3 py-2"
					/>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					<span class="text-gray-500">{t('rsvp.phone', locale)}</span>
					<input
						type="tel"
						name="phone"
						required
						value={form?.phone ?? ''}
						class="rounded-md border border-gray-300 px-3 py-2"
					/>
				</label>

				<div class="sm:col-span-2">
					<button
						type="submit"
						disabled={submitting}
						class="rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
					>
						{submitting ? t('rsvp.submitting', locale) : t('rsvp.submit', locale)}
					</button>
				</div>
			</form>
		{/if}
	</section>
</article>
