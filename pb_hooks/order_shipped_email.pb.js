/// <reference path="../pb_data/types.d.ts" />

// Email the customer when their order ships.
//
// Runs inside PocketBase's Goja JS runtime, NOT SvelteKit: there is no access to
// `$lib/server/mail` or the i18n layer, so the Spanish copy and the Resend POST are
// inlined here — the same minimal api.resend.com POST as `src/lib/server/mail/index.ts`,
// expressed with `$http.send` instead of `fetch`.
//
// GOTCHA: each hook handler runs in an ISOLATED VM and cannot see module-level
// `const`/`function` declarations from this file's outer scope — referencing one
// throws `ReferenceError` (a 400 on the owner's save without the try/catch below). So
// everything each handler needs is defined INSIDE that handler. Only PocketBase
// globals (`$http`, `$os`, `BadRequestError`, `toString`, `encodeURIComponent`)
// cross the boundary.
//
// Two hooks on the `orders` collection:
//   1. onRecordUpdate (pre-commit) — reject a `→ shipped` transition with no tracking
//      number, so the customer never gets a shipped email with no link.
//   2. onRecordAfterUpdateSuccess (post-commit) — send the "your order shipped" email,
//      but only on the actual paid → shipped transition (not every re-save of an
//      already-shipped order).
//
// The owner drives `paid → shipped` in the PocketBase admin; these hooks react.

// Pre-commit guard: block shipping without a tracking number. Throwing aborts the
// save before it commits, so no half-finished shipped order (and no post-commit fire)
// can happen. Uses only globals, so it is safe in the isolated VM.
onRecordUpdate((e) => {
	const before = e.record.original().get('status');
	const after = e.record.get('status');
	const tracking = e.record.get('tracking_number');

	if (before !== 'shipped' && after === 'shipped' && !tracking) {
		throw new BadRequestError('No se puede marcar como enviado sin un número de seguimiento.');
	}

	e.next();
}, 'orders');

// Post-commit send: the email only goes out once the DB write committed.
onRecordAfterUpdateSuccess((e) => {
	const before = e.record.original().get('status');
	const after = e.record.get('status');
	const tracking = e.record.get('tracking_number');

	// Transition detection, NOT "is shipped": without the original() compare, every
	// later save of a shipped order (e.g. fixing the address) would re-send the email.
	// Fire only on the edge into shipped, and only with a tracking number.
	if (!(before !== 'shipped' && after === 'shipped') || !tracking) {
		e.next();
		return;
	}

	// Best-effort, like the confirmation email: the order IS shipped regardless of
	// email success, so a Resend outage — or any error building the message — must
	// NEVER block the owner's admin save (turn into an HTTP 400). Everything that could
	// throw is wrapped; the catch logs and the save stands.
	try {
		const to = e.record.get('email');
		const orderNumber = e.record.get('order_number');

		// `email` is populated by the webhook on the paid transition, so it exists on
		// every legitimately-paid order. Guard anyway — a hand-made test order could
		// lack it, and there's no one to send to without it.
		if (!to) {
			e.next();
			return;
		}

		// Escape HTML metacharacters (defensive; values are owner/Stripe-supplied).
		// Defined inside the handler — the isolated VM can't reach outer scope.
		const esc = (value) =>
			String(value)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;');

		// Swiss Post's documented customer-facing tracking URL (supersedes the older
		// service.post.ch/ekp-web format). The only customer-visible link in the email
		// — keep it correct and URL-encoded.
		const trackingUrl =
			'https://www.swisspost.ch/swisspost-tracking?formattedParcelCodes=' +
			encodeURIComponent(tracking);

		// Spanish copy, inlined because the i18n table can't reach the Goja runtime
		// (consistent in tone with `email.confirm.*` in src/lib/i18n/messages.ts).
		const subject = 'Tu pedido #' + orderNumber + ' va en camino';
		const heading = 'Tu pedido va en camino.';
		const intro =
			'Gracias por tu compra en Casa de Cuentos. Tu pedido #' +
			orderNumber +
			' ha sido enviado con Swiss Post.';
		const trackingLabel = 'Número de seguimiento';
		const cta = 'Seguir mi envío';
		// Duplicated from `site.email` in src/lib/site.ts — the Goja runtime can't import it.
		const contactEmail = 'info@casadecuentos.ch';
		const help = 'Si tienes alguna pregunta, responde a este correo o escríbenos a';

		const text =
			heading +
			'\n\n' +
			intro +
			'\n\n' +
			trackingLabel +
			': ' +
			tracking +
			'\n' +
			cta +
			': ' +
			trackingUrl +
			'\n\n' +
			help +
			' ' +
			contactEmail +
			'.\n\n' +
			'Casa de Cuentos';

		// Branded card, mirroring the order-confirmation template
		// (src/lib/server/mail/layout.ts): terracotta on cream, one 560px table, inline
		// styles only — no <style> block, no flexbox, no rem units, the one thing Gmail /
		// Outlook / Apple Mail all render the same. Palette and card metrics are COPIED
		// from that file; a change there should be mirrored here (the Goja VM can't
		// import it, and this handler can't even see this file's outer scope).
		const accent = '#8b4733'; // terracotta-700 (wordmark)
		const ink = '#1c1917'; // gray-900
		const muted = '#57534e'; // gray-600
		const hairline = '#e8caba'; // terracotta-200
		const cream = '#faf4f1'; // terracotta-50
		const font =
			"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
		// Stable URL on the static-asset host (Caddy file_server, see deploy/Caddyfile);
		// alt text carries the brand when the image is blocked.
		const logoUrl = 'https://assets.casadecuentos.ch/logo.webp';

		// Array + join rather than one long `+` chain: this is a lot of markup, and a
		// line-per-row stays reviewable.
		const html = [
			'<!doctype html>',
			'<html lang="es">',
			'<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>',
			'<body style="margin:0;padding:0;background:' + cream + ';">',
			'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' +
				cream +
				';">',
			'<tr><td align="center" style="padding:32px 16px;">',
			'<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#ffffff;border:1px solid ' +
				hairline +
				';border-radius:12px;overflow:hidden;font-family:' +
				font +
				';">',
			// Header: wordmark + order number
			'<tr><td style="padding:28px 32px;border-bottom:1px solid ' + hairline + ';">',
			'<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>',
			'<td style="vertical-align:middle;"><img src="' +
				logoUrl +
				'" alt="Casa de Cuentos" width="56" height="56" style="display:block;width:56px;height:56px;border:0;"/></td>',
			'<td style="text-align:right;vertical-align:middle;font-size:13px;letter-spacing:0.04em;text-transform:uppercase;color:' +
				muted +
				';">Pedido #' +
				esc(orderNumber) +
				'</td>',
			'</tr></table>',
			'</td></tr>',
			// Heading + intro
			'<tr><td style="padding:32px 32px 8px;">',
			'<h1 style="margin:0 0 12px;font-size:22px;font-weight:700;color:' +
				ink +
				';">' +
				esc(heading) +
				'</h1>',
			'<p style="margin:0;font-size:15px;line-height:1.6;color:' +
				muted +
				';">' +
				esc(intro) +
				'</p>',
			'</td></tr>',
			// Tracking number, in the same label/value shape as the RSVP detail rows
			'<tr><td style="padding:24px 32px 0;">',
			'<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>',
			'<td style="padding:10px 12px 10px 0;font-size:13px;line-height:1.5;color:' +
				muted +
				';vertical-align:top;white-space:nowrap;">' +
				trackingLabel +
				'</td>',
			'<td style="padding:10px 0;font-size:15px;line-height:1.5;color:' +
				ink +
				';vertical-align:top;font-weight:700;">' +
				esc(tracking) +
				'</td>',
			'</tr></table>',
			'</td></tr>',
			// The one action this email exists for.
			'<tr><td style="padding:16px 32px 32px;">',
			'<a href="' +
				esc(trackingUrl) +
				'" style="display:inline-block;background:' +
				accent +
				';color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:700;">' +
				cta +
				'</a>',
			'</td></tr>',
			// Footer band
			'<tr><td style="padding:20px 32px;background:' +
				cream +
				';border-top:1px solid ' +
				hairline +
				';">',
			'<p style="margin:0;font-size:13px;line-height:1.6;color:' +
				muted +
				';">' +
				help +
				' <a href="mailto:' +
				contactEmail +
				'" style="color:' +
				accent +
				';text-decoration:none;">' +
				contactEmail +
				'</a>.</p>',
			'</td></tr>',
			'</table>',
			'</td></tr>',
			'</table>',
			'</body>',
			'</html>'
		].join('\n');

		const apiKey = $os.getenv('RESEND_API_KEY');
		const from = $os.getenv('MAIL_FROM');

		// Dev fallback: no credentials → log instead of send. The env must reach the
		// PocketBase process (via $os.getenv), NOT just Vite — see README / .env.example.
		if (!apiKey || !from) {
			console.log('[mail:dev] would send "' + subject + '" to ' + to);
			e.next();
			return;
		}

		const res = $http.send({
			url: 'https://api.resend.com/emails',
			method: 'POST',
			headers: {
				Authorization: 'Bearer ' + apiKey,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				from: from,
				to: to,
				subject: subject,
				text: text,
				html: html
			})
		});

		// Goja uses `statusCode` (not `status`); `toString(res.body)` over the
		// deprecated `res.raw`. Log non-2xx; the order is shipped regardless.
		if (res.statusCode >= 300) {
			console.log('[shipped-email] Resend failed (' + res.statusCode + '): ' + toString(res.body));
		}
	} catch (err) {
		console.log('[shipped-email] send failed: ' + err);
	}

	e.next();
}, 'orders');
