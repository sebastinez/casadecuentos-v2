import type { Action } from 'svelte/action';

// Moves a node to the end of `<body>` (or a given target) on mount, escaping any
// ancestor that establishes a containing block / stacking context for fixed
// positioning — e.g. the header's `backdrop-blur`, which otherwise traps a fixed
// overlay's z-index and sizes `inset-0` to the header instead of the viewport.
export const portal: Action<HTMLElement, HTMLElement | undefined> = (node, target) => {
	const dest = target ?? document.body;
	dest.appendChild(node);
	return {
		destroy() {
			node.parentNode?.removeChild(node);
		}
	};
};
