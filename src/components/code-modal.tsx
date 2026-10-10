"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldAlert } from "lucide-react";
import { isUnlocked } from "@/lib/store";
import { Button, Field, Input, Modal } from "./ui";

type CodeResult = { ok: true } | { ok: false; error: string };

interface CodeAsk {
  title: string;
  confirmLabel: string;
  danger?: boolean;
  message: React.ReactNode;
  /** 檢查驗證碼並執行動作；成功時對話框會自動關閉 */
  submit: (code: string) => Promise<CodeResult>;
  /** 按取消關掉時（例如把畫面上已改的值還原） */
  onCancel?: () => void;
}

/** 需要驗證碼才能做的動作：ask(...) 跳出對話框，把 dialog 放進畫面裡 */
export function useCodeGate() {
  const [ask, setAsk] = useState<CodeAsk | null>(null);
  const dialog = ask && (
    <CodeModal
      title={ask.title}
      confirmLabel={ask.confirmLabel}
      danger={ask.danger}
      onClose={() => {
        ask.onCancel?.();
        setAsk(null);
      }}
      onSubmit={async (code) => {
        const res = await ask.submit(code);
        if (res.ok) setAsk(null);
        return res;
      }}
    >
      {ask.message}
    </CodeModal>
  );
  return { ask: setAsk, dialog };
}

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
  // 後台解鎖期間不用輸入驗證碼（後端會用解鎖 cookie 放行）：
  // 一般操作直接送出、不顯示對話框；刪除仍顯示確認，只是不用輸入。失敗（例如剛好到期）才改回輸入。
  const [skip, setSkip] = useState(isUnlocked);
  const auto = skip && !danger;

  const onSubmitRef = useRef(onSubmit);
  const started = useRef(false); // 開發模式 effect 會跑兩次，避免重複送出
  useEffect(() => {
    if (!auto || started.current) return;
    started.current = true;
    void onSubmitRef.current("").then((res) => {
      if (res.ok) return;
      setSkip(false);
      setError(res.error);
    });
  }, [auto]);

  if (auto) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!skip && !code.trim()) return setError("請輸入驗證碼");
    setBusy(true);
    setError("");
    const res = await onSubmit(skip ? "" : code.trim());
    setBusy(false);
    if (!res.ok) {
      setSkip(false);
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
            {busy ? (skip ? "處理中…" : "驗證中…") : confirmLabel}
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
        {skip ? (
          <p className="text-sm text-emerald-700">驗證碼已在後台解鎖，這次不需輸入。</p>
        ) : (
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
        )}
      </form>
    </Modal>
  );
}
