# Plan: Casa de Cuentos v1 (Online Bookstore)

> Source PRD: `docs/PRD.md` — SvelteKit (SSR) + PocketBase storefront, self-hosted on NixOS/Hetzner.

## Architectural decisions

Durable decisions that apply across all phases:

- **Stack**: SvelteKit SSR (`adapter-node`) as a **BFF** + PocketBase (data/auth/admin) + hosted Stripe Checkout + Resend (EU). The browser talks **only** to SvelteKit; SvelteKit talks to PocketBase and Stripe.
- **Routes** (no locale URL prefix in v1 — URLs stay clean):
  - `/` (landing), `/libros` (listing), `/libros/[slug]` (detail)
  - `/eventos` (listing), `/eventos/[slug]` (detail)
  - `/nosotros`, `/contacto`, policy pages (privacy/terms/shipping-returns)
  - Stripe checkout success/cancel return routes + a signature-verified webhook endpoint
- **PocketBase collections**: `books`, `genres`, `publishers`, `book_languages`, `age_band` (enum on `books`), `featured_books` (curated join), `banners`, `events`, `rsvps`, `orders`, `contact_messages`.
- **Order lifecycle**: `pending → paid → shipped`. A `pending` order (cart snapshot + Stripe session id) is created before redirect; the **signature-verified `checkout.session.completed` webhook is the only source of truth** that flips to `paid`. The success redirect is never trusted.
- **Price integrity**: client sends **only book IDs + quantities**; the server reads authoritative price and stock from PocketBase. Browser-supplied prices are never trusted.
- **Cart**: localStorage (book IDs + quantities only, never prices), re-validated server-side at checkout.
- **i18n**: all UI strings through an i18n message layer; localizable content through a **localized-field accessor with Spanish fallback**. Built in Phase 1; v1 ships Spanish-only, German is a v2 data-entry task. No `*_de` columns pre-created.
- **Admin = PocketBase admin** (no custom admin UI in v1). Owner stories 40, 41, 44, 45, 48 are satisfied by PocketBase admin — no phase builds a custom admin.
- **Tax/legal**: not VAT-registered, books-only → no VAT subsystem, no tax line. Prices are plain tax-inclusive CHF.
- **Tests** are carried per-slice using the PRD's module→test mapping (cart, search index, order builder/price-integrity, order state machine, payment webhook/fulfillment, i18n accessor). Establish the port-injection + mocked-transport pattern in the first slices that need it.
- **Deploy timing**: all ops (NixOS/Caddy/secrets/backups/email-auth) live in Phase 12. Local webhook development uses `stripe listen --forward-to` so no deploy spine is needed earlier.

---

## Phase 1: Walking skeleton

**User stories**: 3, 35 (partial); i18n accessor (PRD testing module 6)

### What to build

The thinnest end-to-end spine: a SvelteKit SSR app that reads real `books` records from PocketBase and renders them at `/libros`. Establishes the BFF boundary (browser → SvelteKit → PocketBase → render), the i18n message layer, and the localized-field accessor with Spanish fallback. Minimal global chrome (sticky nav + footer shells) so later phases have a place to hang things. Seed a couple of book records in PocketBase to render against.

### Acceptance criteria

- [ ] SvelteKit SSR app runs with `adapter-node`; browser never calls PocketBase directly.
- [ ] `books` collection exists in PocketBase with a few seed records (books are CRUD-manageable in PocketBase admin).
- [ ] `/libros` server-renders the seeded books from PocketBase.
- [ ] i18n message layer resolves `t(key)` and handles missing keys; localized-field accessor returns requested locale when present and **falls back to Spanish** when missing.
- [ ] Unit test for the i18n accessor passes (locale-present, Spanish-fallback, missing-key).
- [ ] Sticky top nav (Inicio · Libros · Eventos · Nosotros · Contacto) and a footer render on every page (content can be placeholder).

---

## Phase 2: Product detail + catalog model

**User stories**: 11, 12, 13, 40, 41

### What to build

The full catalog data model and the product detail page. Promote taxonomy to relation collections (`genres`, `publishers`, `book_languages`) and add the `age_band` enum, plus all intrinsic bibliographic fields and the store's localizable `description` blurb. Build `/libros/[slug]` showing every field, with clean SEO-friendly URLs and OG tags. Out-of-stock books render as unavailable with a disabled buy action.

### Acceptance criteria

- [ ] `genres`, `publishers`, `book_languages` exist as relation collections; `books` relates to them; `age_band` is a structured enum (`0-3`, `3-6`, `6-9`, `9-12`, `12+`).
- [ ] `books` carries: `title`, `author`, `illustrator`, `ISBN`, `language` (relation), `format`, `page_count`, `book_size`, `publisher` (relation), `publication_year`, `price` (CHF), `stock` (int), `cover` (+ optional gallery), `age_band`, `genre` (relation), `slug`, localizable `description`.
- [ ] `/libros/[slug]` renders cover, title, author, illustrator, description, publisher, publication year, language, format, page count, book size, ISBN, and price (CHF).
- [ ] Page emits correct OG tags and a clean canonical URL (shareable on WhatsApp/Instagram, indexable).
- [ ] Out-of-stock books show as unavailable with a disabled buy action.
- [ ] Taxonomy and books are renameable/manageable in PocketBase admin without code changes.

---

## Phase 3: Listing filters + search

**User stories**: 4, 5, 6, 7, 8, 9

### What to build

Faceted filtering and substring search on `/libros`, all expressed as URL query params translated to PocketBase filter queries. Filters: age band, genre, publisher, book language. Server-side substring search over title/author/illustrator. Sort by newest and price. Combined filters are reflected in the URL so views are shareable, bookmarkable, and back-button correct.

### Acceptance criteria

- [ ] Listing filters by age band, genre, publisher, and book language; filters combine.
- [ ] Active filters and sort are encoded in URL query params; reloading or sharing the URL reproduces the view; back button works.
- [ ] Server-side substring search over title/author/illustrator narrows the listing.
- [ ] Sort by newest and by price work.
- [ ] Filtering/sorting/search resolve to PocketBase filter queries server-side (no client-only filtering of a full dump).

---

## Phase 4: Header fuzzy search

**User stories**: 10, 36

### What to build

A typo-tolerant header search. A lightweight precomputed catalog index (id, title, author, illustrator, slug, cover) drives a client-side Fuse.js fuzzy match with an autocomplete dropdown that links straight to the product detail page. A search icon in the top-right opens it from any page.

### Acceptance criteria

- [ ] Search icon in the top-right opens the fuzzy search from any page.
- [ ] Autocomplete dropdown returns typo-tolerant matches and links to `/libros/[slug]`.
- [ ] Index is precomputed/lightweight (id, title, author, illustrator, slug, cover); matching is client-side.
- [ ] Unit tests for the search index pass: exact hits, typo tolerance, ranking order, empty/no-match, field coverage (title/author/illustrator).

---

## Phase 5: Cart

**User stories**: 14, 15, 35

### What to build

A localStorage-backed cart holding only book IDs + quantities. Add books, adjust quantities, clear. Cart persists across reload and return visits on the same device, rehydrated on load. A live item count shows in the nav cart icon. Cart logic sits behind an injected storage port so it is testable without touching real localStorage.

### Acceptance criteria

- [ ] Add to cart, adjust quantity, remove, and clear all work.
- [ ] Cart persists across reload / return visit on the same device (rehydrated on load).
- [ ] Cart stores only book IDs + quantities (never prices).
- [ ] Nav cart icon shows a live item count.
- [ ] Unit tests for the cart pass via an injected storage port: add/remove/update-qty/clear, persistence round-trip, quantity edge cases (behavior, not localStorage internals).

---

## Phase 6a: Checkout initiation

**User stories**: 16, 17, 18, 19, 20, 21

### What to build

The security-critical entry to payment. On checkout the server takes the cart's book IDs + quantities, reads authoritative price and stock from PocketBase, builds Stripe Checkout line items plus a flat-rate shipping option, creates a `pending` order (cart snapshot of titles/prices/quantities + Stripe session id), and redirects to hosted Stripe Checkout. Checkout is in Spanish, CHF, with TWINT + cards (+ Apple/Google Pay where available), shipping address collection restricted to CH. Browser-supplied prices are rejected.

### Acceptance criteria

- [ ] `orders` collection exists with status (`pending`/`paid`/`shipped`), unique incremental human-readable order number, cart snapshot, totals, shipping address, Stripe session/event ids, carrier, tracking number.
- [ ] Server builds Stripe line items from PocketBase-authoritative price/stock; a `pending` order with cart snapshot + session id is created before redirect.
- [ ] Stripe Checkout opens in Spanish (`locale: es`), CHF, with TWINT + cards; address collection restricted to `CH`; flat-rate shipping applied as a Stripe `shipping_option`.
- [ ] Stock is checked at session creation; out-of-stock and invalid-id paths error correctly.
- [ ] Unit tests for the order builder / price-integrity pass: correct line items + flat shipping, **rejects browser-supplied prices**, out-of-stock and invalid-id error paths.

---

## Phase 6b: Payment fulfillment

**User stories**: 22

### What to build

The webhook that is the sole source of truth for payment. A signature-verified `checkout.session.completed` handler flips the order `pending → paid`, decrements stock, and triggers the Spanish order-confirmation email. It is idempotent (dedupe on the Stripe event/session id) so redelivery marks paid once and decrements stock once. Includes the order state machine and the mail module behind a swappable transport interface. The success redirect is never trusted for fulfillment.

### Acceptance criteria

- [ ] Webhook verifies the Stripe signature; invalid signatures are rejected.
- [ ] On valid `checkout.session.completed`: order flips `pending → paid`, stock decrements, confirmation email is sent.
- [ ] Idempotent: a redelivered event marks paid and decrements stock exactly once.
- [ ] Order state machine allows `pending→paid→shipped` and rejects illegal transitions.
- [ ] Mail module sits behind a swappable transport interface; order-confirmation template is Spanish (bilingual-ready).
- [ ] Unit tests pass for the webhook/fulfillment (signature valid/invalid, idempotency, state transition, confirmation-email trigger with mocked Stripe + mocked stock/mail ports) and the order state machine (legal/illegal transitions).

---

## Phase 7: Shipped fulfillment

**User stories**: 23, 45, 46

### What to build

One-step owner fulfillment. The owner views paid orders (cart snapshot + shipping address) in PocketBase admin and marks an order shipped with a Swiss Post tracking number. A `pb_hooks` `onRecordUpdate` hook POSTs to Resend to email the customer their tracking link. This runs in PocketBase's Goja runtime as a parallel minimal Resend POST.

### Acceptance criteria

- [ ] Owner can see paid orders with cart snapshot and shipping address in PocketBase admin.
- [ ] Marking an order shipped + entering a Swiss Post tracking number is a single admin action.
- [ ] A `pb_hooks` hook fires on the shipped transition and sends the Spanish "shipped" email with a Swiss Post tracking link.
- [ ] Hook verified via integration/manual check (not in the SvelteKit unit suite).

---

## Phase 8: Landing page

**User stories**: 1, 2, 42, 43

### What to build

The storefront landing page: a hero carousel, featured promo banners, and a hand-curated featured-books strip in a deliberate order. Add `banners` (type `hero`|`featured`, localized title/subtitle, image, CTA label+link, sort, active, optional start/end schedule window) and `featured_books` (book relation + explicit sort + active). Banners and curation are managed in PocketBase admin.

### Acceptance criteria

- [ ] `/` renders a hero carousel and featured promo banners from the `banners` collection.
- [ ] `/` renders a curated featured-books strip from `featured_books` in the owner-defined sort order.
- [ ] `banners` supports type, bilingual text, image, CTA label+link (to a filtered listing / book / event), sort, active flag, and optional schedule window; only active + in-window banners show.
- [ ] Featured order and banners are manageable in PocketBase admin.

---

## Phase 9: Events + RSVP + maps

**User stories**: 24, 25, 26, 27, 28, 29, 30, 44

### What to build

Free community events end-to-end. `/eventos` lists upcoming events with past events auto-hidden by date. `/eventos/[slug]` shows localized title/description, date, time (Europe/Zurich, DST-aware), venue address, and a Leaflet + OpenStreetMap pin from lat/lng. An RSVP form (name, family_name, email, phone) creates an `rsvps` record and sends a Spanish confirmation email. Owner views RSVPs in PocketBase admin. Event pages carry OG tags.

### Acceptance criteria

- [ ] `events` and `rsvps` collections exist; events carry localized title/description, date, time, venue_address, latitude, longitude, slug.
- [ ] `/eventos` shows upcoming events only; past events auto-hidden by date filter.
- [ ] `/eventos/[slug]` shows title, description, date, and time rendered in Europe/Zurich (DST-aware), with a Leaflet/OSM map pin.
- [ ] RSVP form (name, family_name, email, phone) creates an `rsvps` record and sends a Spanish RSVP confirmation email.
- [ ] Event detail pages emit OG tags; owner can view RSVPs in PocketBase admin. No capacity/waitlist.

---

## Phase 10: Content pages + contact

**User stories**: 31, 32, 33, 34, 47

### What to build

Static content and the contact channel. Hardcoded Spanish About, privacy, terms, and shipping/returns pages (privacy names real processors: Stripe, Resend, Hetzner, PocketBase; shipping/returns honors Swiss warranty for defective/wrong items, no change-of-mind returns). A contact form (name, email, subject, message) with a honeypot + server-side rate limit that both stores a `contact_messages` record and emails the owner via Resend. Contact page shows business address, email, and Instagram.

### Acceptance criteria

- [ ] `/nosotros` and hardcoded Spanish privacy, terms, and shipping/returns pages exist; privacy names Stripe, Resend, Hetzner, PocketBase; returns policy honors warranty for defective/wrong items.
- [ ] `/contacto` form (name, email, subject, message) submits with a honeypot + server-side rate limit.
- [ ] On submit, a `contact_messages` record is stored **and** an email is sent to the owner via Resend (stored copy is reliability insurance).
- [ ] Contact page displays business address, email, and Instagram (not a POS).
- [ ] Footer links to the policy pages; owner can read contact messages in PocketBase admin.

---

## Phase 11: Mobile chrome

**User stories**: 37, 38, 39

### What to build

The responsive navigation. On mobile the top menu collapses into a hamburger that opens a left-side drawer fading/sliding in over a dimmed backdrop. The drawer is fully accessible. The footer (already present) is confirmed on every page.

### Acceptance criteria

- [ ] On mobile the nav collapses to a hamburger opening a left-side drawer over a dimmed backdrop with fade/slide animation.
- [ ] Drawer is accessible: focus trapped, closeable via Esc and backdrop, focus returned to the toggle, background scroll locked.
- [ ] Animation suppressed under `prefers-reduced-motion`.
- [ ] Footer with policy links, contact info, and copyright renders on every page.

---

## Phase 12: Ops / launch

**User stories**: 48, 49, 50

### What to build

Reproducible, cheap, durable hosting. One Hetzner VPS running NixOS with declarative config: PocketBase + SvelteKit as systemd services behind Caddy (automatic HTTPS). Secrets via sops-nix or agenix (Stripe secret key, Stripe webhook signing secret, Resend API key) injected via `EnvironmentFile`/`LoadCredential` — never in the world-readable Nix store. Automated backups (Litestream or scheduled PocketBase backup-to-S3) plus periodic image-dir snapshots. Domain email authentication (SPF + DKIM + DMARC) from a dedicated sending subdomain. Stable public HTTPS URL for the Stripe webhook in production.

### Acceptance criteria

- [ ] NixOS declarative config stands up PocketBase + SvelteKit + Caddy as systemd services on one Hetzner VPS; domain A/AAAA → VPS; automatic HTTPS.
- [ ] Secrets managed via sops-nix/agenix and injected at runtime; never present in `/nix/store`.
- [ ] Stripe webhook reachable at a stable public HTTPS URL in production.
- [ ] Automated DB backups (Litestream or PB backup-to-S3) + periodic image-dir snapshots configured and verified to restore.
- [ ] Sending domain authenticated with SPF + DKIM + DMARC from a dedicated subdomain; test email passes auth checks.
- [ ] Owner operates the whole business (catalog, featured, banners, events, RSVPs, contact messages, order fulfillment) from PocketBase admin.
