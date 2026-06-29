# Plan — German as a working second locale (es/de) with URL-prefix routing

> Branch: `feat/i18n-de-prefix-routing`
> Scope: **plumbing only.** No German UI strings (`messages.de` stays empty — owner task)
> and no German content data (owner fills `_de` columns in the PB admin).

## Decisions (locked with owner)

1. **URL prefixes cut both ways**: `/es/libros` (Spanish) and `/de/libros` (German).
   There is no clean unprefixed URL — `/` and `/libros` redirect to the active locale.
2. **Browser detection** picks the prefix for a first-time visitor (cookie → `Accept-Language` → `es`).
3. **Language switcher** flips the prefix and remembers the choice in a cookie.
4. **PocketBase content**: **symmetric** suffixed sibling columns `<field>_es` + `<field>_de`
   (not the old "base column = Spanish" convention). Localizable fields:
   - `books.description_es/_de`, `books.format_es/_de`
   - `events.title_es/_de`, `events.description_es/_de`
   - `banners.title_es/_de`, `banners.subtitle_es/_de`, `banners.cta_label_es/_de`
   - `genres.name_es/_de`, `book_languages.name_es/_de`
   - `publishers.name` stays single (proper nouns, not translated)
   - `age_band` labels stay in the message layer (`age.0-3` …), not PB
5. **`messages.de`** stays empty — a separate task. `t()` falls back to `es`.

## Routing mechanism

- **`src/hooks.ts` → `reroute`**: strip the `/es` or `/de` prefix so both map to the
  existing canonical route tree (no `[[lang]]` directory duplication).
- **`src/hooks.server.ts` → `handle`**: derive locale from `event.url.pathname`
  (cookie/Accept-Language only used for the _redirect_ of an unprefixed path), set
  `event.locals.locale`, and fill a `%lang%` placeholder in `app.html`.
  Unprefixed paths (`/`, `/libros`, …) → 301/302 redirect to `/{locale}{path}`.
- **Internal links must carry the prefix.** Add `localizeHref(path, locale)` and use it
  for every internal `<a href>` (nav, footer, cards, CTAs).

## Locale accessor change (symmetric)

`localizedField(record, 'description', locale)` → read `description_<locale>`,
fall back to `description_<DEFAULT_LOCALE>`. Call sites pass the **base** field name
unchanged, so only the accessor body changes — plus the raw (non-accessor) reads below.

Raw reads to route through `localizedField` after the column rename:

- `libros/+page.svelte` filter `<option>`: `g.name` (genres), `l.name` (book_languages).
  `p.name` (publishers) stays raw.
- `libros/[slug]/+page.svelte`: `expand.genre.name`, `expand.language.name`, `book.format`.
- Interfaces to update: `Book` (description→via accessor, format), `Taxon` (name), `EventRecord`,
  banner/content + video record shapes.

## Locale source in components

7 leaf components import `DEFAULT_LOCALE` directly and can't see layout data
(MobileNav, HeroCarousel, CartIcon, AddToCartButton, VideoCard, LiveInterviewBanner,
HeaderSearch). They read the active locale from `$app/state` `page.data.locale`
(set by `+layout.server.ts`), not via prop-drilling.

## Locale-at-emit (don't hardcode es)

- Stripe Checkout `locale`: pass active locale (`'de'` accepted).
- Emails (order-confirmation, rsvp-confirmation, contact): capture active locale at submit,
  store on the record, use when sending.
- `datetime.ts` event date formatting: thread locale (currency stays `de-CH`).

## Migration / data

New `pb_migrations/*.js` (applies on serve restart — see memory): add the `_es`/`_de`
columns, copy existing base-column data into `_es`, set `presentable` on `name_es` for
taxonomy relation pickers, then drop the now-unused base columns. Update
`scripts/import-shopify.mjs` to write `description_es`.

## Build order

1. Foundation: `locales.ts` helpers, `localized-field.ts`, `app.d.ts`, `app.html`,
   `hooks.ts`, `hooks.server.ts`, `+layout.server.ts`. Verify dev server compiles + redirects.
2. Links + switcher: `localizeHref`, layout nav/footer, switcher component.
3. Replace ~30 `DEFAULT_LOCALE` sites with `page.data.locale`.
4. PB migration + interfaces + raw-read rerouting + import script.
5. Locale-at-emit: Stripe + emails + datetime.
6. `i18n.spec.ts` for the symmetric accessor; `pnpm check` + tests.
