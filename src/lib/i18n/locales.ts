// Supported locales. v1 ships Spanish-only content + UI, but the code is
// architected for German (a v2 data-entry task). Spanish is the default and the
// fallback for every lookup.
export type Locale = 'es' | 'de';

export const DEFAULT_LOCALE: Locale = 'es';
