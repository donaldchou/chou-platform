"use client";

import { useState } from "react";
import { ShieldAlert } from "lucide-react";
import { Button, Field, Input, Modal } from "./ui";

/** 輸入驗證碼的對話框：交給 onSubmit 檢查，錯誤時顯示訊息並讓使用者重新輸入 */
export function CodeModal({
  title,
  confirmLabel,
  danger = false,
  onSubmit,
  onClose,
  children,
}: {
  title: string;
  confirmLabel: string;
  danger?: boolean;
  onSubmit: (code: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return setError("請輸入驗證碼");
    setBusy(true);
    setError("");
    const res = await onSubmit(code.trim());
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setCode("");
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button variant={danger ? "danger" : "primary"} type="submit" form="code-form" disabled={busy}>
            {busy ? "驗證中…" : confirmLabel}
          </Button>
        </>
      }
    >
      <form id="code-form" onSubmit={submit} className="space-y-4">
        <div
          className={`flex gap-3 rounded-lg p-3 text-sm ${danger ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}
        >
          <ShieldAlert size={20} className="shrink-0" />
          <div>{children}</div>
        </div>
        <Field label="請輸入驗證碼" hint={error && <span className="font-medium text-red-600">{error}</span>}>
          <Input
            type="password"
            autoFocus
            autoComplete="off"
            value={code}
            onChange={(e) => {
              setCode(e.target.value);
              setError("");
            }}
          />
        </Field>
      </form>
    </Modal>
  );
}
