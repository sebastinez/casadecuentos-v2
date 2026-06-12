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
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
