#!/usr/bin/env node
/**
 * Dependency & runtime freshness report.
 *
 * Prints two tables comparing what's installed against the latest published
 * upstream versions:
 *
 *   1. Runtime / binaries — PocketBase server binary (.bin/pocketbase), Node,
 *      Deno and pnpm. "Latest" comes from GitHub releases (PocketBase, Deno),
 *      nodejs.org (Node, newest release in the SAME major line) and the npm
 *      registry (pnpm).
 *
 *   2. npm dependencies — every entry in package.json {dependencies,
 *      devDependencies}. "Installed" is read from node_modules/<pkg>/package.json
 *      (the actually-resolved version, not the ^range), "Latest" from the npm
 *      registry's `latest` dist-tag. New deps are picked up automatically.
 *
 * Status is a semver comparison: ✅ current / patch|minor behind / ⚠️ major
 * behind / ahead of latest. Makes zero writes and needs no credentials; the
 * only requirement is network access to registry.npmjs.org, api.github.com and
 * nodejs.org.
 *
 * Usage:
 *   node scripts/check-deps.mjs
 *   node scripts/check-deps.mjs --json   # machine-readable dump instead of tables
 */

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const asJson = process.argv.includes('--json');
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// --- version helpers --------------------------------------------------------

const parseVer = (v) => {
	const m = String(v ?? '').replace(/^[v=\s]+/, '').match(/^(\d+)\.(\d+)\.(\d+)/);
	return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
};

// Returns 'current' | 'patch' | 'minor' | 'major' | 'ahead' | 'unknown',
// describing how far `installed` trails `latest`.
const diffKind = (installed, latest) => {
	const a = parseVer(installed);
	const b = parseVer(latest);
	if (!a || !b) return 'unknown';
	for (let i = 0; i < 3; i++) {
		if (a[i] < b[i]) return ['major', 'minor', 'patch'][i];
		if (a[i] > b[i]) return 'ahead';
	}
	return 'current';
};

const STATUS_LABEL = {
	current: '✅ current',
	patch: 'patch behind',
	minor: 'minor behind',
	major: '⚠️  major behind',
	ahead: 'ahead of latest',
	unknown: '? unknown'
};

// --- fetchers ---------------------------------------------------------------

const getJSON = async (url) => {
	const res = await fetch(url, { headers: { 'user-agent': 'casadecuentos-check-deps' } });
	if (!res.ok) throw new Error(`${res.status} ${url}`);
	return res.json();
};

const npmLatest = async (name) => {
	try {
		const d = await getJSON(`https://registry.npmjs.org/${name.replace('/', '%2F')}/latest`);
		return d.version ?? '?';
	} catch {
		return '?';
	}
};

const githubLatestTag = async (repo) => {
	try {
		const d = await getJSON(`https://api.github.com/repos/${repo}/releases/latest`);
		return (d.tag_name ?? '?').replace(/^v/, '');
	} catch {
		return '?';
	}
};

// Newest Node release in the same major line as `currentMajor` (comparing
// across majors, e.g. 24 -> 25, isn't an apples-to-apples "you're behind").
const nodeLatestInMajor = async (currentMajor) => {
	try {
		const list = await getJSON('https://nodejs.org/dist/index.json');
		const inMajor = list
			.map((r) => r.version.replace(/^v/, ''))
			.filter((v) => parseVer(v)?.[0] === currentMajor);
		return inMajor[0] ?? '?'; // index.json is newest-first
	} catch {
		return '?';
	}
};

// --- installed versions -----------------------------------------------------

const binVersion = (file, args, re) => {
	try {
		const out = execFileSync(file, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
		return out.match(re)?.[1] ?? '?';
	} catch {
		return null; // not installed / not found
	}
};

const installedNpm = (name) => {
	try {
		const pkg = JSON.parse(
			readFileSync(resolve(repoRoot, 'node_modules', name, 'package.json'), 'utf8')
		);
		return pkg.version ?? '?';
	} catch {
		return '(not installed)';
	}
};

// ---------------------------------------------------------------------------
// Runtime / binaries
// ---------------------------------------------------------------------------

const pbBinPath = resolve(repoRoot, '.bin', 'pocketbase');
const denoUsed = existsSync(resolve(repoRoot, 'deno.json')) || existsSync(resolve(repoRoot, 'deno.jsonc'));

const pbInstalled = existsSync(pbBinPath)
	? binVersion(pbBinPath, ['--version'], /version\s+([\d.]+)/)
	: null;
const nodeInstalled = process.versions.node;
const denoInstalled = binVersion('deno', ['--version'], /deno\s+([\d.]+)/);
const pnpmInstalled = binVersion('pnpm', ['--version'], /([\d.]+)/);

const [pbLatest, denoLatest, nodeLatest, pnpmLatest] = await Promise.all([
	githubLatestTag('pocketbase/pocketbase'),
	githubLatestTag('denoland/deno'),
	nodeLatestInMajor(parseVer(nodeInstalled)[0]),
	npmLatest('pnpm')
]);

const runtimeRows = [
	{
		component: 'PocketBase (server binary)',
		installed: pbInstalled ?? '(not found)',
		latest: pbLatest,
		note: existsSync(pbBinPath) ? './.bin/pocketbase update' : '.bin/pocketbase missing'
	},
	{ component: 'Node.js', installed: nodeInstalled, latest: nodeLatest, note: 'newest in v' + parseVer(nodeInstalled)[0] + ' line' },
	{
		component: 'Deno',
		installed: denoInstalled ?? '(not installed)',
		latest: denoLatest,
		note: denoUsed ? '' : 'not a project dep (no deno.json)'
	},
	{ component: 'pnpm', installed: pnpmInstalled ?? '?', latest: pnpmLatest, note: '' }
];

// ---------------------------------------------------------------------------
// npm dependencies
// ---------------------------------------------------------------------------

const pkg = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'));
const declared = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
const depNames = Object.keys(declared).sort((a, b) => a.localeCompare(b));

const npmRows = await Promise.all(
	depNames.map(async (name) => {
		const installed = installedNpm(name);
		const latest = await npmLatest(name);
		return {
			package: name,
			range: declared[name],
			installed,
			latest,
			kind: diffKind(installed, latest)
		};
	})
);

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

if (asJson) {
	console.log(
		JSON.stringify(
			{
				generatedAt: new Date().toISOString(),
				runtime: runtimeRows.map((r) => ({ ...r, kind: diffKind(r.installed, r.latest) })),
				npm: npmRows
			},
			null,
			2
		)
	);
	process.exit(0);
}

const renderTable = (headers, rows) => {
	const widths = headers.map((h, i) =>
		Math.max(h.length, ...rows.map((r) => [...r[i]].length))
	);
	// [...s].length counts code points so emoji don't over-pad.
	const pad = (s, w) => s + ' '.repeat(Math.max(0, w - [...s].length));
	const line = (cells) => '│ ' + cells.map((c, i) => pad(c, widths[i])).join(' │ ') + ' │';
	const sep = (l, m, r) =>
		l + widths.map((w) => '─'.repeat(w + 2)).join(m) + r;

	console.log(sep('┌', '┬', '┐'));
	console.log(line(headers));
	console.log(sep('├', '┼', '┤'));
	rows.forEach((r) => console.log(line(r)));
	console.log(sep('└', '┴', '┘'));
};

console.log(`\nDependency & runtime report — ${new Date().toISOString().slice(0, 10)}\n`);

console.log('Runtime / binaries');
renderTable(
	['Component', 'Installed', 'Latest', 'Status', 'Notes'],
	runtimeRows.map((r) => [
		r.component,
		r.installed,
		r.latest,
		STATUS_LABEL[diffKind(r.installed, r.latest)],
		r.note
	])
);

console.log('\nnpm dependencies');
renderTable(
	['Package', 'Range', 'Installed', 'Latest', 'Status'],
	npmRows.map((r) => [r.package, r.range, r.installed, r.latest, STATUS_LABEL[r.kind]])
);

const behind = npmRows.filter((r) => ['patch', 'minor', 'major'].includes(r.kind)).length;
const current = npmRows.filter((r) => r.kind === 'current').length;
console.log(`\n${current} up to date · ${behind} behind · ${npmRows.length} total npm deps\n`);
