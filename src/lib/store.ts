"use client";

import { useSyncExternalStore } from "react";
import type { DB } from "./types";
import { seedDB } from "./seed";

// Front-end only prototype: data lives in localStorage until a backend exists.
const KEY = "chou-platform-db-v1";
const seed = seedDB();
let state: DB | null = null;
const listeners = new Set<() => void>();

function load(): DB {
  if (state) return state;
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? { ...seed, ...(JSON.parse(raw) as Partial<DB>) } : seed;
  } catch {
    state = seed;
  }
  return state;
}

function save(next: DB) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    alert("瀏覽器儲存空間已滿（照片太多），這筆變更只會保留到重新整理為止。");
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

type Coll = keyof DB;
type Item<K extends Coll> = DB[K][number];

export function upsert<K extends Coll>(key: K, item: Item<K>) {
  const db = load();
  const list = db[key] as Item<K>[];
  const exists = list.some((x) => x.id === item.id);
  const next = exists ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list];
  save({ ...db, [key]: next });
}

export function remove<K extends Coll>(key: K, id: string) {
  const db = load();
  save({ ...db, [key]: (db[key] as Item<K>[]).filter((x) => x.id !== id) });
}

export function resetDemo() {
  save(seedDB());
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, load, () => seed);
}

const noop = () => () => {};
/** False during SSR / hydration, true once localStorage data is available. */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}
