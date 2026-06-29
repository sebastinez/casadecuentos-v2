// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		// Checkout surfaces expected failures (out-of-stock, invalid id) with a
		// machine-readable `message` code plus the offending book ids, so the cart
		// can name the problem line. `message` is required by SvelteKit's Error.
		interface Error {
			message: string;
			bookIds?: string[];
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
