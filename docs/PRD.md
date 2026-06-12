# PRD — Casa de Cuentos v1 (Online Bookstore)

> Status: ready-for-agent
> Stack: SvelteKit (SSR, `adapter-node`) + PocketBase, self-hosted on NixOS/Hetzner behind Caddy.
> Scope: first public v1 of an online-only children's & young-adult bookstore for a Swiss audience.

---

## Problem Statement

The owner currently runs a children's & young-adult bookstore on Shopify and is paying recurring monthly platform fees that they want to eliminate. They need an online-only store, tailored to a Spanish-speaking audience in Switzerland, that they can **self-host cheaply** and **operate solo** — selling books, promoting in-person community events, and presenting the business — without an ongoing SaaS bill or the operational weight of a heavyweight commerce platform.

From the owner's perspective:

- "I want to stop paying Shopify every month and own my stack."
- "I want to manage all my content (books, events, banners) and fulfil orders from one simple admin."
- "I want customers to discover books easily, pay securely, and get their order shipped with tracking."
- "I want to advertise free community events and let people RSVP."

From the customer's perspective (a Spanish-speaking parent/reader in Switzerland):

- "I want to browse and filter children's/YA books, find one, and buy it with a payment method I trust (TWINT or card)."
- "I want it shipped to my Swiss address and to receive tracking when it ships."
- "I want to see upcoming events and reserve a spot."

## Solution

A server-rendered SvelteKit storefront backed by a single PocketBase instance, deployed as declarative NixOS services (PocketBase + SvelteKit + Caddy) on one inexpensive Hetzner VPS. SvelteKit acts as a **BFF**: the browser only talks to SvelteKit; SvelteKit talks to PocketBase and Stripe. Payments use **hosted Stripe Checkout** (handles SCA/3-D Secure, TWINT, cards, and Swiss address collection). Transactional email goes through **Resend (EU region)**. The owner runs the entire business — catalog, events, banners, featured-list curation, orders, and fulfilment — from the **PocketBase admin UI**, with a `pb_hooks` hook sending the shipping email when an order is marked shipped.

v1 launches **Spanish-only** but is **architected for German** (i18n message layer + localized-field accessor with Spanish fallback) so German content becomes a v2 data-entry task, not a rebuild.

## User Stories

**Browsing & discovery**

1. As a customer, I want to see a landing page with a hero carousel and featured promo banners, so that I immediately understand the store and see highlights.
2. As a customer, I want a hand-curated "Featured books" strip on the landing page, so that I see the owner's top picks first, in a deliberate order.
3. As a customer, I want a product listing of all books, so that I can browse the catalog.
4. As a customer, I want to filter the listing by age band (0–3, 3–6, 6–9, 9–12, 12+/YA), so that I find age-appropriate books for my child.
5. As a customer, I want to filter the listing by genre, so that I narrow to the kind of book I want.
6. As a customer, I want to filter the listing by publisher, so that I find books from publishers I trust.
7. As a customer, I want to filter the listing by the book's language, so that I find books in the language I want (the store stocks multilingual titles).
8. As a customer, I want to combine filters and have them reflected in the URL, so that I can share or bookmark a filtered view and use the back button correctly.
9. As a customer, I want to search the listing by title/author/illustrator, so that I can quickly find a known book.
10. As a customer, I want a fuzzy search in the header (typo-tolerant) with an autocomplete dropdown, so that I can jump straight to a book's detail page even if I misspell it.
11. As a customer, I want a product detail page per book showing cover, title, author, illustrator, description, publisher, publication year, language, format, page count, book size, ISBN, and price (CHF), so that I can make a purchase decision.
12. As a customer, I want clean, SEO-friendly URLs and correct link previews (OG tags) on product and event pages, so that pages are findable on Google and shareable on WhatsApp/Instagram.
13. As a customer, I want out-of-stock books to show as unavailable with a disabled buy action, so that I don't try to buy something that isn't available.

**Cart & checkout** 14. As a customer, I want to add books to a cart and adjust quantities, so that I can buy several at once. 15. As a customer, I want my cart to persist if I reload or come back later on the same device, so that I don't lose my selection. 16. As a customer, I want to check out via a secure hosted payment page, so that I trust the transaction. 17. As a customer, I want to pay with TWINT or card (and Apple/Google Pay where available), so that I can use my preferred Swiss payment method. 18. As a customer, I want to enter my Swiss shipping address during checkout, so that my order can be delivered. 19. As a customer, I want a flat shipping rate applied, so that shipping cost is predictable. 20. As a customer, I want the checkout page in Spanish, so that I understand it. 21. As a customer, I want to be confident that the price I'm charged is the real catalog price, so that I'm not over- or under-charged (server-authoritative pricing). 22. As a customer, I want an order confirmation email after paying, so that I have proof of purchase. 23. As a customer, I want a "shipped" email with a Swiss Post tracking link, so that I can track my parcel.

**Events** 24. As a customer, I want to see a list of upcoming events, so that I know what's happening. 25. As a customer, I want past events to disappear from the listing automatically, so that I only see relevant events. 26. As a customer, I want an event detail page with title, description, date, time, and a map, so that I have all the info to attend. 27. As a customer, I want event times shown correctly for Switzerland (Europe/Zurich, DST-aware), so that I arrive at the right hour. 28. As a customer, I want a map pin (OpenStreetMap) for the venue, so that I can find the location. 29. As a customer, I want to RSVP to a free event with my name, family name, email, and phone, so that I can reserve a spot. 30. As a customer, I want an RSVP confirmation email, so that I know my reservation went through.

**Content pages & contact** 31. As a customer, I want an "About" page, so that I learn about the store. 32. As a customer, I want a contact page with a form (name, email, subject, message), so that I can reach the owner. 33. As a customer, I want to see the business address, email, and Instagram on the contact page, so that I trust the store is real and can reach it other ways. 34. As a customer, I want to read privacy, terms, and shipping/returns pages, so that I understand my rights and the store's policies.

**Global chrome** 35. As a customer, I want a sticky top menu (Inicio, Libros, Eventos, Nosotros, Contacto) with a cart icon + live item count, so that I can navigate and reach my cart anywhere. 36. As a customer, I want a search icon in the top-right opening the fuzzy search, so that I can find books from any page. 37. As a customer, I want a footer on every page with policy links, contact info, and copyright, so that I can find secondary info. 38. As a mobile customer, I want the menu to collapse into a hamburger that opens a left-side drawer (fades/slides in over a dimmed backdrop), so that navigation works on a small screen. 39. As a mobile customer, I want the drawer to be accessible — focus trapped, closeable via Esc/backdrop, focus returned to the toggle, background scroll locked, and animation suppressed under reduced-motion — so that it's usable and not janky.

**Owner / operations** 40. As the owner, I want to manage all books (CRUD, images, stock, all fields) in one admin, so that I control my catalog. 41. As the owner, I want to manage genres, publishers, and book languages as structured lists, so that filters stay clean and I can rename without code changes. 42. As the owner, I want to hand-curate the order of featured books on the landing page, so that my best picks appear first. 43. As the owner, I want to manage hero and featured banners with bilingual text, image, CTA, sort order, active flag, and optional schedule window, so that I can run timed promotions. 44. As the owner, I want to manage events and view their RSVPs, so that I can plan capacity informally. 45. As the owner, I want to see paid orders with their cart snapshot and shipping address, so that I can fulfil them. 46. As the owner, I want to mark an order shipped and enter the Swiss Post tracking number, which automatically emails the customer their tracking link, so that fulfilment is one step. 47. As the owner, I want contact-form messages stored in the admin as a backup, so that I never lose a message even if email fails. 48. As the owner, I want to operate everything from the PocketBase admin (no separate custom admin), so that my daily workflow is simple. 49. As the owner, I want the store to run on one cheap VPS with reproducible NixOS config, so that I control cost and can rebuild deterministically. 50. As the owner, I want automated backups of the database and uploaded images, so that I don't lose the business if the box dies.

## Implementation Decisions

### Architecture

- **SvelteKit (SSR) as a BFF**, deployed with `adapter-node` as a Node service. The browser talks only to SvelteKit; SvelteKit talks to PocketBase and Stripe. Rationale: SEO/OG for product & event pages, a trusted server runtime for Stripe secrets + webhook, native locale routing later, single origin.
- **PocketBase** as the data + auth backend and the **sole operational admin UI**. SQLite on local disk.
- **`pb_hooks/`** is part of the stack: used for the shipped-tracking email (`onRecordUpdate` → POST to Resend) and lightweight server-side validation.
- Stack chosen over Medusa (too heavy/expensive to self-host — Postgres+Redis+worker, ~$35/mo; commerce complexity we don't have) and Payload/Shopify, because the deciding priorities are **minimal recurring cost** and a **content-heavy, low-complexity catalog**.

### Internationalization

- v1 ships **Spanish-only** content and UI, but is **i18n-ready in code**: all UI strings go through an i18n message layer; localizable content reads go through a **localized-field accessor** with Spanish fallback. German is a **v2 content-entry task**.
- **Locale-variant content is narrow:** UI chrome, taxonomy labels (genre, age-band, format), banner text, event title/description, and the store's own book `description` blurb. **Book bibliographic metadata (title, author, illustrator, ISBN, language) is intrinsic and never translated.**
- **No locale URL prefix in v1** (URLs stay clean); adding `/es/` + `/de/` in v2 will use 301 redirects. No language switcher in v1.
- PocketBase makes adding `*_de` columns non-destructive, so German columns are **not** pre-created.

### Commerce — orders, stock, payments

- **Guest checkout only.** No customer accounts in v1. Order lookup, if needed, is via tokenized links in emails (not login).
- **Hosted Stripe Checkout** (redirect). Currency **CHF**. Payment methods: **TWINT + cards** (+ Apple/Google Pay where the device supports it). Checkout `locale: es`.
- **Stripe collects the shipping address** (`shipping_address_collection` restricted to `CH`) and applies the **flat-rate shipping** as a Stripe `shipping_option`. No custom address form in v1 (this supersedes an earlier localStorage address-prefill idea).
- **Order lifecycle:** `pending → paid → shipped`.
  - An `order` record is created as **`pending`** _before_ redirect, storing a **cart snapshot** (titles, prices, quantities at that moment) + the Stripe session id.
  - The **signature-verified Stripe webhook (`checkout.session.completed`) is the only source of truth** that flips an order to `paid`. The success redirect is **never** trusted for fulfilment.
  - On `paid`: decrement stock, send the confirmation email.
- **Webhook is idempotent:** dedupe on the Stripe event/session id so an order is marked paid once and stock decrements once on redelivery.
- **Price integrity (security):** the client sends **only book IDs + quantities**; the server reads authoritative **price and stock from PocketBase** when building Stripe line items. Browser-supplied prices are never trusted.
- **Stock:** integer `stock` per book; checked at session creation, decremented on the `paid` webhook. **No reservation system and overselling tolerated** (rare; resolved by refund) — store does not sell scarce single-copy stock.
- **Cart** lives in **localStorage** (book IDs + quantities only, never prices), rehydrated on load, re-validated server-side at checkout.

### Catalog & content model (PocketBase collections)

- **`books`**: **intrinsic** (non-localized) bibliographic fields — `title`, `author`, `illustrator`, `ISBN`, `language` (relation — book's actual language), `format`, `page_count`, `book_size`, `publisher` (relation), `publication_year` — plus `price` (CHF), `stock` (int), `cover` image (+ optional gallery), `age_band`, `genre` (relation), `slug`, and `featured` handling via curated join. **Only the store's own `description` blurb is localizable** (Spanish in v1, German in v2). Rationale: a physical book's title/author/illustrator are the real edition the customer receives and must not be translated — a German-speaking shopper sees a Spanish book's real Spanish title.
- **`genres`**, **`publishers`**, **`book_languages`**: small relation collections powering clean filter facets and rename-without-code.
- **`age_band`**: structured field/enum (`0-3`, `3-6`, `6-9`, `9-12`, `12+`/YA).
- **`featured_books`**: curated join (relation to a book + explicit `sort` + `active`) for the landing-page featured strip in a deliberate order.
- **`banners`**: `type` (`hero` | `featured`), localized `title`/`subtitle`, `image`, CTA `label` + `link` (can point at a filtered listing, a book, or an event), `sort`, `active`, optional `start`/`end` schedule window.
- **`events`**: localized `title`, localized `description`, `date`, `time` (stored/displayed in **Europe/Zurich**), `venue_address`, `latitude`, `longitude`, `slug`. Past events auto-hidden from listing by date filter.
- **`rsvps`**: relation to event + `name`, `family_name`, `email`, `phone`. No capacity enforcement, no waitlist.
- **`orders`**: status (`pending`/`paid`/`shipped`), **human-readable order number (unique incremental integer, surfaced in emails)**, cart snapshot, totals, shipping address (from Stripe), Stripe session/event ids, carrier (`Swiss Post`), tracking number.
- **`contact_messages`**: `name`, `email`, `subject`, `message`, timestamps (backup copy of contact submissions).
- **Static pages** (About, privacy, terms, shipping & returns) are **hardcoded in Svelte** (Spanish). The privacy notice must accurately name real processors: **Stripe, Resend, Hetzner, PocketBase**.

### Listing & search

- **Listing filters:** age band + genre + publisher + book language, plus server-side **substring** text search over title/author/illustrator, expressed as **URL query params** → PocketBase filter queries (shareable, SEO-friendly, back-button correct). Sort by newest + price.
- **Header search:** **client-side fuzzy (Fuse.js)** over a lightweight precomputed catalog index (id, title, author, illustrator, slug, cover) → autocomplete dropdown → product detail. No dedicated search engine in v1 (revisit at several-thousand-title scale).

### Events & maps

- **Free events only** in v1. RSVP = name/family_name/email/phone → `rsvps` record + Spanish confirmation email.
- **Maps via Leaflet + OpenStreetMap** (free, keyless). Each event carries a venue address + lat/lng for the pin. Respect OSM tile-usage policy at low volume.

### Email (Resend, EU region)

- One **mail module behind an interface** (swappable transport) in SvelteKit, plus a parallel minimal Resend POST in the `pb_hooks` shipped-email hook.
- Templates (Spanish, bilingual-ready): order confirmation, order shipped + tracking, RSVP confirmation, contact-message-to-owner. **No auto-acknowledgement** to contact senders in v1.
- **Deliverability:** authenticate the sending domain — **SPF + DKIM (from Resend) + DMARC** — sending from a dedicated subdomain. (Owner controls DNS.)

### Tax / legal

- **Not VAT-registered** (below the CHF 100k threshold), **books-only** → **no VAT subsystem, no tax categories, no tax line.** Prices are plain CHF, tax-inclusive by convention.
- **No returns for change of mind** in v1 (Switzerland has no statutory withdrawal right), but the policy must still honor **warranty for defective/wrong items** (Swiss Code of Obligations) — replace damaged/incorrect books.

### Contact form

- Fields: name, email, subject, message. **Honeypot field + server-side rate limit** for spam (Cloudflare Turnstile is the deferred escalation, not in v1).
- On submit: **store in `contact_messages` AND send via Resend to the owner** (stored copy is reliability insurance).
- Contact page displays: **business address, email, Instagram** (address is a real, informally-visitable location but **not** a POS — no in-store checkout/click-and-collect).

### Global chrome

- **Sticky top nav:** Inicio · Libros · Eventos · Nosotros · Contacto + cart icon with live count + search icon (top-right). No language switcher in v1.
- **Footer everywhere:** policy links, contact info (address/email/Instagram), copyright. No newsletter in v1.
- **Mobile hamburger:** left-side drawer, fade/slide in over dimmed backdrop, with **focus trap, Esc/backdrop close, focus return to toggle, background scroll lock, and `prefers-reduced-motion` support.**

### Hosting & ops

- **One Hetzner VPS** (EU data residency — acceptable; Swiss-resident hosting is a later upgrade if desired). **NixOS** declarative config; **Caddy** reverse proxy with automatic HTTPS; PocketBase + SvelteKit colocated as systemd services. Domain A/AAAA → VPS.
- **Secrets via sops-nix or agenix** — never in the world-readable `/nix/store`; injected into services via `EnvironmentFile`/`LoadCredential` (Stripe secret key, Stripe webhook signing secret, Resend API key).
- **Images** in PocketBase file storage on local disk; responsive thumbnails via PocketBase query params.
- **Backups:** Litestream (continuous SQLite → object storage) or PocketBase scheduled backup-to-S3, plus periodic image-dir snapshots.
- The Stripe webhook requires a **stable public HTTPS URL** in production (no static-only deploy).

## Testing Decisions

**What makes a good test here:** assert **external behavior through a module's public interface**, not internal implementation details. Inject ports (storage, catalog lookup, mail transport, clock) so the pure logic is exercised without real I/O. Tests should survive refactors that don't change behavior.

**Modules to unit-test (pure / money- & security-critical):**

1. **Cart** — add/remove/update-qty/clear, persistence round-trip via an injected storage port, quantity edge cases. Behavior, not localStorage internals.
2. **Search index (Fuse.js)** — fuzzy matching: exact hits, typo tolerance, ranking order, empty/no-match, field coverage (title/author/illustrator). Pure, no I/O.
3. **Order builder / price-integrity** — given IDs+quantities and a stubbed catalog port: correct line items + flat shipping, **rejects browser-supplied prices**, out-of-stock and invalid-id error paths. This is the security-critical unit.
4. **Order state machine** — legal transitions (`pending→paid→shipped`) allowed, illegal transitions rejected.
5. **Payment webhook / fulfillment** — signature verification (valid/invalid), **idempotency** (redelivered event flips paid + decrements stock exactly once), correct state transition, confirmation-email trigger — all with a mocked Stripe + mocked stock/mail ports.
6. **i18n accessor** — returns the requested locale when present; **falls back to Spanish** when a translation is missing; `t(key)` resolves and handles missing keys.

**Explicitly not unit-tested (per owner agreement):**

- Thin PocketBase read-wrappers (**Catalog read, Events, Content**) — better covered by a few **integration tests against a real PocketBase instance** than mock-heavy unit tests asserting query strings.
- **Checkout (Stripe session creation)** — covered via integration/mocked-SDK rather than deep unit tests.
- **`pb_hooks` shipped-email hook** — runs in PocketBase's Goja runtime; integration/manual verification, not in the SvelteKit unit suite.

**Prior art:** none yet — greenfield repo. Establish the port-injection + mocked-transport pattern with these first modules so later modules follow it.

## Out of Scope

- **German content** (v1 is Spanish-only; code is i18n-ready). Language switcher and `/es/` `/de/` URL routing.
- **Customer accounts / login**, order-history dashboards, saved addresses (beyond Stripe Link's own behavior).
- **Guest order-status page** — the shipped email's Swiss Post tracking link covers the real need; no tokenized status page in v1.
- **Analytics & cookie-consent banner** — no analytics ship in v1 (a conscious no); the localStorage cart alone requires no nFADP consent banner. Privacy-friendly analytics (e.g. Plausible) is a deliberate v2 option.
- **VAT/tax handling** of any kind (not VAT-registered, books-only).
- **Returns processing / RMA flow** (no change-of-mind returns in v1).
- **Paid/ticketed events**, event capacity limits, and **waitlists**.
- **Stock reservation system** (overselling tolerated and resolved manually).
- **Multiple shipping carriers** (Swiss Post only) and variable/weight-based shipping (flat rate only).
- **Product variants** (single SKU per book), **discount codes, sale prices, gift cards**.
- **Newsletter / marketing email**, contact auto-acknowledgement.
- **Custom SvelteKit admin** (operate via PocketBase admin), **multi-user/staff roles** (solo operator).
- **Dedicated search engine** (Meilisearch/Typesense) — Fuse.js suffices at current scale.
- **Cloudflare Turnstile** (honeypot + rate limit only in v1).
- **Swiss-resident hosting** (Hetzner/EU for v1).
- **Editable About/policy pages** (hardcoded in v1).

## Further Notes

- **Content-ops reality (v2):** German launch is a _narrow_ translation/data-entry effort — UI chrome, taxonomy labels, banners, event titles/descriptions, and store-written book blurbs — **not** the full catalog (book metadata is intrinsic and stays as-is). Plus turning on locale routing/switcher. The schema and code are built to absorb it without rework, and the lift is much smaller than translating every title.
- **Stripe Link** will autofill address/payment for _some_ returning customers (those who use Link), not all guests — acceptable for v1.
- **Owner's daily loop:** live in PocketBase admin — add/edit books, curate the featured list, manage banners/events, read RSVPs and contact messages, and fulfil orders (mark shipped + tracking → auto-email).
- **First reconciliation to watch:** the "no physical store" decision coexists with showing a real, informally-visitable address — this is intentional (contact/business address, not a POS).
- **Day-one hygiene that's painful to retrofit:** domain email authentication (SPF/DKIM/DMARC), sops/agenix secrets, and automated backups — set these up before launch, not after.
