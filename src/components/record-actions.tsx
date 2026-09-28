"use client";

import { useState } from "react";
import { removeWithCode, useDB, verifyCode } from "@/lib/store";
import { fmtDT } from "@/lib/utils";
import { CodeModal } from "./code-modal";
import { FertModal } from "./fert-modal";
import type { OpenRecord } from "./spray-calendar";
import { SprayModal } from "./spray-modal";

const LABEL = { spraying: "噴藥紀錄", fertilizing: "施肥紀錄" } as const;

/**
 * 噴藥／施肥紀錄的新增、修改、刪除都要先輸入驗證碼（後端也會再檢查）。
 * edit(o)：驗證通過後打開編輯表單（資料庫裡沒有這筆就算新增）；remove(o)：輸入驗證碼後刪除。
 * 把回傳的 dialogs 放進畫面裡。
 */
export function useRecordActions() {
  const db = useDB();
  const [gate, setGate] = useState<OpenRecord | null>(null);
  const [deleting, setDeleting] = useState<OpenRecord | null>(null);
  const [editing, setEditing] = useState<{ open: OpenRecord; code: string } | null>(null);

  const isNew = (o: OpenRecord) => !db[o.kind].some((x) => x.id === o.record.id);

  const dialogs = (
    <>
      {gate && (
        <CodeModal
          title={`${isNew(gate) ? "新增" : "修改"}${LABEL[gate.kind]}`}
          confirmLabel="下一步"
          onClose={() => setGate(null)}
          onSubmit={async (code) => {
            const res = await verifyCode(gate.kind, isNew(gate) ? "create" : "update", code);
            if (res.ok) {
              setEditing({ open: gate, code });
              setGate(null);
            }
            return res;
          }}
        >
          {isNew(gate) ? `新增${LABEL[gate.kind]}需要驗證碼。` : <>修改 <b>{fmtDT(gate.record.datetime)}</b> 的{LABEL[gate.kind]}需要驗證碼。</>}
        </CodeModal>
      )}
      {deleting && (
        <CodeModal
          title={`刪除${LABEL[deleting.kind]}`}
          confirmLabel="確認刪除"
          danger
          onClose={() => setDeleting(null)}
          onSubmit={async (code) => {
            const res = await removeWithCode(deleting.kind, deleting.record.id, code);
            if (res.ok) setDeleting(null);
            return res;
          }}
        >
          即將刪除 <b>{fmtDT(deleting.record.datetime)}</b> 的{LABEL[deleting.kind]}，無法復原。
        </CodeModal>
      )}
      {editing?.open.kind === "spraying" && (
        <SprayModal record={editing.open.record} code={editing.code} onClose={() => setEditing(null)} />
      )}
      {editing?.open.kind === "fertilizing" && (
        <FertModal record={editing.open.record} code={editing.code} onClose={() => setEditing(null)} />
      )}
    </>
  );

  return { edit: setGate, remove: setDeleting, dialogs };
}
