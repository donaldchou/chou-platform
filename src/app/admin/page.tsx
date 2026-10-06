"use client";

import { useEffect, useState } from "react";
import { Eye, KeyRound, Plus, Search, Trash2 } from "lucide-react";
import { CodeModal } from "@/components/code-modal";
import {
  Badge,
  Button,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  Table,
  Tabs,
  Td,
  confirmDelete,
} from "@/components/ui";
import { reload, useDB, useMe } from "@/lib/store";
import type { DB } from "@/lib/types";

type Tab = "users" | "data";

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("users");
  return (
    <>
      <PageHeader title="後台管理" desc="管理登入帳號，以及檢視、刪除資料庫裡的所有資料。只有管理者看得到這一頁。" />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "users", label: "使用者管理" },
          { value: "data", label: "所有資料" },
        ]}
      />
      {tab === "users" ? <UsersTab /> : <DataTab />}
    </>
  );
}

/* ---------------- 共用：呼叫後台 API ---------------- */
async function call<T>(url: string, init?: RequestInit & { code?: string }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.code !== undefined ? { "x-verify-code": encodeURIComponent(init.code) } : {}),
    },
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error ?? `HTTP ${res.status}`), { status: res.status, data });
  return data as T;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/* ---------------- 使用者管理 ---------------- */
type User = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  active: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

const fmtTime = (s: string | null) => (s ? new Date(s).toLocaleString("zh-TW", { hour12: false }) : "—");

function UsersTab() {
  const me = useMe();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [resetting, setResetting] = useState<User | null>(null);

  useEffect(() => {
    call<User[]>("/api/admin/users").then(setUsers, (e) => setError(errMsg(e)));
  }, []);

  async function patch(u: User, body: Partial<User> & { password?: string }) {
    try {
      const saved = await call<User>(`/api/admin/users/${u.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setUsers((list) => list?.map((x) => (x.id === saved.id ? saved : x)) ?? null);
      return true;
    } catch (e) {
      alert(`修改失敗：${errMsg(e)}`);
      return false;
    }
  }

  async function del(u: User) {
    if (!confirmDelete(`使用者 ${u.email}`)) return;
    try {
      await call(`/api/admin/users/${u.id}`, { method: "DELETE" });
      setUsers((list) => list?.filter((x) => x.id !== u.id) ?? null);
    } catch (e) {
      alert(`刪除失敗：${errMsg(e)}`);
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-stone-500">
          管理者可以新增、修改、刪除資料並進入後台；一般使用者登入後只能檢視。沒有註冊頁，帳號都從這裡建立。
        </p>
        <Button onClick={() => setAdding(true)}>
          <Plus size={16} /> 新增使用者
        </Button>
      </div>
      {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <Table head={["Email", "名稱", "身分", "狀態", "最後登入", "建立時間", ""]}>
        {users?.map((u) => {
          const self = u.id === me?.id;
          return (
            <tr key={u.id} className="hover:bg-stone-50">
              <Td className="font-medium text-stone-900">
                {u.email} {self && <Badge tone="green">我</Badge>}
              </Td>
              <Td>
                <Input
                  defaultValue={u.name}
                  placeholder="（未填）"
                  className="min-w-28"
                  onBlur={(e) => e.target.value !== u.name && void patch(u, { name: e.target.value })}
                />
              </Td>
              <Td>
                <Select
                  value={u.role}
                  disabled={self}
                  className="min-w-32"
                  title={self ? "不能變更自己的身分" : undefined}
                  onChange={(e) => void patch(u, { role: e.target.value as User["role"] })}
                >
                  <option value="admin">管理者</option>
                  <option value="user">一般使用者</option>
                </Select>
              </Td>
              <Td>
                <label className={`flex items-center gap-2 whitespace-nowrap ${self ? "opacity-50" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    checked={u.active}
                    disabled={self}
                    onChange={(e) => void patch(u, { active: e.target.checked })}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  {u.active ? "啟用" : <span className="text-red-600">停用</span>}
                </label>
              </Td>
              <Td className="whitespace-nowrap text-stone-500">{fmtTime(u.lastLoginAt)}</Td>
              <Td className="whitespace-nowrap text-stone-500">{fmtTime(u.createdAt)}</Td>
              <Td className="whitespace-nowrap text-right">
                <Button size="sm" variant="ghost" onClick={() => setResetting(u)} title="重設密碼">
                  <KeyRound size={14} /> 重設密碼
                </Button>
                {!self && (
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => void del(u)} title="刪除">
                    <Trash2 size={14} />
                  </Button>
                )}
              </Td>
            </tr>
          );
        })}
        {users === null && !error && (
          <tr>
            <Td colSpan={7} className="py-8 text-center text-stone-400">載入中…</Td>
          </tr>
        )}
      </Table>
      {adding && (
        <AddUserModal
          onClose={() => setAdding(false)}
          onAdded={(u) => setUsers((list) => [...(list ?? []), u])}
        />
      )}
      {resetting && (
        <PasswordModal
          user={resetting}
          onClose={() => setResetting(null)}
          onSave={(password) => patch(resetting, { password })}
        />
      )}
    </>
  );
}

function AddUserModal({ onClose, onAdded }: { onClose: () => void; onAdded: (u: User) => void }) {
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "user" as User["role"] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      onAdded(await call<User>("/api/admin/users", { method: "POST", body: JSON.stringify(form) }));
      onClose();
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="新增使用者"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button type="submit" form="add-user" disabled={busy}>{busy ? "建立中…" : "建立"}</Button>
        </>
      }
    >
      <form id="add-user" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" className="sm:col-span-2">
          <Input type="email" required autoFocus value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        </Field>
        <Field label="名稱">
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例：阿明" />
        </Field>
        <Field label="身分">
          <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as User["role"] })}>
            <option value="user">一般使用者（只能看）</option>
            <option value="admin">管理者</option>
          </Select>
        </Field>
        <Field label="密碼（至少 8 個字元）" className="sm:col-span-2">
          <Input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </Field>
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{error}</p>}
      </form>
    </Modal>
  );
}

function PasswordModal({ user, onClose, onSave }: { user: User; onClose: () => void; onSave: (p: string) => Promise<boolean> }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    if (await onSave(password)) onClose();
    else setBusy(false);
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`重設密碼：${user.email}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button type="submit" form="reset-password" disabled={busy}>{busy ? "儲存中…" : "儲存新密碼"}</Button>
        </>
      }
    >
      <form id="reset-password" onSubmit={submit}>
        <Field label="新密碼（至少 8 個字元）">
          <Input
            type="password"
            required
            minLength={8}
            autoFocus
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}

/* ---------------- 所有資料 ---------------- */
type Coll = keyof DB;
type Doc = { id: string } & Record<string, unknown>;

const COLL_LABEL: Record<Coll, string> = {
  orchards: "果園",
  bills: "水電費",
  employees: "員工",
  workers: "外請工人",
  suppliers: "貨源店家",
  materials: "資材（農藥／肥料／包材）",
  stock: "庫存異動（進貨／盤點／報廢）",
  bagging: "套袋紀錄",
  harvests: "採收紀錄",
  fertilizing: "施肥紀錄",
  spraying: "噴藥紀錄",
  labor: "剪枝／砍草紀錄",
  tasks: "工作指派",
  salaries: "薪資",
  bonuses: "分紅",
};

/** 列表上顯示的簡短說明：挑名稱、日期這類最好認的欄位 */
function summary(d: Doc) {
  const pick = ["nameZh", "name", "title", "kind", "category", "month", "datetime", "start", "date", "fruit"];
  return pick
    .map((k) => d[k])
    .filter((v) => typeof v === "string" && v)
    .slice(0, 3)
    .join("・");
}

function DataTab() {
  const db = useDB();
  const [coll, setColl] = useState<Coll>("orchards");
  const [q, setQ] = useState("");
  const [viewing, setViewing] = useState<Doc | null>(null);
  const [codeFor, setCodeFor] = useState<Doc | null>(null);

  const docs = db[coll] as unknown as Doc[];
  const list = q ? docs.filter((d) => JSON.stringify(d).toLowerCase().includes(q.toLowerCase())) : docs;

  /**
   * 刪除一筆：需要驗證碼的集合（貨源店家、資材、噴藥、施肥）會先跳出驗證碼對話框；
   * 果園底下還有紀錄時，會再確認是否一併刪除。
   */
  async function del(d: Doc, code?: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const url = `/api/${coll}/${encodeURIComponent(d.id)}`;
    try {
      await call(url, { method: "DELETE", code });
    } catch (e) {
      const err = e as Error & { status?: number; data?: { needsCascade?: boolean } };
      if (err.status === 403 && code === undefined) {
        setCodeFor(d);
        return { ok: true };
      }
      if (err.status === 409 && err.data?.needsCascade) {
        if (!confirm(err.message)) return { ok: true };
        try {
          await call(`${url}?cascade=true`, { method: "DELETE", code });
        } catch (e2) {
          return { ok: false, error: errMsg(e2) };
        }
      } else {
        return { ok: false, error: err.message };
      }
    }
    setViewing(null);
    await reload();
    return { ok: true };
  }

  async function confirmAndDelete(d: Doc) {
    if (!confirmDelete(`「${summary(d) || d.id}」`)) return;
    const res = await del(d);
    if (!res.ok) alert(`刪除失敗：${res.error}`);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <section className="h-fit rounded-xl border border-stone-200 bg-white p-2 shadow-sm">
        <nav className="flex flex-col">
          {(Object.keys(COLL_LABEL) as Coll[]).map((c) => (
            <button
              key={c}
              onClick={() => {
                setColl(c);
                setQ("");
              }}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                c === coll ? "bg-emerald-700 font-medium text-white" : "text-stone-700 hover:bg-stone-100"
              }`}
            >
              <span>{COLL_LABEL[c]}</span>
              <span className={`tabular-nums ${c === coll ? "text-emerald-100" : "text-stone-400"}`}>{db[c].length}</span>
            </button>
          ))}
        </nav>
      </section>

      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-stone-900">
            {COLL_LABEL[coll]} <span className="text-sm font-normal text-stone-500">（{coll}，共 {list.length} 筆）</span>
          </h2>
          <div className="relative w-full max-w-xs">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋任何欄位內容" className="pl-9" />
          </div>
        </div>
        <Table head={["ID", "說明", "欄位數", ""]}>
          {list.map((d) => (
            <tr key={d.id} className="hover:bg-stone-50">
              <Td className="font-mono text-xs text-stone-500">{d.id}</Td>
              <Td className="text-stone-800">{summary(d) || <span className="text-stone-400">—</span>}</Td>
              <Td className="text-stone-500">{Object.keys(d).length}</Td>
              <Td className="whitespace-nowrap text-right">
                <Button size="sm" variant="ghost" onClick={() => setViewing(d)} title="檢視原始資料">
                  <Eye size={14} /> 檢視
                </Button>
                <Button size="sm" variant="ghost" className="text-red-600" onClick={() => void confirmAndDelete(d)} title="刪除">
                  <Trash2 size={14} />
                </Button>
              </Td>
            </tr>
          ))}
          {!list.length && (
            <tr>
              <Td colSpan={4} className="py-8 text-center text-stone-400">{q ? "沒有符合的資料" : "這個集合沒有資料"}</Td>
            </tr>
          )}
        </Table>
        <p className="mt-3 text-xs text-stone-500">要修改內容請到各功能頁面編輯；這裡只提供檢視與刪除。</p>
      </div>

      {viewing && (
        <Modal
          open
          wide
          onClose={() => setViewing(null)}
          title={`${COLL_LABEL[coll]}：${summary(viewing) || viewing.id}`}
          footer={
            <>
              <Button variant="danger" className="mr-auto" onClick={() => void confirmAndDelete(viewing)}>
                <Trash2 size={15} /> 刪除這筆
              </Button>
              <Button variant="secondary" onClick={() => setViewing(null)}>關閉</Button>
            </>
          }
        >
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-white p-4 font-mono text-xs text-stone-800 ring-1 ring-stone-200">
            {JSON.stringify(viewing, null, 2)}
          </pre>
        </Modal>
      )}

      {codeFor && (
        <CodeModal
          title="刪除需要驗證碼"
          confirmLabel="確認刪除"
          danger
          onClose={() => setCodeFor(null)}
          onSubmit={async (code) => {
            const res = await del(codeFor, code);
            if (res.ok) setCodeFor(null);
            return res;
          }}
        >
          「{summary(codeFor) || codeFor.id}」屬於需要驗證碼的資料，請輸入驗證碼才能刪除。
        </CodeModal>
      )}
    </div>
  );
}
