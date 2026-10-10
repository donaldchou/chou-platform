"use client";

import { useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { lock, unlock, useUnlock } from "@/lib/store";
import { Button, Input } from "./ui";
import { mmss, useRemaining } from "./unlock";

/** 後台管理的解鎖區塊 */
export function UnlockPanel() {
  const until = useUnlock();
  const left = useRemaining(until);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const unlocked = !!until && left > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return setError("請輸入驗證碼");
    setBusy(true);
    setError("");
    const res = await unlock(code.trim());
    setBusy(false);
    setCode("");
    if (!res.ok) setError(res.error);
  }

  return (
    <div
      className={`mb-5 rounded-xl border p-4 ${unlocked ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {unlocked ? <LockOpen size={22} className="text-emerald-700" /> : <Lock size={22} className="text-amber-700" />}
          <div>
            <div className="font-semibold text-stone-800">驗證碼解鎖</div>
            <div className="text-sm text-stone-600">
              {unlocked ? (
                <>已解鎖，所有頁面的新增／修改／刪除都不用輸入驗證碼，<b className="tabular-nums">{mmss(left)}</b> 後失效。</>
              ) : (
                "輸入一次驗證碼，1 小時內所有需要驗證碼的頁面都不用再輸入。"
              )}
            </div>
          </div>
        </div>
        {unlocked ? (
          <Button variant="secondary" onClick={() => void lock()}>立即鎖定</Button>
        ) : (
          <form onSubmit={submit} className="flex items-start gap-2">
            <div>
              <Input
                type="password"
                autoComplete="off"
                placeholder="請輸入驗證碼"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  setError("");
                }}
              />
              {error && <div className="mt-1 text-xs font-medium text-red-600">{error}</div>}
            </div>
            <Button type="submit" disabled={busy}>{busy ? "驗證中…" : "解鎖 1 小時"}</Button>
          </form>
        )}
      </div>
    </div>
  );
}
