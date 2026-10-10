"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Lock, LockOpen } from "lucide-react";
import { lock, useCanEdit, useUnlock } from "@/lib/store";

/** 有驗證碼功能的頁面（路徑開頭） */
const CODE_PAGES = [
  "/orchards",
  "/records/spraying",
  "/records/fertilizing",
  "/records/pruning",
  "/records/propagation",
  "/suppliers",
  "/materials",
  "/workers",
  "/knowledge",
  "/staff",
]; // 後台管理頁有自己的解鎖區塊

export const isCodePage = (pathname: string) =>
  CODE_PAGES.some((p) => pathname === p || pathname.startsWith(p + "/"));

/** 每秒更新的剩餘秒數 */
export function useRemaining(until: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [until]);
  return until ? Math.max(0, Math.ceil((until - now) / 1000)) : 0;
}

export const mmss =(s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** 頁面標題後面的小提示：解鎖中顯示倒數，沒解鎖時提示可到後台解鎖 */
export function UnlockTimer() {
  const canEdit = useCanEdit();
  const until = useUnlock();
  const left = useRemaining(until);
  if (!canEdit) return null;

  if (until && left > 0) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-800 ring-1 ring-emerald-600/20">
        <LockOpen size={15} />
        驗證碼已解鎖，<b className="tabular-nums">{mmss(left)}</b> 後失效
        <button onClick={() => void lock()} className="ml-1 text-xs text-emerald-700 underline hover:text-emerald-900">
          立即鎖定
        </button>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-2 rounded-full bg-stone-200/60 px-3 py-1 text-sm text-stone-600">
      <Lock size={15} />
      新增／修改／刪除需輸入驗證碼
      <Link href="/admin" className="text-xs text-emerald-700 underline hover:text-emerald-900">
        到後台解鎖 1 小時
      </Link>
    </div>
  );
}

