<script lang="ts">
	import type { ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { t, DEFAULT_LOCALE } from '$lib/i18n';
	import { site } from '$lib/site';

	let { form }: { form: ActionData } = $props();

	const locale = DEFAULT_LOCALE;

	let submitting = $state(false);
</script>

<svelte:head>
	<title>{t('contact.heading', locale)} — {t('site.name', locale)}</title>
	<meta name="description" content={t('contact.intro', locale)} />
</svelte:head>

<div class="flex flex-col gap-8">
	<header>
		<h1 class="text-2xl font-semibold">{t('contact.heading', locale)}</h1>
		<p class="mt-1 text-sm text-gray-600">{t('contact.intro', locale)}</p>
	</header>

	<section class="rounded-lg border border-gray-200 p-4">
		{#if form?.success}
			<p class="rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">
				{t('contact.success', locale)}
			</p>
		{:else}
			{#if form?.rateLimited}
				<p class="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
					{t('contact.rateLimited', locale)}
				</p>
			{:else if form?.invalid}
				<p class="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
					{t('contact.invalid', locale)}
				</p>
			{/if}

			<form
				method="POST"
				class="grid grid-cols-1 gap-4 sm:grid-cols-2"
				use:enhance={() => {
					submitting = true;
					return async ({ update }) => {
						await update();
						submitting = false;
					};
				}}
			>
				<label class="flex flex-col gap-1 text-sm">
					<span class="text-gray-500">{t('contact.name', locale)}</span>
					<input
						type="text"
						name="name"
						required
						value={form?.name ?? ''}
						class="rounded-md border border-gray-300 px-3 py-2"
					/>
				</label>
				<label class="flex flex-col gap-1 text-sm">
					<span class="text-gray-500">{t('contact.email', locale)}</span>
					<input
						type="email"
						name="email"
						required
						value={form?.email ?? ''}
						class="rounded-md border border-gray-300 px-3 py-2"
					/>
				</label>
				<label class="flex flex-col gap-1 text-sm sm:col-span-2">
					<span class="text-gray-500">{t('contact.subject', locale)}</span>
					<input
						type="text"
						name="subject"
						required
						value={form?.subject ?? ''}
						class="rounded-md border border-gray-300 px-3 py-2"
					/>
				</label>
				<label class="flex flex-col gap-1 text-sm sm:col-span-2">
					<span class="text-gray-500">{t('contact.message', locale)}</span>
					<textarea
						name="message"
						required
						rows="5"
						class="rounded-md border border-gray-300 px-3 py-2">{form?.message ?? ''}</textarea
					>
				</label>

				<!-- Honeypot: hidden from real users (visually + from a11y tree + tab
				     order), but bots that fill every field trip it. Server silently
				     drops any submission where this is non-empty. -->
				<div class="hidden" aria-hidden="true">
					<label>
						Website
						<input type="text" name="website" tabindex="-1" autocomplete="off" />
					</label>
				</div>

				<div class="sm:col-span-2">
					<button
						type="submit"
						disabled={submitting}
						class="rounded-md bg-gray-900 px-5 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
					>
						{submitting ? t('contact.submitting', locale) : t('contact.submit', locale)}
					</button>
				</div>
			</form>
		{/if}
	</section>

	<section>
		<h2 class="text-lg font-medium">{t('contact.reach', locale)}</h2>
		<dl class="mt-3 flex flex-col gap-2 text-sm text-gray-700">
			<div class="flex gap-2">
				<dt class="font-medium text-gray-500">{t('contact.addressLabel', locale)}:</dt>
				<dd>{site.address}</dd>
			</div>
			<div class="flex gap-2">
				<dt class="font-medium text-gray-500">{t('contact.emailLabel', locale)}:</dt>
				<dd><a href="mailto:{site.email}" class="hover:underline">{site.email}</a></dd>
			</div>
			<div class="flex gap-2">
				<dt class="font-medium text-gray-500">{t('contact.instagramLabel', locale)}:</dt>
				<dd>
					<a href={site.instagramUrl} class="hover:underline" rel="noopener" target="_blank"
						>{site.instagram}</a
					>
				</dd>
			</div>
		</dl>
	</section>
</div>
