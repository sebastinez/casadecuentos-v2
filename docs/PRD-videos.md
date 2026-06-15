# PRD — Videos page (`/videos`) + live-interview banner

> Status: ready-for-agent
> Stack: SvelteKit (SSR, `adapter-node`) + PocketBase, as per the v1 PRD.
> Scope: a new public page listing the owner's YouTube videos as link-out cards, plus an optional, schedulable banner announcing the next live interview.

---

## Problem Statement

The owner runs a YouTube channel (`casadecuentos-ch`) alongside the bookstore — book readings, author interviews, and occasional **live** interviews — but the storefront gives visitors no way to discover that content. From the owner's perspective:

- "I want my own page on the site that shows all my YouTube videos, so visitors can find and watch them."
- "I want to keep people on YouTube to actually watch — the site should point them there, not host a heavy embedded player."
- "When I have a live interview coming up, I want to put a banner at the top of that page announcing it, and have it disappear on its own once it's over."
- "I want to manage all of this from the same PocketBase admin I already use for books, events, and banners — no external API keys or accounts."

From the customer's perspective (a Spanish-speaking parent/reader in Switzerland):

- "I want to browse Casa de Cuentos' videos and jump to the one I want on YouTube."
- "I want to know when there's a live interview I can watch."

## Solution

A new server-rendered `/videos` route, surfaced in the primary nav under the label **"Entrevistas"**. The owner curates a new **`videos`** PocketBase collection by hand — one record per video holding the bare YouTube `video_id`, a `title`, a `description`, a `published` date, and an `active` toggle. The BFF reads the active videos (newest `published` first) and renders them as **link-out cards** — thumbnail (hotlinked from YouTube via the video ID), title, date, and short description — each opening the video on YouTube in a new tab. No `<iframe>` embed and no YouTube Data API: the owner provides everything manually, consistent with how books, events, and banners are already managed.

The "next live interview" announcement reuses the existing **`banners`** collection with a new placement `type: 'live_interview'`. The owner fills in the banner copy + a YouTube CTA link, flips `active`, and optionally sets the `start`/`end` **schedule window** so the banner auto-appears and auto-expires around the broadcast. The `/videos` page shows a single such banner at the top (the active, in-window one with the earliest `start`), rendered by a dedicated component — not the landing-page `HeroCarousel`, which assumes internal, same-tab links.

v1 is **Spanish-only** but **architected for German**: `title`/`description`/banner copy are unsuffixed localized base columns (read through `localizedField`), and all UI strings are new `t()` keys, so German is a later data-entry task, not a rewrite.

## User Stories

**Discovering the page**

1. As a customer, I want a "Entrevistas" link in the primary nav (desktop and mobile), so that I can find the videos page.
2. As a customer, I want the videos page at a clean `/videos` URL, so that it's shareable and SEO-friendly.
3. As a customer, I want the page to have a localized title and meta description, so that it's findable and labeled correctly.

**Browsing videos**

4. As a customer, I want to see all of Casa de Cuentos' published videos as a grid of cards, so that I can browse them at a glance.
5. As a customer, I want the newest video first, so that recent content is surfaced.
6. As a customer, I want each card to show a thumbnail with a play-icon overlay, so that I recognize it as a video.
7. As a customer, I want each card to show the video's title (capped to keep cards even), so that I know what it is.
8. As a customer, I want each card to show the publication date, so that I know how recent it is.
9. As a customer, I want each card to show a short description, so that I get context before clicking.
10. As a customer, I want the whole card to be clickable, so that it's easy to tap on mobile.
11. As a customer, I want clicking a card to open the video on YouTube in a new tab, so that I keep the store open behind me and watch on the platform.
12. As a customer, when there are no videos, I want a friendly "no videos yet" message, so that the page never looks broken.

**Live-interview banner**

13. As a customer, I want a prominent banner at the top of the videos page when a live interview is scheduled, so that I don't miss it.
14. As a customer, I want the banner to show the interview info (title/subtitle) and a call-to-action, so that I know what it is and how to watch.
15. As a customer, I want the banner's CTA to open the live interview on YouTube in a new tab, so that I can go watch it.
16. As a customer, I want the banner to be absent when no interview is scheduled, so that the page isn't cluttered with empty boxes.

**Owner management (PocketBase admin)**

17. As the owner, I want to add a video by pasting just its YouTube ID plus a title, description, and date, so that data entry is quick.
18. As the owner, I want new videos to default to hidden (`active = false`), so that half-entered records never show publicly until I publish them.
19. As the owner, I want to toggle a video's visibility without deleting it, so that I can hide/show content easily.
20. As the owner, I want thumbnails generated automatically from the video ID, so that I never upload images for videos.
21. As the owner, I want to announce a live interview by creating a `live_interview` banner with copy and a YouTube link, so that I reuse the admin workflow I already know.
22. As the owner, I want to set a start/end window on the interview banner, so that it appears and disappears automatically without me logging back in.
23. As the owner, I want only one interview banner shown even if I have several queued, so that the page shows the most imminent one (earliest `start`).

## Implementation Decisions

### Data model

- **New `videos` collection.** Public `listRule`/`viewRule` (empty = public read), `create/update/deleteRule = null` (superuser-only writes) — same posture as `books`/`banners`/`events`. Fields:
  - `video_id` — text, **required**. The bare YouTube ID only (e.g. `dQw4w9WgXcQ`); no full URLs, to keep parsing trivial.
  - `title` — text, required, `presentable: true`. Localizable base column (Spanish in v1; `_de` is a v2 data task).
  - `description` — text. Localizable base column.
  - `published` — date, **required** (drives ordering; an empty value would sort unpredictably).
  - `active` — bool, **default `false`**.
  - `created` / `updated` — autodate.
- **Extend `banners.type`** select to add a third value `live_interview` (alongside `hero`, `featured`). The `image` and `sort` fields are unused for this type — note it in a comment. The interview content maps onto existing fields: `title`/`subtitle` = interview info, `cta_label`/`cta_link` = the watch CTA. For `live_interview`, `cta_link` holds an **absolute YouTube URL** (the existing types treat it as a relative path).

### BFF reads & pure modules

- **YouTube derivation module (pure, unit-tested).** Two pure functions mapping a `video_id` to its `watchUrl` (`https://www.youtube.com/watch?v=<id>`) and its `thumbnailUrl` (`https://img.youtube.com/vi/<id>/hqdefault.jpg`). `hqdefault` is chosen deliberately: it always exists for every video (unlike `maxresdefault`, which silently returns a gray placeholder for SD/older uploads), so there is no broken-image / fallback logic.
- **Next-interview selector (pure, unit-tested).** Given a list of active, in-window `live_interview` banners, return the single one with the earliest `start` (or none). Encodes the tie-break rule in isolation.
- **Videos read (thin wrapper, integration-tested only).** `listVideos(pb)`: filter `active = true`, sort `published` descending, return the BFF shape with `watchUrl`/`thumbnailUrl` attached. Mirrors `listUpcomingEvents`/`listBanners`; no `fields` projection so future `_de` columns flow through for `localizedField`.
- **Reuse `listBanners`.** Call the existing `content.ts` helper with `'live_interview'`; it already filters by `type` + `active` and applies the in-window check. Feed its result to the next-interview selector. No change to its internal logic.

### Route & presentation

- **`/videos` route.** `+page.server.ts` loads `{ videos, liveInterview }` by composing `listVideos` and the selector over `listBanners('live_interview')`. `+page.svelte` renders the banner (if present) then the grid.
- **`VideoCard` component.** Whole-card `<a>` to `watchUrl` with `target="_blank" rel="noopener noreferrer"`; 16:9 thumbnail box (crops `hqdefault`) with a play-icon overlay; title clamped to ~2 lines; localized `published` date via the existing datetime helper; description clamped to ~2 lines.
- **`LiveInterviewBanner` component** — new, separate from `HeroCarousel`. CTA links to the absolute `cta_link` YouTube URL, `target="_blank" rel="noopener noreferrer"`.
- **Grid layout** mirrors `/eventos` (`grid-cols-1 sm:grid-cols-2`, extended to `lg:grid-cols-3` since video thumbnails are smaller). No pagination in v1 — the full active list renders on one page (owner-curated, can add pagination later if it grows long).
- **Empty states:** localized message when there are zero active videos; the banner region renders nothing when no interview is active.

### Nav & i18n

- Add `/videos` to the shared `nav` array used by both desktop nav and the mobile drawer, with label from a new `t('nav.videos')` key resolving to **"Entrevistas"**. New `t()` keys also for the page heading, meta title/description, and empty-state text.

### Metadata

- Minimal, matching `/eventos`: a localized `<title>` and `<meta name="description">`. No Open Graph / per-video structured data in this phase (OG is a separate, origin-dependent concern per the v1 PRD).

### Seed migration

- Seed a couple of `videos` records using **real `casadecuentos-ch` video IDs** (thumbnails are hotlinked, so placeholder IDs would render broken images) and **one `active` `live_interview` banner** with `start` just before now, so both the card grid and the banner path are verifiable on first boot. (Reminder: JS migrations apply only on `serve` restart.)

## Testing Decisions

- **Philosophy (matches the repo):** test external behavior, not implementation details. Pure, bug-prone logic gets isolated unit tests; thin PocketBase read-wrappers are integration-tested, not unit-tested (the same split as `$lib/datetime` vs `listUpcomingEvents`).
- **Unit-tested modules:**
  - YouTube derivation — assert `watchUrl` and `thumbnailUrl` for given IDs (and that `hqdefault` is used, not `maxresdefault`).
  - Next-interview selector — given several active in-window banners, the earliest-`start` one wins; empty input yields none; single input passes through.
- **Not unit-tested:** `listVideos` (thin PB read, consistent with `events.ts`/`content.ts`); the route load; the `VideoCard` / `LiveInterviewBanner` components.
- **Prior art:** `$lib/datetime.spec.ts`, `$lib/cart/cart.spec.ts`, `$lib/search/catalog-index.spec.ts`, `$lib/i18n/i18n.spec.ts` for the pure-module unit-test style; `$lib/server/events.ts` and `$lib/server/content.ts` as the read-wrapper precedent.

## Out of Scope

- The YouTube Data API and any automatic sync of the channel's back-catalog. The owner maintains the `videos` list by hand; "all videos" means "all videos the owner has added."
- Embedded/iframe video playback. Cards link out to YouTube only.
- High-resolution (`maxresdefault`) thumbnails and any fallback logic.
- Server-side proxying/caching of thumbnails (see Further Notes — accepted privacy tradeoff for v1).
- Manual reordering of videos (no `sort` field); ordering is purely by `published` date.
- Pagination of the video grid.
- German (`_de`) content and Open Graph tags for the page — deferred to the existing v2 / OG phases.
- Making the live-interview banner site-wide; v1 shows it only on `/videos`. (Moving it into `+layout.svelte` later is a small change.)

## Further Notes

- **Thumbnail hotlinking — accepted tradeoff.** Cards hotlink `img.youtube.com/vi/<id>/hqdefault.jpg`, which sends each visitor's IP to Google on page load, before any consent. This is a conscious v1 decision: it is far lighter than a full YouTube embed (no tracking cookies, no heavy player JS), and server-side thumbnail proxying can be added later if the privacy page requires it.
- **Banner reuse is verified safe.** `listBanners` filters by `type` in PocketBase (`type = {:type} && active = true`), so a `live_interview` record cannot leak into the landing page's `hero`/`featured` carousel reads.
- The nav label ("Entrevistas") intentionally differs from the route slug (`/videos`) — an editorial choice; the page holds all channel videos, not only interviews.
