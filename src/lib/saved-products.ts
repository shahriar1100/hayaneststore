"use client";

import { useSyncExternalStore } from "react";

export const SAVED_STORAGE_KEY = "noor-saved-products";
type SavedState = { ids: readonly string[]; ready: boolean; persistent: boolean };
const serverState: SavedState = { ids: [], ready: false, persistent: true };
let state = serverState;
let lastRaw: string | null | undefined;
let visitOnly = false;
const listeners = new Set<() => void>();

function parseIDs(raw: string | null): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (id): id is string => typeof id === "string" && id.trim().length > 0,
            ),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}

function getSnapshot(): SavedState {
  if (visitOnly) return state;
  try {
    const raw = localStorage.getItem(SAVED_STORAGE_KEY);
    if (!state.ready || raw !== lastRaw) {
      lastRaw = raw;
      state = { ids: parseIDs(raw), ready: true, persistent: true };
    }
  } catch {
    visitOnly = true;
    state = { ...state, ready: true, persistent: false };
  }
  return state;
}

function notify() {
  listeners.forEach((listener) => listener());
}
function onStorage(event: StorageEvent) {
  if (event.key === SAVED_STORAGE_KEY || event.key === null) notify();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener("storage", onStorage);
  };
}

function write(ids: readonly string[]): SavedState {
  const raw = JSON.stringify(ids);
  if (!visitOnly) {
    try {
      localStorage.setItem(SAVED_STORAGE_KEY, raw);
      lastRaw = raw;
    } catch {
      visitOnly = true;
    }
  }
  state = { ids, ready: true, persistent: !visitOnly };
  notify();
  return state;
}

export function toggleSavedProduct(id: string) {
  const current = getSnapshot();
  const cleanId = id.trim();
  if (!cleanId) return { saved: false, persistent: current.persistent };
  const saved = !current.ids.includes(cleanId);
  const next = write(
    saved ? [cleanId, ...current.ids] : current.ids.filter((value) => value !== cleanId),
  );
  return { saved, persistent: next.persistent };
}

export function clearSavedProducts() {
  return write([]);
}
export function useSavedProducts() {
  return useSyncExternalStore(subscribe, getSnapshot, () => serverState);
}
