"use client";

import { useSyncExternalStore } from "react";
import type { DB } from "./types";

// 前端資料快取：啟動時從 /api/db 載入，寫入時先更新畫面（樂觀更新）再送到後端。
const EMPTY: DB = {
  orchards: [], bills: [], employees: [], workers: [], suppliers: [], materials: [], bagging: [],
  harvests: [], fertilizing: [], spraying: [], labor: [], tasks: [], salaries: [], bonuses: [],
};

type Status = "idle" | "loading" | "ready" | "error";
let state: DB = EMPTY;
let status: Status = "idle";
let error = "";
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? `HTTP ${res.status}`), { status: res.status, data });
  return data as T;
}

export async function reload() {
  // 已經載入過就在背景更新，不讓畫面回到載入中
  if (status !== "ready") {
    status = "loading";
    emit();
  }
  try {
    state = await api<DB>("/api/db");
    status = "ready";
    error = "";
  } catch (e) {
    status = "error";
    error = e instanceof Error ? e.message : String(e);
  }
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  if (status === "idle") void reload();
  return () => listeners.delete(l);
}

function setLocal(next: DB) {
  state = next;
  emit();
}

type Coll = keyof DB;
type Item<K extends Coll> = DB[K][number];

function replaceItem<K extends Coll>(db: DB, key: K, item: Item<K>): DB {
  const list = db[key] as Item<K>[];
  const exists = list.some((x) => x.id === item.id);
  return { ...db, [key]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [item, ...list] };
}

const codeHeader = (code?: string): Record<string, string> =>
  code === undefined ? {} : { "x-verify-code": encodeURIComponent(code) };

/** 新增或更新一筆資料，回傳是否成功。需要驗證碼的操作（例如貨源店家）要帶 code。 */
export async function upsert<K extends Coll>(key: K, item: Item<K>, opts: { code?: string } = {}): Promise<boolean> {
  const prev = state;
  setLocal(replaceItem(state, key, item));
  try {
    const saved = await api<Item<K>>(`/api/${key}/${encodeURIComponent(item.id)}`, {
      method: "PUT",
      headers: codeHeader(opts.code),
      body: JSON.stringify(item),
    });
    // 以後端回傳的資料為準（例如資材的價格歷史由後端維護）
    setLocal(replaceItem(state, key, saved));
    return true;
  } catch (e) {
    setLocal(prev);
    alert(`儲存失敗：${e instanceof Error ? e.message : e}`);
    return false;
  }
}

/** 刪除一筆資料。果園底下還有紀錄時，會再詢問是否一併刪除。 */
export async function remove<K extends Coll>(key: K, id: string): Promise<boolean> {
  const prev = state;
  setLocal({ ...state, [key]: (state[key] as Item<K>[]).filter((x) => x.id !== id) });
  const url = `/api/${key}/${encodeURIComponent(id)}`;
  try {
    await api(url, { method: "DELETE" });
    return true;
  } catch (e) {
    const err = e as Error & { status?: number; data?: { needsCascade?: boolean } };
    if (err.status === 409 && err.data?.needsCascade) {
      if (!confirm(err.message)) {
        setLocal(prev);
        return false;
      }
      try {
        await api(`${url}?cascade=true`, { method: "DELETE" });
        await reload();
        return true;
      } catch (e2) {
        setLocal(prev);
        alert(`刪除失敗：${e2 instanceof Error ? e2.message : e2}`);
        return false;
      }
    }
    setLocal(prev);
    alert(`刪除失敗：${err.message}`);
    return false;
  }
}

/**
 * 需要驗證碼的刪除（例如貨源店家）。等後端確認驗證碼正確後才從畫面移除，
 * 驗證碼錯誤時回傳錯誤訊息，讓對話框顯示。
 */
export async function removeWithCode<K extends Coll>(
  key: K,
  id: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await api(`/api/${key}/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: codeHeader(code),
    });
    setLocal({ ...state, [key]: (state[key] as Item<K>[]).filter((x) => x.id !== id) });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** 只檢查驗證碼是否正確（不會修改資料） */
export async function verifyCode(
  collection: Coll,
  action: "create" | "update" | "delete",
  code: string,
  category?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await api("/api/verify-code", { method: "POST", body: JSON.stringify({ collection, action, code, category }) });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function useDB(): DB {
  return useSyncExternalStore(subscribe, () => state, () => EMPTY);
}

/** 資料載入狀態 */
export function useDBStatus() {
  const s = useSyncExternalStore(subscribe, () => status, () => "idle" as Status);
  return { status: s, error, ready: s === "ready" };
}

/** 真正的 AI 呼叫（後端沒有 API key 時會回傳內建建議） */
export function fetchSprayAdvice(body: {
  stage: string;
  targets: string;
  waterLiters: number;
  materialIds: string[];
}) {
  return api<{ advice: string; source: "ai" | "fallback"; reason?: string }>("/api/ai/spray-advice", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
