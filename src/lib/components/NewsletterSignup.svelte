<script lang="ts">
	import { t } from '$lib/i18n';
	import type { Locale } from '$lib/i18n/locales';

	let { locale }: { locale: Locale } = $props();

	type Status = 'idle' | 'submitting' | 'success' | 'invalid' | 'rateLimited' | 'error';
	let status = $state<Status>('idle');
	let email = $state('');
	let website = $state('');

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		status = 'submitting';
		try {
			const res = await fetch('/api/newsletter', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, website })
			});
			if (res.ok) {
				status = 'success';
				email = '';
				return;
			}
			const data = (await res.json().catch(() => ({}))) as { error?: string };
			status =
				data.error === 'invalid'
					? 'invalid'
					: data.error === 'rateLimited'
						? 'rateLimited'
						: 'error';
		} catch {
			status = 'error';
		}
	}
</script>

<div class="max-w-sm">
	<h2 class="font-medium text-gray-900">{t('newsletter.heading', locale)}</h2>
	<p class="mt-2">{t('newsletter.intro', locale)}</p>

	<form class="mt-3 flex flex-col gap-2 sm:flex-row" onsubmit={submit} novalidate>
		<label class="sr-only" for="newsletter-email">{t('newsletter.email', locale)}</label>
		<input
			id="newsletter-email"
			type="email"
			name="email"
			required
			autocomplete="email"
			placeholder={t('newsletter.placeholder', locale)}
			bind:value={email}
			class="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2"
		/>
		<!-- Honeypot: hidden from humans, filled by naive bots. -->
		<div class="hidden" aria-hidden="true">
			<input type="text" name="website" tabindex="-1" autocomplete="off" bind:value={website} />
		</div>
		<button
			type="submit"
			disabled={status === 'submitting'}
			class="rounded-md bg-terracotta-600 px-4 py-2 font-medium text-white hover:bg-terracotta-700 disabled:cursor-not-allowed disabled:bg-terracotta-200"
		>
			{status === 'submitting'
				? t('newsletter.submitting', locale)
				: t('newsletter.submit', locale)}
		</button>
	</form>

	<p aria-live="polite" class="mt-2 min-h-5">
		{#if status === 'success'}
			<span class="text-green-800">{t('newsletter.success', locale)}</span>
		{:else if status === 'invalid'}
			<span class="text-red-700">{t('newsletter.invalid', locale)}</span>
		{:else if status === 'rateLimited'}
			<span class="text-red-700">{t('newsletter.rateLimited', locale)}</span>
		{:else if status === 'error'}
			<span class="text-red-700">{t('newsletter.error', locale)}</span>
		{/if}
	</p>
</div>
