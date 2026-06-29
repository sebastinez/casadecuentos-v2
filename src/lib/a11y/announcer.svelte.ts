// App-wide screen-reader announcer. A single polite live region in the root
// layout renders `message`; calling `announce()` updates it. A live region only
// speaks when its text content *changes*, so we clear then re-set on a tick —
// that way re-announcing identical text (e.g. adding the same book twice) still
// fires. Module-scoped `$state` makes the one region everywhere reactive.
let message = $state('');
let timer: ReturnType<typeof setTimeout> | undefined;

export const announcer = {
	get message(): string {
		return message;
	},
	announce(text: string) {
		message = '';
		clearTimeout(timer);
		timer = setTimeout(() => {
			message = text;
		}, 50);
	}
};
