// The order lifecycle state machine. One pure module owning the *only* legal
// path an order may travel: `pending → paid → shipped`. Everything else — a
// backward step, a skip (`pending → shipped`), or a self-loop (`paid → paid`) —
// is illegal. Two consumers lean on it: the Phase 6b payment webhook (the
// `pending → paid` flip + its idempotency guard) and Phase 7 fulfilment
// (`paid → shipped`). Kept side-effect-free so the whole transition table is
// trivially unit-testable.

export type OrderStatus = 'pending' | 'paid' | 'shipped';

// The transition table as an adjacency map: each state lists the states it may
// advance to. A terminal/self state simply has no outgoing edges. Forward-only
// and linear — there is no path back, and no state may transition to itself
// (which is what makes the webhook's idempotency latch work: a redelivered
// event finds the order already `paid`, and `paid → paid` is *not* allowed, so
// the second delivery is recognised as already-processed rather than re-run).
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
	pending: ['paid'],
	paid: ['shipped'],
	shipped: []
};

// Is advancing `from → to` a legal lifecycle step? Pure predicate; callers use
// it both to validate an intended transition and to detect an already-processed
// order (an illegal/self transition means "nothing to do here").
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
	return TRANSITIONS[from].includes(to);
}

// Thrown when code attempts an illegal lifecycle step. Carries both ends so a
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

// Assert a transition is legal, throwing `IllegalTransitionError` otherwise.
// Use this where an illegal step is a genuine fault that must not silently pass
// (e.g. Phase 7 marking a non-`paid` order shipped). The webhook deliberately
// does *not* use this for its dedupe path — there an already-processed order is
// expected, not exceptional, so it checks `canTransition` and returns quietly.
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
	if (!canTransition(from, to)) {
		throw new IllegalTransitionError(from, to);
	}
}
