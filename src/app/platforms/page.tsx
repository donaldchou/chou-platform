"use client";

import { useState } from "react";
import { ExternalLink, Plus, Search } from "lucide-react";
import { removeWithCode, upsert, useDB, verifyCode } from "@/lib/store";
import type { Platform } from "@/lib/types";
import { uid } from "@/lib/utils";
import { useCodeGate } from "@/components/code-modal";
import { Button, Field, Input, Modal, PageHeader, RowActions, Table, Td, Textarea } from "@/components/ui";

/** 沒寫 http(s):// 時自動補上 https:// */
const normalizeUrl = (s: string) => {
  const v = s.trim();
  return !v || /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
};

export default function PlatformsPage() {
  const db = useDB();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<{ platform: Platform; code: string } | null>(null);
  const gate = useCodeGate();

  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = db.platforms
    .filter((p) => {
      const text = [p.name, p.url, p.description].join(" ").toLowerCase();
      return terms.every((t) => text.includes(t));
    })
    .sort((a, b) => a.name.localeCompare(b.name, "zh-Hant"));

  // 新增、修改、刪除都要先輸入驗證碼（後端也會再檢查）
  function edit(p: Platform) {
    const isNew = !db.platforms.some((x) => x.id === p.id);
    gate.ask({
      title: isNew ? "新增常用平台" : "修改常用平台",
      confirmLabel: "下一步",
      message: isNew ? "新增常用平台需要驗證碼。" : <>修改「<b>{p.name}</b>」需要驗證碼。</>,
      submit: async (code) => {
        const res = await verifyCode("platforms", isNew ? "create" : "update", code);
        if (res.ok) setEditing({ platform: p, code });
        return res;
      },
    });
  }

  function del(p: Platform) {
    gate.ask({
      title: "刪除常用平台",
      confirmLabel: "確認刪除",
      danger: true,
      message: <>即將刪除「<b>{p.name}</b>」，無法復原。</>,
      submit: (code) => removeWithCode("platforms", p.id, code),
    });
  }

  return (
    <>
      <PageHeader
        title="常用平台"
        desc="整理常用的網站，點網址會用新分頁開啟。"
        action={
          <Button onClick={() => edit({ id: uid(), name: "", url: "", description: "" })}>
            <Plus size={16} /> 新增網站
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <div className="relative min-w-48 max-w-md flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setQ("")}
            placeholder="關鍵字：網站名稱、網址、說明…"
            className="pl-9"
            aria-label="關鍵字"
          />
        </div>
        <span className="text-stone-500">
          {terms.length ? `符合 ${list.length} / ${db.platforms.length} 個` : `共 ${db.platforms.length} 個網站`}
        </span>
      </div>

      <Table head={["網站名稱", "網站網址", "說明", ""]}>
        {list.map((p) => (
          <tr key={p.id} className="hover:bg-stone-50">
            <Td className="whitespace-nowrap font-medium text-stone-900">{p.name}</Td>
            <Td>
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 break-all text-emerald-700 hover:underline"
              >
                {p.url} <ExternalLink size={13} className="shrink-0" />
              </a>
            </Td>
            <Td className="whitespace-pre-wrap text-stone-500">{p.description || "—"}</Td>
            <Td><RowActions confirm={false} onEdit={() => edit(p)} onDelete={() => del(p)} /></Td>
          </tr>
        ))}
        {!list.length && (
          <tr>
            <Td colSpan={4} className="py-8 text-center text-stone-400">
              {db.platforms.length ? `沒有符合「${q.trim()}」的網站` : "還沒有常用平台，按「新增網站」開始建立。"}
            </Td>
          </tr>
        )}
      </Table>

      {gate.dialog}
      {editing && <PlatformModal platform={editing.platform} code={editing.code} onClose={() => setEditing(null)} />}
    </>
  );
}

/** code：打開前已驗證過的驗證碼，儲存時送給後端 */
function PlatformModal({ platform, code, onClose }: { platform: Platform; code: string; onClose: () => void }) {
  const [p, setP] = useState(platform);

  function save() {
    const url = normalizeUrl(p.url);
    if (!p.name.trim()) return alert("請填寫網站名稱");
    if (!url) return alert("請填寫網站網址");
    void upsert("platforms", { ...p, name: p.name.trim(), url, description: p.description.trim() }, { code });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={platform.name ? "修改常用平台" : "新增常用平台"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={save}>儲存</Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Field label="網站名稱 *">
          <Input autoFocus value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} placeholder="例：農業部農藥資訊服務網" />
        </Field>
        <Field label="網站網址 *" hint="沒寫 https:// 會自動補上">
          <Input
            type="url"
            value={p.url}
            onChange={(e) => setP({ ...p, url: e.target.value })}
            onBlur={() => setP((x) => ({ ...x, url: normalizeUrl(x.url) }))}
            placeholder="https://"
          />
        </Field>
        <Field label="說明">
          <Textarea value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
