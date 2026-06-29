import { describe, it, expect } from 'vitest';
import { t } from './t';
import { localizedField } from './localized-field';

describe('t (UI message accessor)', () => {
	it('returns the requested locale string when present', () => {
		expect(t('nav.home', 'es')).toBe('Inicio');
	});

	it('returns the German string when the key is present in the de table', () => {
		expect(t('nav.home', 'de')).toBe('Start');
	});

	it('defaults to Spanish when no locale is given', () => {
		expect(t('nav.books')).toBe('Libros');
	});

	it('returns the key itself for an unknown key (deterministic missing-key handling)', () => {
		expect(t('does.not.exist')).toBe('does.not.exist');
		expect(t('does.not.exist', 'de')).toBe('does.not.exist');
	});
});

describe('localizedField (localized content accessor — symmetric _es/_de columns)', () => {
	const record = {
		description_es: 'Texto en español',
		description_de: 'Deutscher Text',
		// A field with only the Spanish column filled (German not yet entered).
		title_es: 'La pequeña oruga glotona'
	};

	it('returns the requested locale column when it is present', () => {
		expect(localizedField(record, 'description', 'de')).toBe('Deutscher Text');
		expect(localizedField(record, 'description', 'es')).toBe('Texto en español');
	});

	it('falls back to the Spanish column when the German column is missing', () => {
		expect(localizedField(record, 'title', 'de')).toBe('La pequeña oruga glotona');
	});

	it('falls back to the Spanish column when the German column is empty/whitespace', () => {
		const r = { empty_es: 'Solo español', empty_de: '   ' };
		expect(localizedField(r, 'empty', 'de')).toBe('Solo español');
	});

	it('defaults to Spanish (the default locale) when no locale is given', () => {
		expect(localizedField(record, 'description')).toBe('Texto en español');
	});

	it('returns an empty string when neither the localized nor the Spanish column exists', () => {
		expect(localizedField(record, 'missing', 'de')).toBe('');
		expect(localizedField(record, 'missing')).toBe('');
	});
});
