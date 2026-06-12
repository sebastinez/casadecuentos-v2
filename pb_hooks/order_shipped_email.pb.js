/// <reference path="../pb_data/types.d.ts" />

// Phase 7 — email the customer when their order ships.
//
// Runs inside PocketBase's Goja JS runtime, NOT SvelteKit: there is no access to
// `$lib/server/mail` or the i18n layer, so the Spanish copy and the Resend POST
// are inlined here on purpose. This mirrors `src/lib/server/mail/index.ts` (the
// SvelteKit Resend transport) — same minimal POST to api.resend.com, expressed
// with `$http.send` instead of `fetch`.
//
// PocketBase JSVM gotcha (learned the hard way): each registered hook handler is
// executed in an ISOLATED VM and CANNOT see module-level `const`/`function`
// declarations from this file's outer scope — referencing one throws
// `ReferenceError` at runtime, which (without the try/catch below) surfaces as a
// 400 on the owner's save. So everything each handler needs is defined INSIDE
// that handler. Only PocketBase globals (`$http`, `$os`, `BadRequestError`,
// `toString`, `encodeURIComponent`) cross the boundary.
//
// Two hooks on the `orders` collection:
//   1. onRecordUpdate (pre-commit) — reject a `→ shipped` transition with no
//      tracking number, so the customer never gets a shipped email with no link.
//   2. onRecordAfterUpdateSuccess (post-commit) — send the "your order shipped"
//      email, but only on the actual paid → shipped transition (not on every
//      re-save of an already-shipped order).
//
// The owner drives `paid → shipped` in the PocketBase admin; these hooks react.
// Per the plan this phase is verified by manual/integration check, not Vitest.

// Pre-commit guard: block shipping without a tracking number. Throwing here
// aborts the admin save before it commits, so no half-finished shipped order
// (and no `onRecordAfterUpdateSuccess` fire) can happen. Uses only globals, so
// it is safe in the isolated VM. Kept minimal.
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

	// Transition detection, NOT "is shipped": without the original() compare,
	// every later save of a shipped order (e.g. fixing the address) would re-send
	// the email. Only fire on the edge into shipped, and only with a tracking
	// number (the pre-commit guard above should already ensure the latter).
	if (!(before !== 'shipped' && after === 'shipped') || !tracking) {
		e.next();
		return;
	}

	// Best-effort, like the Phase 6b confirmation email: the order IS shipped
	// regardless of email success, so a Resend outage — or any error building the
	// message — must NEVER block the owner's admin save (turn into an HTTP 400).
	// Everything that could throw is wrapped; the catch logs and the save stands.
	try {
		const to = e.record.get('email');
		const orderNumber = e.record.get('order_number');

		// `email` is populated by the Phase 6b webhook on the paid transition, so
		// it exists on every legitimately-paid order. Guard anyway — a hand-made
		// test order could lack it, and there's no one to send to without it.
		if (!to) {
			e.next();
			return;
		}

		// Escape the few characters that would break out of HTML context
		// (defensive; values are owner/Stripe-supplied, not free user input).
		// Defined inside the handler — the isolated VM can't reach outer scope.
		const esc = (value) =>
			String(value)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;');

		// Swiss Post's documented customer-facing tracking URL (post.ch business
		// docs): swisspost.ch/swisspost-tracking?formattedParcelCodes=<code>.
		// Supersedes the older service.post.ch/ekp-web format. This is the only
		// customer-visible link in the email — keep it correct and URL-encoded.
		const trackingUrl =
			'https://www.swisspost.ch/swisspost-tracking?formattedParcelCodes=' +
			encodeURIComponent(tracking);

		// Spanish copy. Consistent in tone with the SvelteKit confirmation email
		// (src/lib/i18n/messages.ts `email.confirm.*`); inlined because the i18n
		// table can't reach the Goja runtime. German is a v2 data-entry task (PRD).
		const subject = 'Tu pedido #' + orderNumber + ' va en camino';

		const text =
			'Gracias por tu compra en Casa de Cuentos.\n\n' +
			'Tu pedido #' +
			orderNumber +
			' ha sido enviado con Swiss Post.\n\n' +
			'Número de seguimiento: ' +
			tracking +
			'\n' +
			'Seguimiento: ' +
			trackingUrl +
			'\n\n' +
			'Casa de Cuentos';

		// Light HTML part so the tracking link is a real clickable anchor — the one
		// action the customer takes from this email. Mirrors the confirmation
		// email's text+html shape.
		const html =
			'<!doctype html>\n' +
			'<html lang="es">\n' +
			'<body style="font-family: system-ui, sans-serif; color: #1a1a1a;">\n' +
			'	<p>Gracias por tu compra en Casa de Cuentos.</p>\n' +
			'	<p>Tu pedido <strong>#' +
			esc(orderNumber) +
			'</strong> ha sido enviado con Swiss Post.</p>\n' +
			'	<p>Número de seguimiento: <strong>' +
			esc(tracking) +
			'</strong></p>\n' +
			'	<p><a href="' +
			esc(trackingUrl) +
			'">Seguir mi envío</a></p>\n' +
			'	<p>Casa de Cuentos</p>\n' +
			'</body>\n' +
			'</html>';

		const apiKey = $os.getenv('RESEND_API_KEY');
		const from = $os.getenv('MAIL_FROM');

		// Dev fallback: no credentials → log instead of send (mirrors the SvelteKit
		// `[mail:dev]` transport). Lets local fulfilment run without Resend. The env
		// must reach the PocketBase process (via $os.getenv), NOT just Vite — see
		// README / .env.example.
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

		// Goja uses `statusCode`, not `status`; `res.raw` is deprecated in favour
		// of `toString(res.body)`. Log non-2xx; the order is shipped regardless.
		if (res.statusCode >= 300) {
			console.log('[shipped-email] Resend failed (' + res.statusCode + '): ' + toString(res.body));
		}
	} catch (err) {
		console.log('[shipped-email] send failed: ' + err);
	}

	e.next();
}, 'orders');
