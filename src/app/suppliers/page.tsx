"use client";

import { useState } from "react";
import { MapPin, Phone, Plus, ShieldAlert, Store, UserRound } from "lucide-react";
import { removeWithCode, upsert, useDB, verifyCode } from "@/lib/store";
import { SUPPLIER_CONTACTS, type Supplier, type SupplierContact } from "@/lib/types";
import { uid } from "@/lib/utils";
import {
  Button,
  Card,
  Empty,
  Field,
  Gallery,
  Input,
  Modal,
  PageHeader,
  PhotoUpload,
  RowActions,
  Textarea,
} from "@/components/ui";

/** 表單固定顯示 3 組聯絡人欄位 */
const padContacts = (list: SupplierContact[] = []) =>
  Array.from({ length: SUPPLIER_CONTACTS }, (_, i) => list[i] ?? { name: "", phone: "" });

export default function SuppliersPage() {
  const db = useDB();
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  // 新增或編輯前先輸入驗證碼；通過後保留驗證碼，儲存時再送給後端檢查
  const [gate, setGate] = useState<{ supplier: Supplier | null } | null>(null);
  const [code, setCode] = useState<string | undefined>();

  return (
    <>
      <PageHeader
        title="貨源店家管理"
        desc="登錄購買農藥、肥料與資材的店家，資材資料可直接選擇購買地。"
        action={
          <Button onClick={() => setGate({ supplier: null })}>
            <Plus size={16} /> 新增店家
          </Button>
        }
      />
      {db.suppliers.length === 0 && <Empty>尚未登錄店家</Empty>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {db.suppliers.map((s) => {
          const count = db.materials.filter((m) => m.supplierId === s.id).length;
          const contacts = (s.contacts ?? []).filter((c) => c.name || c.phone);
          const cards = s.cardPhotos ?? [];
          return (
            <Card key={s.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                    <Store size={18} />
                  </div>
                  <div className="font-semibold text-stone-900">{s.name}</div>
                </div>
                <RowActions confirm={false} onEdit={() => setGate({ supplier: s })} onDelete={() => setDeleting(s)} />
              </div>

              <div className="mt-3 space-y-1 text-sm">
                {s.phone && (
                  <a href={`tel:${s.phone}`} className="flex items-center gap-1.5 text-emerald-700">
                    <Phone size={13} /> 店家電話 {s.phone}
                  </a>
                )}
                <a
                  href={`https://www.google.com/maps/search/${encodeURIComponent(s.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-start gap-1.5 text-stone-600 hover:underline"
                >
                  <MapPin size={13} className="mt-0.5 shrink-0" /> {s.address || "—"}
                </a>
              </div>

              {contacts.length > 0 && (
                <ul className="mt-3 divide-y divide-stone-100 rounded-lg bg-stone-50 px-3 text-sm">
                  {contacts.map((c, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 py-1.5">
                      <span className="flex items-center gap-1.5 text-stone-700">
                        <UserRound size={13} className="text-stone-400" /> {c.name || "—"}
                      </span>
                      {c.phone ? (
                        <a href={`tel:${c.phone}`} className="text-emerald-700">{c.phone}</a>
                      ) : (
                        <span className="text-stone-400">—</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3">
                <div className="mb-1 text-xs text-stone-500">名片（{cards.length} 張）</div>
                <Gallery photos={cards} size="h-16 w-24" />
              </div>

              <div className="mt-auto flex justify-between gap-2 border-t border-stone-100 pt-3 text-xs text-stone-500">
                <span>{s.note}</span>
                <span className="shrink-0">供應 {count} 項資材</span>
              </div>
            </Card>
          );
        })}
      </div>
      {gate && (
        <SupplierGate
          supplier={gate.supplier}
          onClose={() => setGate(null)}
          onVerified={(verified) => {
            setCode(verified);
            setEditing(
              gate.supplier ?? { id: uid(), name: "", phone: "", contacts: [], address: "", cardPhotos: [], note: "" },
            );
            setGate(null);
          }}
        />
      )}
      {editing && (
        <SupplierModal
          supplier={editing}
          code={code}
          onClose={() => {
            setEditing(null);
            setCode(undefined);
          }}
        />
      )}
      {deleting && <DeleteSupplierModal supplier={deleting} onClose={() => setDeleting(null)} />}
    </>
  );
}

function SupplierModal({ supplier, code, onClose }: { supplier: Supplier; code?: string; onClose: () => void }) {
  const [s, setS] = useState<Supplier>({
    ...supplier,
    contacts: padContacts(supplier.contacts),
    cardPhotos: supplier.cardPhotos ?? [],
  });
  const setContact = (i: number, patch: Partial<SupplierContact>) =>
    setS((p) => ({ ...p, contacts: p.contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  function save() {
    if (!s.name.trim()) return alert("請填寫店家名稱");
    // 只儲存有填寫的聯絡人
    const contacts = s.contacts
      .map((c) => ({ name: c.name.trim(), phone: c.phone.trim() }))
      .filter((c) => c.name || c.phone);
    upsert("suppliers", { ...s, contacts }, { code });
    onClose();
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="貨源店家"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={save}>儲存</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="店家名稱*">
          <Input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
        </Field>
        <Field label="店家電話">
          <Input type="tel" value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} placeholder="例：04-2598-1234" />
        </Field>
        <Field label="地址" className="sm:col-span-2">
          <Input value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} />
        </Field>
      </div>

      <div className="mt-5">
        <div className="mb-2 text-sm font-medium text-stone-700">聯絡人與電話（最多 {SUPPLIER_CONTACTS} 組）</div>
        <div className="space-y-2">
          {s.contacts.map((c, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 rounded-lg bg-stone-100 p-2">
              <span className="w-14 text-sm text-stone-500">聯絡人 {i + 1}</span>
              <Input value={c.name} onChange={(e) => setContact(i, { name: e.target.value })} placeholder="姓名" />
              <Input type="tel" value={c.phone} onChange={(e) => setContact(i, { phone: e.target.value })} placeholder="電話" />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="名片（可上傳多張）" group>
          <PhotoUpload folder="suppliers" max={10} value={s.cardPhotos} onChange={(v) => setS({ ...s, cardPhotos: v })} />
        </Field>
        <Field label="備註">
          <Textarea value={s.note} onChange={(e) => setS({ ...s, note: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

/** 輸入驗證碼的對話框：交給 onSubmit 檢查，錯誤時顯示訊息並讓使用者重新輸入 */
function CodeModal({
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

/** 新增或編輯店家前先驗證，通過後才打開表單（supplier 為 null 表示新增） */
function SupplierGate({
  supplier,
  onVerified,
  onClose,
}: {
  supplier: Supplier | null;
  onVerified: (code: string) => void;
  onClose: () => void;
}) {
  return (
    <CodeModal
      title={supplier ? "編輯貨源店家" : "新增貨源店家"}
      confirmLabel="下一步"
      onClose={onClose}
      onSubmit={async (code) => {
        const res = await verifyCode("suppliers", supplier ? "update" : "create", code);
        if (res.ok) onVerified(code);
        return res;
      }}
    >
      {supplier ? (
        <>編輯「<b>{supplier.name}</b>」需要驗證碼。</>
      ) : (
        "新增貨源店家需要驗證碼。"
      )}
    </CodeModal>
  );
}

/** 刪除店家前要輸入驗證碼，由後端檢查是否正確 */
function DeleteSupplierModal({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const db = useDB();
  const used = db.materials.filter((m) => m.supplierId === supplier.id).length;
  return (
    <CodeModal
      title="刪除貨源店家"
      confirmLabel="確認刪除"
      danger
      onClose={onClose}
      onSubmit={async (code) => {
        const res = await removeWithCode("suppliers", supplier.id, code);
        if (res.ok) onClose();
        return res;
      }}
    >
      即將刪除「<b>{supplier.name}</b>」，名片照片也會一併刪除，無法復原。
      {used > 0 && <div className="mt-1">有 {used} 項資材的購買地是這家店，刪除後會顯示為「—」。</div>}
    </CodeModal>
  );
}