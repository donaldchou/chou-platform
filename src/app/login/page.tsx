"use client";

import { useState } from "react";
import { Boxes, LogIn } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";

/** 登入後要回到的頁面；只接受站內路徑，避免被導到別的網站 */
function nextPath() {
  const next = new URLSearchParams(window.location.search).get("next") ?? "/";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `登入失敗（HTTP ${res.status}）`);
      }
      // 整頁重新載入，讓資料和登入身分重新讀取
      window.location.href = nextPath();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPassword("");
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-stone-100 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <Boxes size={24} />
          </div>
          <div>
            <div className="text-xl font-bold text-stone-900">CHOU 農場平台</div>
            <div className="text-sm text-stone-500">果園管理系統</div>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-stone-900">登入</h1>
          <Field label="Email">
            <Input
              type="email"
              autoComplete="username"
              autoFocus
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="密碼">
            <Input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <Button type="submit" disabled={busy} className="w-full">
            <LogIn size={16} /> {busy ? "登入中…" : "登入"}
          </Button>
        </form>
      </div>
    </main>
  );
}
