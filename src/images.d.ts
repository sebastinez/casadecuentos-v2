// enhanced-img ships an ambient type only for the bare `*?enhanced` query. TS module
// wildcards allow a single `*`, so we match the exact width-pinned suffix we import
// with. Kept in a script-mode .d.ts (no top-level import/export) so the wildcard
// registers as a global ambient module. Keep in sync with the `?enhanced&w=...`
// query in quienes-somos/+page.svelte.
declare module '*?enhanced&w=480;960;1440' {
	const value: import('vite-imagetools').Picture;
	export default value;
}
