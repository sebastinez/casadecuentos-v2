// Static business identity — the store's real contact details, displayed on the
// contact page and in the footer, and used as the recipient for contact-form
// emails. Hardcoded (not env/DB) because these are stable, public facts about
// the business and v1 has no admin surface for them. The address is a real,
// informally-visitable location but NOT a point of sale (no in-store
// checkout/click-and-collect) — see the PRD's "first reconciliation to watch".
export const site = {
	// Public business contact email. Doubles as the contact-form recipient: in v1
	// the displayed address and the owner's inbox are the same (the PRD adds no
	// separate routing). MAIL_FROM stays the sender; this is the `to`.
	email: 'info@casadecuentos.ch',
	// Postal/visitable address (not a POS).
	address: 'Ahornweg 22, 8630 Rüti ZH, Suiza',
	// Instagram handle + canonical profile URL.
	instagram: '@casadecuentos',
	instagramUrl: 'https://instagram.com/casadecuentos'
} as const;
