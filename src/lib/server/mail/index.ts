import { env } from '$env/dynamic/private';
import type { MailMessage, MailTransport } from './transport';

export type { MailMessage, MailTransport } from './transport';
export { orderConfirmationEmail, type OrderConfirmationData } from './order-confirmation';
export { rsvpConfirmationEmail, type RsvpConfirmationData } from './rsvp-confirmation';
export { rsvpNotificationEmail, type RsvpNotificationData } from './rsvp-notification';
export { contactMessageEmail, type ContactMessageData } from './contact-message';

// Resend HTTP transport — a minimal `fetch` POST to the Resend API, no SDK
// dependency. Needs `RESEND_API_KEY` + `MAIL_FROM` to be live.
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
				// Throw so the caller knows the send failed. Fulfilment treats this as
				// best-effort (logs, no 500) since the order is already `paid` and a Stripe
				// retry short-circuits at the idempotency guard — see fulfillment.ts.
				const detail = await res.text().catch(() => '');
				throw new Error(`Resend send failed (${res.status}): ${detail}`);
			}
		}
	};
}

// Dev/fallback transport — logs instead of sending, so local checkout + webhook run
// end-to-end without Resend credentials. Never used when `RESEND_API_KEY`/`MAIL_FROM`
// are set.
const logTransport: MailTransport = {
	async send(message: MailMessage): Promise<void> {
		console.info(`[mail:dev] would send "${message.subject}" to ${message.to}`);
	}
};

// Real Resend when both the key and a from-address are configured, otherwise the
// logging fallback. Resolved per call (the webhook builds its deps fresh each request).
export function createMailTransport(): MailTransport {
	const apiKey = env.RESEND_API_KEY;
	const from = env.MAIL_FROM;
	if (apiKey && from) {
		return resendTransport(apiKey, from);
	}
	return logTransport;
}
