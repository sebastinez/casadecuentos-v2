import { DEFAULT_LOCALE, type Locale } from './locales';
import { messages } from './messages';

// Resolve a UI message key for the given locale.
// Lookup order: active locale → Spanish fallback → the key itself (deterministic
// for missing keys, so the UI degrades to a visible marker rather than crashing).
// `locale` is threaded as a parameter even though v1 is always Spanish — that is
// the "architected for German" requirement; nothing here hardcodes 'es'.
export function t(key: string, locale: Locale = DEFAULT_LOCALE): string {
	const active = messages[locale];
	if (active && key in active) {
		return active[key];
	}

	const fallback = messages[DEFAULT_LOCALE];
	if (fallback && key in fallback) {
		return fallback[key];
	}

	return key;
}
