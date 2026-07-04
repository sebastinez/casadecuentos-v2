#!/usr/bin/env node
/**
 * Step 2 of the _es/_de backfill pipeline: fills in `translatedText` for every
 * entry produced by i18n-extract-missing.mjs, using the DeepL API
 * (https://developers.deepl.com/api-reference/translate).
 *
 * Dedupes identical (sourceLocale, targetLocale, sourceText) triples before
 * calling the API — `books.format` in particular has 495 rows but only ~32
 * distinct values, so this saves both quota and requests. Batches unique
 * strings per translation direction, respecting DeepL's request-size limits.
 * Entries whose text contains HTML tags are sent with tag_handling: "html" so
 * markup in `description` (editor) fields survives untouched.
 *
 * Usage:
 *   DEEPL_API_KEY=xxxx:fx \
 *   node scripts/i18n-translate-deepl.mjs [inFile] [outFile] [--dry-run] [--limit N]
 *
 * inFile defaults to scripts/i18n-missing.json, outFile to
 * scripts/i18n-translated.json (feed that into i18n-push-translations.mjs).
 */

import { readFileSync, writeFileSync } from 'node:fs';

const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--limit');
const inFile = positional[0] || 'scripts/i18n-missing.json';
const outFile = positional[1] || 'scripts/i18n-translated.json';

if (!DEEPL_API_KEY && !DRY_RUN) {
	console.error('Missing DEEPL_API_KEY env var.');
	process.exit(1);
}

// Free-tier keys end in ":fx" and live on a different host than paid keys.
const DEEPL_API_URL =
	process.env.DEEPL_API_URL ||
	(DEEPL_API_KEY?.endsWith(':fx') ? 'https://api-free.deepl.com/v2/translate' : 'https://api.deepl.com/v2/translate');

const DEEPL_LANG = { es: 'ES', de: 'DE' };

const hasHtmlTags = (s) => /<[a-z][^>]*>/i.test(s);

// Keep well under DeepL's 128 KiB request-body limit and the 50-texts-per-call
// guidance, so one oversized description can't blow up a batch.
const MAX_BATCH_ITEMS = 50;
const MAX_BATCH_CHARS = 100_000;

function makeBatches(texts) {
	const batches = [];
	let current = [];
	let currentChars = 0;
	for (const t of texts) {
		if (current.length >= MAX_BATCH_ITEMS || currentChars + t.length > MAX_BATCH_CHARS) {
			if (current.length) batches.push(current);
			current = [];
			currentChars = 0;
		}
		current.push(t);
		currentChars += t.length;
	}
	if (current.length) batches.push(current);
	return batches;
}

async function translateBatch(texts, sourceLang, targetLang, tagHandling) {
	const body = {
		text: texts,
		source_lang: sourceLang,
		target_lang: targetLang
	};
	if (tagHandling) body.tag_handling = 'html';

	for (let attempt = 1; attempt <= 5; attempt++) {
		const res = await fetch(DEEPL_API_URL, {
			method: 'POST',
			headers: {
				Authorization: `DeepL-Auth-Key ${DEEPL_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(body)
		});

		if (res.status === 429 || res.status >= 500) {
			const wait = attempt * 1000;
			console.warn(`  DeepL ${res.status}, retrying in ${wait}ms (attempt ${attempt}/5)...`);
			await new Promise((r) => setTimeout(r, wait));
			continue;
		}

		if (!res.ok) {
			const errText = await res.text();
			throw new Error(`DeepL API error ${res.status}: ${errText}`);
		}

		const json = await res.json();
		return json.translations.map((t) => t.text);
	}
	throw new Error('DeepL API: exhausted retries');
}

async function main() {
	const items = JSON.parse(readFileSync(inFile, 'utf-8')).slice(0, LIMIT === Infinity ? undefined : LIMIT);

	// Dedupe by (sourceLocale, targetLocale, sourceText, isHtml) -> translation.
	const uniqueKey = (i) => `${i.sourceLocale}|${i.targetLocale}|${hasHtmlTags(i.sourceText)}|${i.sourceText}`;
	const uniqueTexts = new Map(); // key -> { sourceLocale, targetLocale, isHtml, text, translation }
	for (const item of items) {
		const key = uniqueKey(item);
		if (!uniqueTexts.has(key)) {
			uniqueTexts.set(key, {
				sourceLocale: item.sourceLocale,
				targetLocale: item.targetLocale,
				isHtml: hasHtmlTags(item.sourceText),
				text: item.sourceText,
				translation: null
			});
		}
	}

	console.log(`${items.length} entries, ${uniqueTexts.size} unique string(s) to translate.`);

	// Group unique entries by (sourceLocale, targetLocale, isHtml) so each batch
	// shares source_lang/target_lang/tag_handling.
	const groups = new Map();
	for (const [key, entry] of uniqueTexts) {
		const groupKey = `${entry.sourceLocale}|${entry.targetLocale}|${entry.isHtml}`;
		if (!groups.has(groupKey)) groups.set(groupKey, []);
		groups.get(groupKey).push(key);
	}

	let totalChars = 0;
	let apiCalls = 0;

	for (const [groupKey, keys] of groups) {
		const [sourceLocale, targetLocale, isHtmlStr] = groupKey.split('|');
		const isHtml = isHtmlStr === 'true';
		const sourceLang = DEEPL_LANG[sourceLocale];
		const targetLang = DEEPL_LANG[targetLocale];

		const texts = keys.map((k) => uniqueTexts.get(k).text);
		const batches = makeBatches(texts);
		console.log(
			`${sourceLocale}->${targetLocale}${isHtml ? ' (html)' : ''}: ${texts.length} unique string(s) in ${batches.length} batch(es)`
		);

		let cursor = 0;
		for (const batch of batches) {
			totalChars += batch.reduce((a, t) => a + t.length, 0);
			apiCalls++;
			if (DRY_RUN) {
				console.log(`  [dry-run] would translate batch of ${batch.length} string(s)`);
				for (const t of batch) uniqueTexts.get(keys[cursor++]).translation = `[DRY-RUN] ${t}`;
				continue;
			}
			const translations = await translateBatch(batch, sourceLang, targetLang, isHtml);
			for (const translation of translations) {
				uniqueTexts.get(keys[cursor++]).translation = translation;
			}
		}
	}

	const output = items.map((item) => ({
		...item,
		translatedText: uniqueTexts.get(uniqueKey(item)).translation
	}));

	writeFileSync(outFile, JSON.stringify(output, null, 2));

	console.log(`API calls: ${apiCalls}, characters sent: ${totalChars}`);
	console.log(`Wrote ${outFile}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
