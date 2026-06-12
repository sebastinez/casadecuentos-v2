import { describe, it, expect } from 'vitest';
import { t } from './t';
import { localizedField } from './localized-field';

describe('t (UI message accessor)', () => {
	it('returns the requested locale string when present', () => {
		expect(t('nav.home', 'es')).toBe('Inicio');
	});

	it('falls back to Spanish when the key is missing in the requested locale', () => {
		// `de` table is empty in v1, so this exercises the Spanish fallback path.
		expect(t('nav.home', 'de')).toBe('Inicio');
	});

	it('defaults to Spanish when no locale is given', () => {
		expect(t('nav.books')).toBe('Libros');
	});

	it('returns the key itself for an unknown key (deterministic missing-key handling)', () => {
		expect(t('does.not.exist')).toBe('does.not.exist');
		expect(t('does.not.exist', 'de')).toBe('does.not.exist');
	});
});

describe('localizedField (localized content accessor)', () => {
	const record = {
		description: 'Texto en español',
		description_de: 'Deutscher Text',
		empty_de: '   ',
		title: 'La pequeña oruga glotona'
	};

	it('returns the requested locale value when the suffixed column is present', () => {
		expect(localizedField(record, 'description', 'de')).toBe('Deutscher Text');
	});

	it('falls back to the Spanish base when the localized column is missing', () => {
		expect(localizedField(record, 'title', 'de')).toBe('La pequeña oruga glotona');
	});

	it('falls back to the Spanish base when the localized column is empty/whitespace', () => {
		const r = { empty: 'Base español', empty_de: '   ' };
		expect(localizedField(r, 'empty', 'de')).toBe('Base español');
	});

	it('returns the base column directly for Spanish (the default locale)', () => {
		expect(localizedField(record, 'description', 'es')).toBe('Texto en español');
		expect(localizedField(record, 'description')).toBe('Texto en español');
	});

	it('returns an empty string when neither localized nor base value exists', () => {
		expect(localizedField(record, 'missing', 'de')).toBe('');
		expect(localizedField(record, 'missing')).toBe('');
	});
});
