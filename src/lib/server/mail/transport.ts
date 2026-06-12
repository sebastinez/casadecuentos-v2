// The mail transport seam. Outbound email is defined by two small interfaces so
// the rest of the app (the payment webhook's order-confirmation send) depends
// only on "something I can hand a message to", never on a concrete provider.
// The production transport is a Resend HTTP POST (`./index.ts`); tests inject a
// recording fake. This is the "swappable transport interface" the PRD mandates.

// A fully-rendered message ready to send. The template layer
// (`order-confirmation.ts`) produces this; the transport just delivers it. Both
// `html` and `text` are always provided so every client (and plain-text reader)
// renders well.
export interface MailMessage {
	to: string;
	subject: string;
	html: string;
	text: string;
}

// Anything that can deliver a `MailMessage`. Async because the real
// implementation makes a network call; the fake in tests resolves immediately.
export interface MailTransport {
	send(message: MailMessage): Promise<void>;
}
