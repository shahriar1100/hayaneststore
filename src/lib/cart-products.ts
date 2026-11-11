"use client";

import { useSyncExternalStore } from "react";

export const CART_STORAGE_KEY = "noor-cart-products";
export type CartItem = { id: string; quantity: number; colour?: string };
type CartState = { items: readonly CartItem[]; ready: boolean; persistent: boolean };
const serverState: CartState = { items: [], ready: false, persistent: true };
let state = serverState;
let lastRaw: string | null | undefined;
const listeners = new Set<() => void>();

function parse(raw: string | null): CartItem[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return [];
    const itemsMap = new Map<string, CartItem>();
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const { id, quantity, colour } = item as {
        id?: unknown;
        quantity?: unknown;
        colour?: unknown;
      };
      if (
        typeof id === "string" &&
        id.trim().length > 0 &&
        typeof quantity === "number" &&
        Number.isInteger(quantity) &&
        quantity > 0
      ) {
        const cleanId = id.trim();
        const cleanColour =
          typeof colour === "string" && colour.trim().length > 0
            ? colour.trim()
            : undefined;
        itemsMap.set(cleanId, {
          id: cleanId,
          quantity: Math.min(quantity, 99),
          ...(cleanColour ? { colour: cleanColour } : {}),
        });
      }
    }
    return [...itemsMap.values()];
  } catch {
    return [];
  }
}

function snapshot(): CartState {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!state.ready || raw !== lastRaw) {
      lastRaw = raw;
      state = { items: parse(raw), ready: true, persistent: true };
    }
  } catch {
    state = { ...state, ready: true, persistent: false };
  }
  return state;
}

function write(items: readonly CartItem[]) {
  const next = { items, ready: true, persistent: true };
  try {
    const raw = JSON.stringify(items);
    localStorage.setItem(CART_STORAGE_KEY, raw);
    lastRaw = raw;
  } catch {
    next.persistent = false;
  }
  state = next;
  listeners.forEach((listener) => listener());
  return next;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === CART_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function addProductToCart(id: string, quantity = 1, colour?: string) {
  const current = snapshot();
  const cleanId = id.trim();
  if (!cleanId) return current;
  const amount = Math.max(1, Math.min(Math.floor(quantity), 99));
  const cleanColour = colour?.trim() || undefined;
  const match = current.items.find((item) => item.id === cleanId);
  const result = write(
    match
      ? current.items.map((item) =>
          item.id === cleanId
            ? {
                ...item,
                quantity: Math.min(item.quantity + amount, 99),
                ...(cleanColour ? { colour: cleanColour } : {}),
              }
            : item,
        )
      : [
          {
            id: cleanId,
            quantity: amount,
            ...(cleanColour ? { colour: cleanColour } : {}),
          },
          ...current.items,
        ],
  );

  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("noor:cart-product-added", {
        detail: { id: cleanId, quantity: amount, colour: cleanColour },
      }),
    );
  }

  return result;
}

export function setCartQuantity(id: string, quantity: number) {
  const current = snapshot();
  return write(
    quantity <= 0
      ? current.items.filter((item) => item.id !== id)
      : current.items.map((item) =>
          item.id === id ? { ...item, quantity: Math.min(Math.floor(quantity), 99) } : item,
        ),
  );
}

export function clearCartProducts() {
  return write([]);
}

export function useCartProducts() {
  return useSyncExternalStore(subscribe, snapshot, () => serverState);
}
