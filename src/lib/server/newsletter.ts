import { env } from '$env/dynamic/private';

// Newsletter sign-up → a Resend contact. Same shape as the mail transport: a
// minimal `fetch` POST, no SDK dependency, and a logging fallback when
// `RESEND_FULL_API_KEY` is unset so local dev works without credentials.
//
// Uses a separate full-access key: `RESEND_API_KEY` stays a sending-only key
// (mail transport), since creating contacts needs broader permissions.
//
// Optional `RESEND_AUDIENCE_ID` scopes the contact to a specific audience/segment;
// without it the contact is created at the account level.
export async function subscribeToNewsletter(email: string): Promise<void> {
	const apiKey = env.RESEND_FULL_API_KEY;
	if (!apiKey) {
		console.info(`[newsletter:dev] would subscribe ${email}`);
		return;
	}

	const body: Record<string, unknown> = { email, unsubscribed: false };
	if (env.RESEND_AUDIENCE_ID) body.audience_id = env.RESEND_AUDIENCE_ID;

	const res = await fetch('https://api.resend.com/contacts', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(body)
	});

	// 409 = the contact already exists. From the visitor's point of view they're
	// subscribed, so treat it as success rather than leaking list membership.
	if (!res.ok && res.status !== 409) {
		const detail = await res.text().catch(() => '');
		throw new Error(`Resend contact create failed (${res.status}): ${detail}`);
	}
}
