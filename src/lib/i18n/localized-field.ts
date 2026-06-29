import { DEFAULT_LOCALE, type Locale } from './locales';

// Read a localizable *content* field off a record, with Spanish fallback.
//
// Convention (symmetric suffixed sibling columns):
//   - Each locale lives in its own `<field>_<locale>` column, e.g. `description_es`,
//     `description_de`. There is no unsuffixed base column for localizable fields.
//   - The German column may be absent or empty (a content-entry task), in which case
//     we fall back to the Spanish (`DEFAULT_LOCALE`) column.
//
// Callers pass the *base* field name (`description`, `name`, `format`); the suffix is
// applied here. Bibliographic metadata (title/author/ISBN/…) is intrinsic, stays in
// an unsuffixed column, and never goes through this accessor.
//
// Generic over any object (typed records like `Book` or plain bags), so callers
// don't need an index signature; lookups are done through a local cast.
export function localizedField<T extends object>(
	record: T,
	field: string,
	locale: Locale = DEFAULT_LOCALE
): string {
	const rec = record as Record<string, unknown>;

	const value = rec[`${field}_${locale}`];
	if (typeof value === 'string' && value.trim() !== '') {
		return value;
	}

	const fallback = rec[`${field}_${DEFAULT_LOCALE}`];
	return typeof fallback === 'string' ? fallback : '';
}
