// The order lifecycle state machine: the *only* legal path is
// `pending → paid → shipped`. Backward steps, skips (`pending → shipped`), and
// self-loops (`paid → paid`) are illegal. Side-effect-free so the whole transition
// table is trivially unit-testable.

export type OrderStatus = 'pending' | 'paid' | 'shipped';

// Adjacency map: each state lists the states it may advance to (a terminal state
// has none). Forward-only with no self-transitions — that's what makes the webhook's
// idempotency latch work: a redelivered event finds the order already `paid`, and
// `paid → paid` is not allowed, so it's recognised as already-processed, not re-run.
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
	pending: ['paid'],
	paid: ['shipped'],
	shipped: []
};

// Legal-step predicate. Callers use it both to validate an intended transition and
// to detect an already-processed order (an illegal/self step means "nothing to do").
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
	return TRANSITIONS[from].includes(to);
}

// Thrown when code attempts an illegal lifecycle step; carries both ends so a
// log/caller can report exactly what was rejected.
export class IllegalTransitionError extends Error {
	constructor(
		public readonly from: OrderStatus,
		public readonly to: OrderStatus
	) {
		super(`Illegal order transition: ${from} → ${to}`);
		this.name = 'IllegalTransitionError';
	}
}

// Assert a transition is legal, throwing `IllegalTransitionError` otherwise. Use
// where an illegal step is a genuine fault (e.g. marking a non-`paid` order
// shipped). The webhook's dedupe path deliberately uses `canTransition` instead —
// there an already-processed order is expected, not exceptional.
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
	if (!canTransition(from, to)) {
		throw new IllegalTransitionError(from, to);
	}
}
