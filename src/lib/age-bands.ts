// The age bands offered as a listing facet and stored on `books.age_band`.
// Mirrors the SelectField values in the Phase 2 migration. Labels come from the
// i18n `age.*` keys so the enum stays language-neutral. Lives outside
// `$lib/server` so both the server catalog wrapper and client components can
// import it.
export const AGE_BANDS = ['0-3', '3-6', '6-9', '9-12', '12+'] as const;
