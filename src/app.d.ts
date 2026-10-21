// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// Checkout surfaces expected failures (out-of-stock, invalid id, incomplete
		// address) with a machine-readable `message` code plus what was wrong: the
		// offending book ids, or the delivery-address fields that failed validation,
		// so the cart can mark the problem line or input. `message` is required by
		// SvelteKit's Error.
		interface Error {
			message: string;
			bookIds?: string[];
			fields?: string[];
		}
		// Active locale, resolved from the URL prefix (`/es/…` | `/de/…`) in
		// `hooks.server.ts` and surfaced to every load/page via `+layout.server.ts`.
		interface Locals {
			locale: import('$lib/i18n').Locale;
		}
		interface PageData {
			locale: import('$lib/i18n').Locale;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
