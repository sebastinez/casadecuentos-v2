// Supported locales. The store ships Spanish + German; Spanish is the default and
// the fallback for every lookup (UI messages and localized content fields).
export type Locale = 'es' | 'de';

export const LOCALES = ['es', 'de'] as const;

export const DEFAULT_LOCALE: Locale = 'es';

export function isLocale(value: string): value is Locale {
	return (LOCALES as readonly string[]).includes(value);
}

// URL prefixes cut both ways: `/es/libros` and `/de/libros`. The first path segment
// is the locale; everything after it is the canonical (unprefixed) route. Returns
// `null` when the path has no locale prefix (e.g. `/libros`, `/`), so `hooks.server`
// can redirect it to the detected locale.
export function localeFromPathname(pathname: string): Locale | null {
	const seg = pathname.split('/')[1];
	return seg && isLocale(seg) ? seg : null;
}

// Strip the leading locale prefix, returning the canonical path (always starts with
// `/`). `/es/libros` → `/libros`, `/de` → `/`, `/libros` → `/libros` (no-op).
export function stripLocale(pathname: string): string {
	const locale = localeFromPathname(pathname);
	if (!locale) return pathname;
	const rest = pathname.slice(locale.length + 1); // drop `/es`
	return rest === '' ? '/' : rest;
}

// Prefix a canonical app path with the active locale for use in `href`. Accepts paths
// that already carry a locale prefix (re-localizes them) and leaves external/anchor
// links untouched. `localizeHref('/libros', 'de')` → `/de/libros`.
export function localizeHref(path: string, locale: Locale): string {
	if (!path.startsWith('/')) return path; // external, mailto:, #anchor, etc.
	const canonical = stripLocale(path);
	return canonical === '/' ? `/${locale}` : `/${locale}${canonical}`;
}
