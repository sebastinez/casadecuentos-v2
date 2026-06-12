import PocketBase from 'pocketbase';
import { env } from '$env/dynamic/private';

// The single point where the BFF instantiates a PocketBase client. Living under
// `$lib/server` means SvelteKit will refuse to bundle it into client code — the
// browser can never reach PocketBase directly. A fresh instance per call keeps
// request-scoped auth state from leaking between requests.
export function createPocketBase(): PocketBase {
	const url = env.POCKETBASE_URL;
	if (!url) {
		throw new Error('POCKETBASE_URL is not set (see .env.example).');
	}
	return new PocketBase(url);
}

// Module-scoped superuser client. The BFF is the *only* write identity in v1
// (guest checkout, no customer accounts): it creates `pending` orders, and from
// Phase 6b flips them to `paid` and decrements stock. The `orders` collection is
// superuser-only, so privileged writes go through a client authenticated as a
// superuser — distinct from `createPocketBase`, which is unauthenticated and
// per-request for public catalog reads.
//
// Unlike a user session, this is the server's own long-lived identity, so the
// instance + token are cached at module scope and re-authenticated only when the
// token is missing or expired — one auth round-trip, not one per checkout.
let adminClient: PocketBase | null = null;

export async function createAdminPocketBase(): Promise<PocketBase> {
	const url = env.POCKETBASE_URL;
	if (!url) {
		throw new Error('POCKETBASE_URL is not set (see .env.example).');
	}
	const email = env.POCKETBASE_ADMIN_EMAIL;
	const password = env.POCKETBASE_ADMIN_PASSWORD;
	if (!email || !password) {
		throw new Error(
			'POCKETBASE_ADMIN_EMAIL / POCKETBASE_ADMIN_PASSWORD are not set (see .env.example).'
		);
	}

	if (!adminClient || adminClient.baseURL !== url) {
		adminClient = new PocketBase(url);
	}

	// `authStore.isValid` checks the cached token's expiry locally (no network),
	// so a still-valid token reuses the cached session.
	if (!adminClient.authStore.isValid) {
		await adminClient.collection('_superusers').authWithPassword(email, password);
	}

	return adminClient;
}
