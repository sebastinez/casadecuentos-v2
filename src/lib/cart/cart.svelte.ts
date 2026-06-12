import { browser } from '$app/environment';
import {
	addItem,
	setItemQty,
	removeItem,
	cartCount,
	loadCart,
	saveCart,
	CART_STORAGE_KEY,
	type CartItem,
	type StoragePort
} from './cart';

// The reactive, app-wide cart. A single module-scoped `$state` array is the one
// source of truth the nav badge, product page, and cart page all read; every
// mutation goes through the pure core in `cart.ts` and is persisted to
// localStorage. Importing this module anywhere gives the same live cart.
//
// SSR-safe: on the server there is no `window`, so a no-op port is used and the
// cart renders empty. On the client the module initialises from localStorage at
// import time, so a return visit / reload rehydrates the saved cart. (The nav
// badge guards on mount to avoid a hydration mismatch between the empty server
// render and the populated client render.)
const storage: StoragePort = browser
	? window.localStorage
	: { getItem: () => null, setItem: () => {} };

let items = $state<CartItem[]>(browser ? loadCart(storage, CART_STORAGE_KEY) : []);

function persist() {
	if (browser) saveCart(storage, items, CART_STORAGE_KEY);
}

// Exposed as getters so consumers stay reactive across the module boundary
// (a plain exported value would capture a snapshot, not track changes).
export const cart = {
	get items(): CartItem[] {
		return items;
	},
	get count(): number {
		return cartCount(items);
	},
	add(id: string, qty = 1) {
		items = addItem(items, id, qty);
		persist();
	},
	setQty(id: string, qty: number) {
		items = setItemQty(items, id, qty);
		persist();
	},
	remove(id: string) {
		items = removeItem(items, id);
		persist();
	},
	clear() {
		items = [];
		persist();
	}
};
