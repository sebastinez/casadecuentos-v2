import { DEFAULT_LOCALE, type Locale } from './locales';

// Read a localizable *content* field off a record, with Spanish fallback.
//
// Convention (painful to retrofit, so it is fixed here in Phase 1):
//   - Spanish lives in the unsuffixed base column, e.g. `description`.
//   - Other locales live in `<field>_<locale>`, e.g. `description_de`.
//   - Those suffixed columns are NOT pre-created (a v2 data-entry task), so they
//     may be absent or empty — in which case we fall back to the Spanish base.
//
// For `es` we always return the base column directly. Bibliographic metadata
// (title/author/ISBN/…) is intrinsic and never goes through this accessor.
// Generic over any object (typed records like `Book` or plain bags), so callers
// don't need an index signature; lookups are done through a local cast.
export function localizedField<T extends object>(
	record: T,
	field: string,
	locale: Locale = DEFAULT_LOCALE
): string {
	const rec = record as Record<string, unknown>;

	if (locale !== DEFAULT_LOCALE) {
		const value = rec[`${field}_${locale}`];
		if (typeof value === 'string' && value.trim() !== '') {
			return value;
		}
	}

	const base = rec[field];
	return typeof base === 'string' ? base : '';
}
