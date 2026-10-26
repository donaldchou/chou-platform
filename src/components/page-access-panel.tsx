"use client";

import { useEffect, useState } from "react";
import { EyeOff, Lock } from "lucide-react";
import { useCodeGate } from "./code-modal";
import { Badge, Button, Card } from "./ui";
import { USER_PAGES, type PageAccessSettings, type PageKey } from "@/lib/page-access";

/** 只有管理者能用的頁面：列出來讓管理者知道，不能開給一般使用者 */
const ADMIN_ONLY = ["後台管理", "常用平台"];

/** 依選單分組 */
const GROUPS = [...new Set(USER_PAGES.map((p) => p.group))].map((g) => ({ name: g, pages: USER_PAGES.filter((p) => p.group === g) }));

type Draft = { allowed: PageKey[]; hidden: Record<string, PageKey[]> };

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function call<T>(url: string, init?: RequestInit & { code?: string }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.code !== undefined ? { "x-verify-code": encodeURIComponent(init.code) } : {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? `HTTP ${res.status}`), { status: res.status, data });
  return data as T;
}

/**
 * 後台「頁面權限」：① 一般使用者可以看的頁面，② 個別帳號再隱藏。
 * 帳號看得到的頁面 ＝ ① 有勾 且 ② 沒勾；管理者永遠看得到全部。
 */
export function PageAccessPanel() {
  const [data, setData] = useState<PageAccessSettings | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [selected, setSelected] = useState("");
  const gate = useCodeGate();

  useEffect(() => {
    call<PageAccessSettings>("/api/admin/page-access").then(setData, (e) => setError(errMsg(e)));
  }, []);

  if (error) return <p className="text-sm text-red-600">讀取失敗：{error}</p>;
  if (!data) return <p className="text-sm text-stone-500">載入中…</p>;

  const cur: Draft = draft ?? { allowed: data.allowed, hidden: Object.fromEntries(data.users.map((u) => [u.id, u.hiddenPages])) };
  const user = data.users.find((u) => u.id === selected) ?? data.users[0];
  const hiddenOf = (id: string) => cur.hidden[id] ?? [];
  const visibleFor = (id: string) => cur.allowed.filter((k) => !hiddenOf(id).includes(k));

  const toggle = (list: PageKey[], k: PageKey) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);
  const toggleBase = (k: PageKey) => setDraft({ ...cur, allowed: toggle(cur.allowed, k) });
  const toggleHidden = (id: string, k: PageKey) => setDraft({ ...cur, hidden: { ...cur.hidden, [id]: toggle(hiddenOf(id), k) } });

  const save = () =>
    gate.ask({
      title: "儲存頁面權限",
      confirmLabel: "儲存",
      message: "修改一般使用者可以看的頁面需要驗證碼。",
      submit: async (code) => {
        try {
          setData(await call<PageAccessSettings>("/api/admin/page-access", { method: "PUT", body: JSON.stringify(cur), code }));
          setDraft(null);
          return { ok: true };
        } catch (e) {
          return { ok: false, error: errMsg(e) };
        }
      },
    });

  return (
    <div className="space-y-5">
      <Card
        title="① 一般使用者可以看的頁面"
        action={<Badge tone="green">一般使用者可看 {cur.allowed.length} / {USER_PAGES.length} 頁</Badge>}
      >
        <p className="mb-4 text-sm text-stone-500">打勾＝所有一般使用者都看得到；沒打勾的頁面會從左邊選單消失，直接輸入網址也看不到內容，對應的資料也不會傳給他。</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {GROUPS.map((g) => (
            <div key={g.name} className="rounded-xl border border-stone-200 p-3">
              <div className="mb-2 text-sm font-semibold text-emerald-800">{g.name}</div>
              {g.pages.map((p) => {
                const on = cur.allowed.includes(p.key);
                return (
                  <label
                    key={p.key}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 ${on ? "bg-emerald-50 text-stone-800" : "text-stone-500"}`}
                  >
                    <input type="checkbox" checked={on} onChange={() => toggleBase(p.key)} className="h-4 w-4 accent-emerald-700" />
                    {p.label}
                  </label>
                );
              })}
            </div>
          ))}
        </div>
        <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-stone-400">
          <Lock size={13} /> 只有管理者能用（不能開給一般使用者）：{ADMIN_ONLY.join("、")}
        </p>
      </Card>

      <Card title="② 個別帳號再隱藏（選填）">
        <p className="mb-4 text-sm text-stone-500">先選帳號，再勾選要「對這個帳號隱藏」的頁面。只能比 ① 更少，不能多開；① 已關掉的頁面會鎖住。</p>
        {!user ? (
          <p className="rounded-lg border border-dashed border-stone-300 py-8 text-center text-sm text-stone-500">
            目前沒有一般使用者帳號，請先到「使用者管理」新增
          </p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(200px,260px)_1fr_minmax(200px,260px)] lg:items-start">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-stone-600">一般使用者帳號</div>
              {data.users.map((u) => {
                const n = cur.allowed.filter((k) => hiddenOf(u.id).includes(k)).length;
                return (
                  <button
                    key={u.id}
                    type="button"
                    aria-pressed={u.id === user.id}
                    onClick={() => setSelected(u.id)}
                    className={`flex w-full cursor-pointer flex-col items-start gap-0.5 rounded-xl px-3.5 py-3 text-left ${
                      u.id === user.id ? "border-2 border-emerald-700 bg-emerald-50" : "border border-stone-200 bg-white hover:bg-stone-50"
                    }`}
                  >
                    <span className="font-semibold text-stone-800">
                      {u.name || u.email}
                      {!u.active && <span className="ml-1.5 text-xs font-normal text-stone-400">（已停用）</span>}
                    </span>
                    <span className="text-xs text-stone-500">{u.email}</span>
                    <span className={`mt-1 rounded-full px-2 py-0.5 text-xs font-semibold ${n ? "bg-orange-50 text-orange-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {n ? `另外隱藏 ${n} 頁` : "跟一般使用者相同"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="rounded-xl border border-stone-200 p-4">
              <div className="mb-3 flex items-center gap-2 font-semibold text-stone-800">
                <EyeOff size={18} className="text-orange-600" /> 對「{user.name || user.email}」隱藏這些頁面
              </div>
              <div className="space-y-3">
                {GROUPS.map((g) => (
                  <div key={g.name}>
                    <div className="mb-1 text-xs font-semibold text-emerald-800">{g.name}</div>
                    {g.pages.map((p) => {
                      const off = !cur.allowed.includes(p.key);
                      const hidden = !off && hiddenOf(user.id).includes(p.key);
                      return (
                        <label
                          key={p.key}
                          className={`flex items-center gap-2.5 rounded-lg px-2 py-2 ${
                            off ? "cursor-not-allowed bg-stone-50 text-stone-400 line-through" : hidden ? "cursor-pointer bg-orange-50" : "cursor-pointer"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={hidden}
                            disabled={off}
                            onChange={() => toggleHidden(user.id, p.key)}
                            className="h-4 w-4 accent-orange-600"
                          />
                          <span className="flex-1">{p.label}</span>
                          <span className={`text-xs font-semibold ${off ? "text-stone-400" : hidden ? "text-orange-700" : "text-emerald-700"}`}>
                            {off ? "① 已關閉" : hidden ? "已隱藏" : "看得到"}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <aside aria-label="登入後選單預覽" className="rounded-xl bg-emerald-950 p-4 text-white">
              <div className="text-xs text-emerald-200">預覽：{user.name || user.email} 登入後的選單</div>
              {GROUPS.map((g) => {
                const pages = g.pages.filter((p) => visibleFor(user.id).includes(p.key));
                if (!pages.length) return null;
                return (
                  <div key={g.name} className="pt-3">
                    <div className="mb-1 text-xs font-semibold text-emerald-300/80">{g.name}</div>
                    {pages.map((p) => (
                      <div key={p.key} className="mb-0.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm">
                        {p.label}
                      </div>
                    ))}
                  </div>
                );
              })}
              {visibleFor(user.id).length === 0 && <div className="pt-3 text-sm text-orange-300">這個帳號登入後看不到任何頁面</div>}
              <div className="pt-3 text-xs text-emerald-300/80">共 {visibleFor(user.id).length} 個頁面</div>
            </aside>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-500">規則：帳號看得到的頁面 ＝ ① 有勾 且 ② 沒勾。管理者永遠看得到全部。儲存需要後台驗證碼。</p>
        <div className="flex gap-2">
          <Button variant="secondary" disabled={!draft} onClick={() => setDraft(null)}>
            取消變更
          </Button>
          <Button disabled={!draft} onClick={save}>
            儲存權限設定
          </Button>
        </div>
      </div>
      {gate.dialog}
    </div>
  );
}
