import { env } from '$env/dynamic/private';
import type { MailMessage, MailTransport } from './transport';

export type { MailMessage, MailTransport } from './transport';
export { orderConfirmationEmail, type OrderConfirmationData } from './order-confirmation';
export { rsvpConfirmationEmail, type RsvpConfirmationData } from './rsvp-confirmation';
export { contactMessageEmail, type ContactMessageData } from './contact-message';

// Resend HTTP transport — a minimal `fetch` POST to the Resend API, no SDK
// dependency (mirrors the Phase 7 `pb_hooks` "minimal Resend POST" approach).
// Resend is EU-hosted per the PRD. Real domain/key provisioning is a Phase 12
// deploy concern; this just needs `RESEND_API_KEY` + `MAIL_FROM` to be live.
function resendTransport(apiKey: string, from: string): MailTransport {
	return {
		async send(message: MailMessage): Promise<void> {
			const res = await fetch('https://api.resend.com/emails', {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					from,
					to: message.to,
					subject: message.subject,
					html: message.html,
					text: message.text
				})
			});
			if (!res.ok) {
				// Throw so the caller knows the send failed. Note the failure is *not*
				// recovered by a Stripe retry: the order is already `paid` (the latch),
				// so a redelivery short-circuits at the idempotency guard. Fulfilment
				// therefore treats this send as best-effort — it logs and moves on
				// rather than emitting a pointless 500 (see `fulfillment.ts`).
				const detail = await res.text().catch(() => '');
				throw new Error(`Resend send failed (${res.status}): ${detail}`);
			}
		}
	};
}

// Dev/fallback transport — logs instead of sending. Lets local checkout +
// webhook flow run end-to-end without Resend credentials (the BFF has no deploy
// spine before Phase 12). Never used when `RESEND_API_KEY`/`MAIL_FROM` are set.
const logTransport: MailTransport = {
	async send(message: MailMessage): Promise<void> {
		console.info(`[mail:dev] would send "${message.subject}" to ${message.to}`);
	}
};

// Pick the transport for the current environment: real Resend when both the key
// and a from-address are configured, otherwise the logging fallback. Resolved
// per call (cheap) so config changes don't require a restart of nothing — the
// webhook builds its deps fresh each request.
export function createMailTransport(): MailTransport {
	const apiKey = env.RESEND_API_KEY;
	const from = env.MAIL_FROM;
	if (apiKey && from) {
		return resendTransport(apiKey, from);
	}
	return logTransport;
}
