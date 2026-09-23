"use client";

import { Fragment, useState, useSyncExternalStore } from "react";
import { LayoutGrid, List, MapPin, Phone, Plus, Search, ShieldAlert, Store, UserRound, X } from "lucide-react";
import { removeWithCode, upsert, useDB, verifyCode } from "@/lib/store";
import { searchSuppliers } from "@/lib/supplier-search";
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
  Table,
  Td,
  Textarea,
  Thumb,
} from "@/components/ui";

/** 表單固定顯示 3 組聯絡人欄位 */
const padContacts = (list: SupplierContact[] = []) =>
  Array.from({ length: SUPPLIER_CONTACTS }, (_, i) => list[i] ?? { name: "", phone: "" });

/* ---------------- 顯示方式（卡片／清單），記在這台電腦的瀏覽器 ---------------- */
type View = "card" | "list";
const VIEW_KEY = "chou-suppliers-view";
const viewListeners = new Set<() => void>();

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "card";
  } catch {
    return "card";
  }
}

function writeView(v: View) {
  try {
    localStorage.setItem(VIEW_KEY, v);
  } catch {
    // 無法儲存（例如無痕模式）時，只在這次瀏覽有效
  }
  memoryView = v;
  viewListeners.forEach((l) => l());
}

let memoryView: View | null = null;

function useView(): [View, (v: View) => void] {
  const view = useSyncExternalStore(
    (l) => {
      viewListeners.add(l);
      return () => viewListeners.delete(l);
    },
    () => memoryView ?? readView(),
    () => "card" as View,
  );
  return [view, writeView];
}

/** 把符合關鍵字的文字標成黃色 */
function Hl({ text, query }: { text: string; query: string }) {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  if (!text || !terms.length) return <>{text}</>;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  return (
    <>
      {text.split(re).map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="rounded bg-amber-200 px-0.5 text-inherit">{part}</mark>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}

type Actions = { onEdit: (s: Supplier) => void; onDelete: (s: Supplier) => void };

export default function SuppliersPage() {
  const db = useDB();
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deleting, setDeleting] = useState<Supplier | null>(null);
  // 新增或編輯前先輸入驗證碼；通過後保留驗證碼，儲存時再送給後端檢查
  const [gate, setGate] = useState<{ supplier: Supplier | null } | null>(null);
  const [code, setCode] = useState<string | undefined>();
  const [query, setQuery] = useState("");
  const [view, setView] = useView();

  const results = searchSuppliers(db.suppliers, db.materials, query);
  const count = (id: string) => db.materials.filter((m) => m.supplierId === id).length;
  const actions: Actions = { onEdit: (s) => setGate({ supplier: s }), onDelete: setDeleting };

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

      {db.suppliers.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 sm:max-w-md">
            <Search size={16} className="pointer-events-none absolute left-3 top-2.5 text-stone-400" />
            <Input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQuery("")}
              placeholder="搜尋店名、電話、聯絡人、地址、資材…"
              className="pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-2 top-2 rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                aria-label="清除搜尋"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <span className="text-sm text-stone-500">
            {query.trim() ? `找到 ${results.length} 家` : `共 ${db.suppliers.length} 家`}
          </span>
          <div className="ml-auto flex rounded-lg border border-stone-300 bg-white p-0.5" role="group" aria-label="顯示方式">
            {(
              [
                { v: "card", label: "卡片", icon: LayoutGrid },
                { v: "list", label: "清單", icon: List },
              ] as const
            ).map(({ v, label, icon: Icon }) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                  view === v ? "bg-emerald-700 text-white" : "text-stone-600 hover:bg-stone-100"
                }`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {db.suppliers.length === 0 ? (
        <Empty>尚未登錄店家</Empty>
      ) : results.length === 0 ? (
        <Empty>
          找不到符合「{query.trim()}」的店家。
          <button onClick={() => setQuery("")} className="ml-1 text-emerald-700 underline">清除搜尋</button>
        </Empty>
      ) : view === "card" ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {results.map(({ s, materialHits }) => (
            <SupplierCard key={s.id} s={s} query={query} count={count(s.id)} materialHits={materialHits} {...actions} />
          ))}
        </div>
      ) : (
        <SupplierTable rows={results} query={query} count={count} {...actions} />
      )}

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

function MaterialHits({ hits, query }: { hits: string[]; query: string }) {
  if (!hits.length) return null;
  return (
    <div className="text-xs text-stone-500">
      供應：{hits.map((h, i) => <Fragment key={h}>{i > 0 && "、"}<Hl text={h} query={query} /></Fragment>)}
    </div>
  );
}

function SupplierCard({
  s,
  query,
  count,
  materialHits,
  onEdit,
  onDelete,
}: { s: Supplier; query: string; count: number; materialHits: string[] } & Actions) {
  const contacts = (s.contacts ?? []).filter((c) => c.name || c.phone);
  const cards = s.cardPhotos ?? [];
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <Store size={18} />
          </div>
          <div className="font-semibold text-stone-900"><Hl text={s.name} query={query} /></div>
        </div>
        <RowActions confirm={false} onEdit={() => onEdit(s)} onDelete={() => onDelete(s)} />
      </div>

      <div className="mt-3 space-y-1 text-sm">
        {s.phone && (
          <a href={`tel:${s.phone}`} className="flex items-center gap-1.5 text-emerald-700">
            <Phone size={13} /> 店家電話 <Hl text={s.phone} query={query} />
          </a>
        )}
        <a
          href={`https://www.google.com/maps/search/${encodeURIComponent(s.address)}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-start gap-1.5 text-stone-600 hover:underline"
        >
          <MapPin size={13} className="mt-0.5 shrink-0" /> {s.address ? <Hl text={s.address} query={query} /> : "—"}
        </a>
        <MaterialHits hits={materialHits} query={query} />
      </div>

      {contacts.length > 0 && (
        <ul className="mt-3 divide-y divide-stone-100 rounded-lg bg-stone-50 px-3 text-sm">
          {contacts.map((c, i) => (
            <li key={i} className="flex items-center justify-between gap-2 py-1.5">
              <span className="flex items-center gap-1.5 text-stone-700">
                <UserRound size={13} className="text-stone-400" /> {c.name ? <Hl text={c.name} query={query} /> : "—"}
              </span>
              {c.phone ? (
                <a href={`tel:${c.phone}`} className="text-emerald-700"><Hl text={c.phone} query={query} /></a>
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
        <span><Hl text={s.note} query={query} /></span>
        <span className="shrink-0">供應 {count} 項資材</span>
      </div>
    </Card>
  );
}

function SupplierTable({
  rows,
  query,
  count,
  onEdit,
  onDelete,
}: {
  rows: { s: Supplier; materialHits: string[] }[];
  query: string;
  count: (id: string) => number;
} & Actions) {
  return (
    <Table head={["店家名稱", "店家電話", "聯絡人", "地址", "名片", "資材", ""]}>
      {rows.map(({ s, materialHits }) => {
        const contacts = (s.contacts ?? []).filter((c) => c.name || c.phone);
        const cards = s.cardPhotos ?? [];
        return (
          <tr key={s.id} className="align-top hover:bg-stone-50">
            <Td>
              <div className="font-medium text-stone-900"><Hl text={s.name} query={query} /></div>
              {s.note && <div className="text-xs text-stone-500"><Hl text={s.note} query={query} /></div>}
              <MaterialHits hits={materialHits} query={query} />
            </Td>
            <Td className="whitespace-nowrap">
              {s.phone ? (
                <a href={`tel:${s.phone}`} className="text-emerald-700"><Hl text={s.phone} query={query} /></a>
              ) : (
                <span className="text-stone-400">—</span>
              )}
            </Td>
            <Td>
              {contacts.length ? (
                <ul className="space-y-0.5">
                  {contacts.map((c, i) => (
                    <li key={i} className="whitespace-nowrap">
                      <Hl text={c.name || "—"} query={query} />
                      {c.phone && (
                        <a href={`tel:${c.phone}`} className="ml-2 text-emerald-700"><Hl text={c.phone} query={query} /></a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-stone-400">—</span>
              )}
            </Td>
            <Td>
              {s.address ? (
                <a
                  href={`https://www.google.com/maps/search/${encodeURIComponent(s.address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-stone-700 hover:underline"
                >
                  <Hl text={s.address} query={query} />
                </a>
              ) : (
                <span className="text-stone-400">—</span>
              )}
            </Td>
            <Td className="whitespace-nowrap">
              {cards.length ? (
                <div className="flex items-center gap-2">
                  <Thumb src={cards[0]} className="h-10 w-14" />
                  {cards.length > 1 && <span className="text-xs text-stone-500">共 {cards.length} 張</span>}
                </div>
              ) : (
                <span className="text-stone-400">—</span>
              )}
            </Td>
            <Td className="whitespace-nowrap">{count(s.id)} 項</Td>
            <Td>
              <RowActions confirm={false} onEdit={() => onEdit(s)} onDelete={() => onDelete(s)} />
            </Td>
          </tr>
        );
      })}
    </Table>
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