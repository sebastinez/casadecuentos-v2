import Stripe from 'stripe';
import { env } from '$env/dynamic/private';

// The single point where the BFF instantiates the Stripe SDK. The secret key is
// server-only (injected via env / `EnvironmentFile` in production — Phase 12).
// Cached at module scope: the client is a stateless HTTPS wrapper, so one
// instance is reused across requests.
let client: Stripe | null = null;

export function createStripe(): Stripe {
	const key = env.STRIPE_SECRET_KEY;
	if (!key) {
		throw new Error('STRIPE_SECRET_KEY is not set (see .env.example).');
	}
	if (!client) {
		client = new Stripe(key);
	}
	return client;
}

// The signing secret for verifying inbound Stripe webhook payloads (Phase 6b).
// Server-only. In local dev it's the `whsec_…` printed by `stripe listen`; in
// production it's the endpoint's secret (injected via env — Phase 12). The
// webhook route passes it to `stripe.webhooks.constructEvent`; a missing secret
// is a misconfiguration, so fail loud rather than accept unverifiable events.
export function stripeWebhookSecret(): string {
	const secret = env.STRIPE_WEBHOOK_SECRET;
	if (!secret) {
		throw new Error('STRIPE_WEBHOOK_SECRET is not set (see .env.example).');
	}
	return secret;
}
