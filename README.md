# Casa de Cuentos

Online bookstore for a Spanish-speaking audience in Switzerland.
SvelteKit (SSR, `adapter-node`) as a BFF in front of PocketBase. The browser
talks **only** to SvelteKit; SvelteKit talks to PocketBase.

See `docs/PRD.md` for the product spec and `plans/casa-de-cuentos-v1.md` for the
phased implementation plan.

## Prerequisites

- Node 20+ and [pnpm](https://pnpm.io)
- A [PocketBase](https://pocketbase.io) binary (not committed)

## PocketBase (local dev)

The PocketBase binary and its runtime data (`pb_data/`) are git-ignored. The
schema and seed data live in `pb_migrations/` (committed), so a fresh instance is
fully reproducible.

```sh
# 1. Download the PocketBase binary into ./.bin (macOS arm64 shown; pick your platform)
mkdir -p .bin
curl -sL https://github.com/pocketbase/pocketbase/releases/download/v0.39.1/pocketbase_0.39.1_darwin_arm64.zip -o /tmp/pb.zip
unzip -o /tmp/pb.zip -d .bin pocketbase

# 2. Apply migrations (creates the catalog collections — books, genres,
#    publishers, book_languages — and seed records)
.bin/pocketbase migrate up --dir=pb_data --migrationsDir=pb_migrations

# 3. Create an admin (PocketBase admin UI at http://127.0.0.1:8090/_/)
.bin/pocketbase superuser upsert admin@example.com "<a-strong-password>" --dir=pb_data

# 4. Run it (--hooksDir loads the project pb_hooks/, e.g. the Phase 7 shipped-email
#    hook; without it PocketBase looks in the exe-relative .bin/pb_hooks and runs
#    nothing. PocketBase logs the loaded hook files at startup.)
.bin/pocketbase serve --dir=pb_data --migrationsDir=pb_migrations --hooksDir=pb_hooks --http=127.0.0.1:8090
```

### Fulfilment email (Phase 7)

Marking a `paid` order **shipped** with a tracking number in the admin fires a
`pb_hooks` hook (`pb_hooks/order_shipped_email.pb.js`) that emails the customer
their Swiss Post tracking link via Resend. The hook reads `RESEND_API_KEY` and
`MAIL_FROM` from the **OS environment via `$os.getenv`** — Vite's `.env` loading
reaches only the SvelteKit dev server, not PocketBase. To send for real, export
them in the shell that launches `.bin/pocketbase serve`:

```sh
export RESEND_API_KEY=re_… MAIL_FROM='Casa de Cuentos <pedidos@example.com>'
.bin/pocketbase serve --dir=pb_data --migrationsDir=pb_migrations --hooksDir=pb_hooks --http=127.0.0.1:8090
```

With either unset the hook logs `[mail:dev] would send …` instead of sending, so
local fulfilment runs without credentials. Real domain/key provisioning is a
Phase 12 deploy concern (systemd `EnvironmentFile`).

## SvelteKit app

```sh
cp .env.example .env   # POCKETBASE_URL defaults to http://127.0.0.1:8090
pnpm install
pnpm dev               # dev server at http://localhost:5173
```

For checkout (Phase 6a) set the additional `.env` keys: `POCKETBASE_ADMIN_EMAIL`
/ `POCKETBASE_ADMIN_PASSWORD` (the superuser the BFF authenticates with to write
orders — use the one created in step 3 above) and `STRIPE_SECRET_KEY` (a
test-mode `sk_test_…` key). `SHIPPING_RATE_CHF` is optional (flat rate, defaults
to 8).

`/` is the landing page (Phase 8): a hero carousel and featured promo banners
from the `banners` collection (`type` = `hero` | `featured`, with bilingual
text, image, CTA, sort, active flag, and an optional `start`/`end` schedule
window), plus a hand-curated featured-books strip from `featured_books` (a
book + `sort` + `active` join) in the owner-defined order. Both are managed in
the PocketBase admin; only active, in-window banners render (the schedule
window is applied in the BFF). Banners with no image fall back to a gradient.

`/libros` server-renders the seeded books from PocketBase, with faceted filters
(age band, genre, publisher, language), substring search over
title/author/illustrator, and sort (newest / price) — all encoded as URL query
params and resolved to PocketBase filter queries server-side (shareable,
back-button correct). `/libros/[slug]` is the product detail page (all
bibliographic fields, OG tags, disabled buy action when out of stock).

A search icon in the header opens a typo-tolerant fuzzy search (Fuse.js). It
lazily fetches a lightweight precomputed catalog index from `/api/catalogo`
(id, title, author, illustrator, slug, cover thumb) on first open and matches
**client-side**; the autocomplete dropdown links straight to `/libros/[slug]`.

Checkout (`POST /api/checkout`) takes the cart's book ids + quantities, reads
authoritative price + stock from PocketBase (browser-supplied prices are never
trusted), creates a `pending` order (cart snapshot + totals) and a hosted Stripe
Checkout session (Spanish, CHF, TWINT + cards, CH-only address, flat shipping),
then redirects to Stripe. The signature-verified webhook flips the order to
`paid` — that is Phase 6b; the `/pago/exito` redirect is never trusted for
fulfilment.

## Deployment (production)

Production runs on one Hetzner VPS with **NixOS** — PocketBase + SvelteKit +
Caddy as systemd services, secrets via sops-nix, automatic HTTPS, and Litestream
+ restic backups. All declarative config is in [`nix/`](nix); the step-by-step
runbook (provisioning, DNS, secrets, Stripe webhook, email auth, restore
verification) is [`docs/DEPLOY.md`](docs/DEPLOY.md).

PocketBase is served at `pb.<domain>` so book-cover/OG image URLs (minted from
its files endpoint) are publicly fetchable; on the box that hostname resolves to
loopback, so the BFF→PocketBase traffic never leaves the machine.

## Scripts

```sh
pnpm test     # unit tests (vitest)
pnpm check    # svelte-check (types)
pnpm lint     # prettier + eslint
pnpm format   # prettier --write
pnpm build    # production build (adapter-node)
```
