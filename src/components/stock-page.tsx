"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ClipboardCheck, PackagePlus, Search, Trash, Trash2, Pencil } from "lucide-react";
import { removeWithCode, upsert, useCanEdit, useDB, verifyCode } from "@/lib/store";
import {
  EXPIRY_WARN_DAYS,
  MOVE_LABEL,
  baseUnit,
  emptyTxn,
  fmtQty,
  packSize,
  packWord,
  stockInfo,
  type Batch,
  type MoveKind,
  type StockInfo,
} from "@/lib/stock";
import type { Material, MaterialCategory, StockKind, StockTxn } from "@/lib/types";
import { fmtDT, materialName, money, nowStr, uid } from "@/lib/utils";
import { CodeModal } from "./code-modal";
import {
  Badge,
  Button,
  Field,
  Input,
  Modal,
  NumInput,
  PageHeader,
  SectionTitle,
  Select,
  StatCard,
  Table,
  Tabs,
  Td,
  Textarea,
  Thumb,
  type Tone,
} from "./ui";

type Tab = "all" | MaterialCategory;

const CAT_LABEL: Record<MaterialCategory, string> = { pesticide: "農藥", fertilizer: "肥料", packaging: "包材／乾貨" };
const CAT_HREF: Record<MaterialCategory, string> = {
  pesticide: "/materials/pesticides",
  fertilizer: "/materials/fertilizers",
  packaging: "/materials/packaging",
};
const CAT_ORDER: MaterialCategory[] = ["pesticide", "fertilizer", "packaging"];

const KIND_TONE: Record<MoveKind, Tone> = {
  purchase: "green",
  count: "blue",
  scrap: "red",
  spraying: "amber",
  fertilizing: "amber",
  bagging: "amber",
  bagReturn: "gray",
};

const STATUS: Record<StockInfo["status"], { label: string; tone: Tone }> = {
  untracked: { label: "尚未盤點", tone: "gray" },
  negative: { label: "數量異常", tone: "red" },
  low: { label: "不足", tone: "red" },
  ok: { label: "充足", tone: "green" },
  unset: { label: "未設安全存量", tone: "gray" },
};

/** 進貨／盤點／報廢要先輸入驗證碼（同一類資材的驗證碼），這個頁面開著時不用重複輸入 */
type Gate = { category: MaterialCategory; title: string; desc: React.ReactNode; then: (code: string) => void };

export function StockPage() {
  const db = useDB();
  const canEdit = useCanEdit();
  const info = useMemo(() => stockInfo(db), [db]);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [only, setOnly] = useState<"" | "low" | "expiring">("");
  const [codes, setCodes] = useState<Partial<Record<MaterialCategory, string>>>({});
  const [gate, setGate] = useState<Gate | null>(null);
  const [form, setForm] = useState<{ txn: StockTxn; code: string } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [bulk, setBulk] = useState<{ category: MaterialCategory; code: string } | null>(null);
  const [deleting, setDeleting] = useState<StockTxn | null>(null);

  function withCode(category: MaterialCategory, title: string, desc: React.ReactNode, then: (code: string) => void) {
    const known = codes[category];
    if (known) then(known);
    else setGate({ category, title, desc, then });
  }

  const openTxn = (txn: StockTxn) => {
    const m = db.materials.find((x) => x.id === txn.materialId);
    const isNew = !db.stock.some((x) => x.id === txn.id);
    const title = `${isNew ? "" : "修改"}${STOCK_TITLE[txn.kind]}`;
    withCode(txn.category, title, <>「<b>{m?.nameZh}</b>」{title}需要{CAT_LABEL[txn.category]}的驗證碼。</>, (code) =>
      setForm({ txn: isNew ? { ...txn, id: txn.id || uid() } : txn, code }),
    );
  };
  const startTxn = (m: Material, kind: StockKind) => openTxn(emptyTxn(m, kind));

  const inTab = db.materials
    .filter((m) => tab === "all" || m.category === tab)
    .sort(
      (a, b) =>
        CAT_ORDER.indexOf(a.category) - CAT_ORDER.indexOf(b.category) || a.nameZh.localeCompare(b.nameZh, "zh-Hant"),
    );
  const infos = inTab.map((m) => info.get(m.id)!).filter(Boolean);
  const isLow = (s: StockInfo) => s.status === "low" || s.status === "negative";
  const list = infos
    .filter((s) => !q || `${s.m.nameZh}${s.m.nameEn}`.toLowerCase().includes(q.toLowerCase()))
    .filter((s) => (only === "low" ? isLow(s) : only === "expiring" ? s.expiring.length > 0 : true));

  const totalValue = infos.reduce((s, x) => s + x.value, 0);
  const lowCount = infos.filter(isLow).length;
  const expiringCount = infos.filter((s) => s.expiring.length > 0).length;
  const untracked = infos.filter((s) => s.status === "untracked").length;
  const count = (c: Tab) => (c === "all" ? db.materials.length : db.materials.filter((m) => m.category === c).length);
  const detail = detailId ? info.get(detailId) : undefined;

  return (
    <>
      <PageHeader
        title="庫存數量"
        desc="進貨、盤點、報廢在這裡登記；噴藥、施肥、套袋紀錄的用量會自動扣除。"
        action={
          tab !== "all" && (
            <Button
              variant="secondary"
              onClick={() =>
                withCode(tab, "批次盤點", <>盤點{CAT_LABEL[tab]}需要驗證碼。</>, (code) => setBulk({ category: tab, code }))
              }
            >
              <ClipboardCheck size={16} /> 批次盤點{CAT_LABEL[tab]}
            </Button>
          )
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="品項數"
          value={infos.length}
          sub={untracked ? `其中 ${untracked} 項尚未盤點` : tab === "all" ? "農藥＋肥料＋包材" : CAT_LABEL[tab]}
        />
        <StatCard label="庫存總價值" value={money(totalValue)} sub="依各資材目前單價計算" />
        <StatCard
          label="存量不足"
          value={<span className={lowCount ? "text-red-600" : ""}>{lowCount}</span>}
          sub="低於安全存量或數量異常"
        />
        <StatCard
          label="即將到期"
          value={<span className={expiringCount ? "text-amber-600" : ""}>{expiringCount}</span>}
          sub={`${EXPIRY_WARN_DAYS} 天內到期或已過期`}
        />
      </div>

      <Tabs
        tabs={[
          { value: "all" as Tab, label: `全部（${count("all")}）` },
          ...CAT_ORDER.map((c) => ({ value: c as Tab, label: `${CAT_LABEL[c]}（${count(c)}）` })),
        ]}
        value={tab}
        onChange={setTab}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={16} className="absolute left-3 top-2.5 text-stone-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋名稱" className="pl-9" />
        </div>
        <div className="flex rounded-lg border border-stone-300 bg-white p-0.5 text-sm" role="group" aria-label="篩選">
          {(
            [
              ["", "全部"],
              ["low", `存量不足（${lowCount}）`],
              ["expiring", `即將到期（${expiringCount}）`],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              aria-pressed={only === v}
              onClick={() => setOnly(v)}
              className={`rounded-md px-3 py-1 ${only === v ? "bg-emerald-700 text-white" : "text-stone-600 hover:bg-stone-100"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Table head={["", "名稱", "目前庫存", "安全存量", "狀態", "近 90 天用量", "預估可用", "最近到期", "庫存價值", ""]}>
        {list.map((s) => {
          const m = s.m;
          const next = s.batches.find((b) => b.days !== Infinity);
          return (
            <tr key={m.id} className="hover:bg-stone-50">
              <Td>
                <Thumb src={m.photos?.[0]} photos={m.photos} showCount />
              </Td>
              <Td className="min-w-44 text-stone-700">
                <button type="button" onClick={() => setDetailId(m.id)} className="text-left font-medium text-emerald-800 hover:underline">
                  {m.nameZh}
                </button>
                <div className="text-xs text-stone-500">
                  {tab === "all" && `${CAT_LABEL[m.category]}・`}
                  {m.size ? `每${packWord(m)} ${m.size}${m.unit === "ml" ? "cc" : m.unit}` : <span className="text-amber-700">未設定容量</span>}
                </div>
              </Td>
              <Td className={`whitespace-nowrap font-semibold ${s.onHand < 0 ? "text-red-600" : "text-stone-900"}`}>
                {s.status === "untracked" ? <span className="font-normal text-stone-400">—</span> : fmtQty(m, s.onHand)}
                {s.planned > 0 && <div className="text-xs font-normal text-stone-500">已排定用量 {fmtQty(m, s.planned)}</div>}
              </Td>
              <Td className="whitespace-nowrap">{m.minStock ? `${m.minStock} ${packWord(m)}` : "—"}</Td>
              <Td>
                <Badge tone={STATUS[s.status].tone}>{STATUS[s.status].label}</Badge>
              </Td>
              <Td className="whitespace-nowrap">{s.usage90 ? fmtQty(m, s.usage90) : "—"}</Td>
              <Td className="whitespace-nowrap">{daysLeftText(s.daysLeft)}</Td>
              <Td className="whitespace-nowrap">{next ? <ExpiryText b={next} /> : "—"}</Td>
              <Td className="whitespace-nowrap">{money(s.value)}</Td>
              <Td>
                {canEdit && (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="secondary" onClick={() => startTxn(m, "purchase")} title="進貨">
                      <PackagePlus size={14} /> 進貨
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => startTxn(m, "count")} title="盤點">
                      <ClipboardCheck size={14} /> 盤點
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => startTxn(m, "scrap")} title="報廢">
                      <Trash size={14} />
                    </Button>
                  </div>
                )}
              </Td>
            </tr>
          );
        })}
        {!list.length && (
          <tr>
            <Td colSpan={10} className="py-8 text-center text-stone-400">
              {inTab.length ? "沒有符合篩選條件的資料" : "還沒有資材，請先到農藥／肥料／包材頁面新增"}
            </Td>
          </tr>
        )}
      </Table>

      {/* 後面的對話框疊在前面的上面：明細 → 表單 → 驗證碼 */}
      {detail && (
        <DetailModal
          s={detail}
          onClose={() => setDetailId(null)}
          onTxn={(kind) => startTxn(detail.m, kind)}
          onEdit={openTxn}
          onDelete={setDeleting}
          withCode={withCode}
        />
      )}
      {form && <TxnModal txn={form.txn} code={form.code} info={info.get(form.txn.materialId)} onClose={() => setForm(null)} />}
      {bulk && <BulkCountModal category={bulk.category} code={bulk.code} info={info} onClose={() => setBulk(null)} />}
      {gate && (
        <CodeModal
          title={gate.title}
          confirmLabel="下一步"
          onClose={() => setGate(null)}
          onSubmit={async (c) => {
            const res = await verifyCode("stock", "create", c, gate.category);
            if (res.ok) {
              setCodes((p) => ({ ...p, [gate.category]: c }));
              setGate(null);
              gate.then(c);
            }
            return res;
          }}
        >
          {gate.desc}
        </CodeModal>
      )}
      {deleting && (
        <CodeModal
          title={`刪除${STOCK_TITLE[deleting.kind]}`}
          confirmLabel="確認刪除"
          danger
          onClose={() => setDeleting(null)}
          onSubmit={async (c) => {
            const res = await removeWithCode("stock", deleting.id, c);
            if (res.ok) setDeleting(null);
            return res;
          }}
        >
          即將刪除 <b>{fmtDT(deleting.datetime)}</b> 的{STOCK_TITLE[deleting.kind]}，庫存會重新計算，無法復原。
        </CodeModal>
      )}
    </>
  );
}

const STOCK_TITLE: Record<StockKind, string> = { purchase: "進貨", count: "盤點", scrap: "報廢" };

function daysLeftText(d: number | null) {
  if (d === null) return "—";
  if (d < 30) return <span className="font-medium text-red-600">約 {d} 天</span>;
  if (d < 365) return `約 ${Math.round(d / 30)} 個月`;
  return "1 年以上";
}

function ExpiryText({ b }: { b: Batch }) {
  const cls = b.days < 0 ? "font-semibold text-red-600" : b.days <= EXPIRY_WARN_DAYS ? "font-medium text-amber-600" : "";
  return (
    <span className={cls}>
      {b.txn.expiry}
      {b.days < 0 ? "（已過期）" : b.days <= EXPIRY_WARN_DAYS ? `（${b.days} 天）` : ""}
    </span>
  );
}

/** 數量輸入：幾瓶／包 ＋ 零散的 cc／g／片，回傳基本單位 */
function QtyInput({ m, value, onChange }: { m: Material; value: number; onChange: (v: number) => void }) {
  const ps = packSize(m);
  const [packs, setPacks] = useState(() => (ps ? Math.floor(value / ps + 1e-9) : 0));
  const [loose, setLoose] = useState(() => Math.round((ps ? value - Math.floor(value / ps + 1e-9) * ps : value) * 100) / 100);
  if (!ps) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <NumInput step="any" value={value} onChange={onChange} />
          <span className="shrink-0 text-sm text-stone-600">{baseUnit(m)}</span>
        </div>
        <p className="text-xs text-amber-700">
          這項資材還沒設定每{packWord(m)}容量，只能用 {baseUnit(m)} 輸入。可到
          <Link href={CAT_HREF[m.category]} className="mx-1 underline">{CAT_LABEL[m.category]}</Link>頁面補上。
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <NumInput
        step="any"
        value={packs}
        onChange={(v) => {
          setPacks(v);
          onChange(v * ps + loose);
        }}
      />
      <span className="shrink-0 text-sm text-stone-600">{packWord(m)}</span>
      <span className="shrink-0 text-stone-400">＋</span>
      <NumInput
        step="any"
        value={loose}
        onChange={(v) => {
          setLoose(v);
          onChange(packs * ps + v);
        }}
      />
      <span className="shrink-0 text-sm text-stone-600">{baseUnit(m)}</span>
    </div>
  );
}

function TxnModal({ txn, code, info, onClose }: { txn: StockTxn; code: string; info?: StockInfo; onClose: () => void }) {
  const db = useDB();
  const m = db.materials.find((x) => x.id === txn.materialId);
  const isNew = !db.stock.some((x) => x.id === txn.id);
  const [t, setT] = useState(txn);
  const set = <K extends keyof StockTxn>(k: K, v: StockTxn[K]) => setT((p) => ({ ...p, [k]: v }));
  // 進貨金額：沒改過就用「數量 × 目前單價」
  const [priceTouched, setPriceTouched] = useState(!isNew);
  if (!m) return null;
  const ps = packSize(m);
  const autoPrice = ps ? Math.round((t.qty / ps) * m.price) : 0;
  const price = priceTouched ? t.price : autoPrice;
  const title = `${isNew ? "" : "修改"}${STOCK_TITLE[t.kind]}：${m.nameZh}`;
  // 盤點：前 14 天內、上一次進貨／盤點之後的用量，會因為這次盤點而不扣
  const prevTxn = info?.moves.filter((mv) => mv.txn && mv.txn.id !== t.id && mv.datetime < t.datetime).pop();
  const since = new Date(new Date(t.datetime).getTime() - 14 * 86400000).toISOString().slice(0, 16);
  const skipped =
    t.kind === "count" && t.datetime
      ? (info?.moves ?? []).filter(
          (mv) =>
            !mv.txn && mv.qty < 0 && mv.datetime < t.datetime && mv.datetime >= since &&
            (!prevTxn || mv.datetime > prevTxn.datetime),
        )
      : [];

  function save() {
    if (!t.datetime) return alert("請填寫日期");
    if (t.kind !== "count" && t.qty <= 0) return alert("請填寫數量");
    upsert("stock", { ...t, price: t.kind === "purchase" ? price : 0 }, { code });
    onClose();
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={save}>儲存</Button>
        </>
      }
    >
      <div className="space-y-4">
        {info && (
          <p className="rounded-lg bg-stone-100 px-3 py-2 text-sm text-stone-600">
            目前庫存 <b className="text-stone-900">{info.status === "untracked" ? "尚未盤點" : fmtQty(m, info.onHand)}</b>
          </p>
        )}
        <Field label={t.kind === "purchase" ? "進貨日期時間" : t.kind === "count" ? "盤點日期時間" : "報廢日期時間"}>
          <Input type="datetime-local" value={t.datetime} max={nowStr()} onChange={(e) => set("datetime", e.target.value)} />
        </Field>
        <Field
          label={t.kind === "purchase" ? "進貨數量" : t.kind === "count" ? "實際清點的數量" : "報廢數量"}
          hint={
            t.kind === "count" && isNew && info && info.status !== "untracked"
              ? `差額 ${t.qty - info.onHand >= 0 ? "+" : ""}${fmtQty(m, t.qty - info.onHand)}；儲存後庫存會改成這個數量，之後的用量再從這裡扣。`
              : undefined
          }
        >
          <QtyInput m={m} value={t.qty} onChange={(v) => set("qty", v)} />
        </Field>
        {skipped.length > 0 && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <div className="flex items-center gap-1 font-medium">
              <AlertTriangle size={14} /> 盤點時間之前的這些用量不會扣（視為已包含在清點的數量裡）：
            </div>
            <ul className="mt-1 list-disc pl-5">
              {skipped.map((mv) => (
                <li key={mv.key}>
                  {fmtDT(mv.datetime)} {MOVE_LABEL[mv.kind]} {fmtQty(m, mv.qty)}（{mv.label}）
                </li>
              ))}
            </ul>
            <div className="mt-1">如果清點的是用掉之前的數量，請把盤點時間改到這些紀錄之前。</div>
          </div>
        )}

        {t.kind === "purchase" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="進貨金額（元）" hint={!priceTouched && m.price ? `依目前單價 ${money(m.price)} 自動計算，可修改` : undefined}>
                <NumInput
                  value={price}
                  onChange={(v) => {
                    setPriceTouched(true);
                    set("price", v);
                  }}
                />
              </Field>
              <Field label="購買地">
                <Select value={t.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
                  <option value="">（未指定）</option>
                  {db.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="有效期限">
                <Input type="date" value={t.expiry} onChange={(e) => set("expiry", e.target.value)} />
              </Field>
              <Field label="批號">
                <Input value={t.batch} onChange={(e) => set("batch", e.target.value)} />
              </Field>
            </div>
          </>
        )}
        <Field label={t.kind === "scrap" ? "報廢原因" : "備註"}>
          <Textarea
            rows={2}
            value={t.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder={t.kind === "scrap" ? "例：過期、破損、受潮" : undefined}
          />
        </Field>
      </div>
    </Modal>
  );
}

function DetailModal({
  s,
  onClose,
  onTxn,
  onEdit,
  onDelete,
  withCode,
}: {
  s: StockInfo;
  onClose: () => void;
  onTxn: (kind: StockKind) => void;
  onEdit: (t: StockTxn) => void;
  onDelete: (t: StockTxn) => void;
  withCode: (category: MaterialCategory, title: string, desc: React.ReactNode, then: (code: string) => void) => void;
}) {
  const db = useDB();
  const canEdit = useCanEdit();
  const m = s.m;
  const [minStock, setMinStock] = useState(m.minStock ?? 0);
  const [showAll, setShowAll] = useState(false);
  const moves = [...s.moves].reverse();
  const shown = showAll ? moves : moves.slice(0, 50);
  const supplier = (id: string) => db.suppliers.find((x) => x.id === id)?.name;

  function saveMin() {
    withCode(m.category, "修改安全存量", <>修改「<b>{m.nameZh}</b>」的安全存量需要驗證碼。</>, (code) =>
      upsert("materials", { ...m, minStock }, { code }),
    );
  }

  return (
    <Modal open wide onClose={onClose} title={`${materialName(m)}・庫存明細`}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="目前庫存"
          value={
            s.status === "untracked" ? "尚未盤點" : <span className={s.onHand < 0 ? "text-red-600" : ""}>{fmtQty(m, s.onHand)}</span>
          }
        />
        <StatCard label="庫存價值" value={money(s.value)} />
        <StatCard label="近 90 天用量" value={s.usage90 ? fmtQty(m, s.usage90) : "—"} />
        <StatCard label="預估可用" value={daysLeftText(s.daysLeft)} sub={s.planned > 0 ? `已排定用量 ${fmtQty(m, s.planned)}` : undefined} />
      </div>
      {s.status === "untracked" && (
        <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-800">
          還不知道實際數量。請先「盤點」輸入目前倉庫裡的數量（或登記一筆進貨），之後噴藥、施肥、套袋的用量才會從這裡開始扣。
        </p>
      )}
      {s.onHand < 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={16} className="shrink-0" />
          庫存算出來是負數，可能有進貨沒登記。請登記進貨，或盤點一次把數量改成實際的數量。
        </p>
      )}

      {canEdit && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label={`安全存量（${packWord(m)}）`} hint="低於這個數量時顯示「不足」，0＝不提醒">
            <div className="flex gap-2">
              <NumInput step="any" value={minStock} onChange={setMinStock} className="!w-28" />
              <Button variant="secondary" onClick={saveMin} disabled={minStock === (m.minStock ?? 0)}>儲存</Button>
            </div>
          </Field>
          <div className="ml-auto flex gap-2 pb-5">
            <Button size="sm" onClick={() => onTxn("purchase")}><PackagePlus size={14} /> 進貨</Button>
            <Button size="sm" variant="secondary" onClick={() => onTxn("count")}><ClipboardCheck size={14} /> 盤點</Button>
            <Button size="sm" variant="secondary" className="text-red-600" onClick={() => onTxn("scrap")}><Trash size={14} /> 報廢</Button>
          </div>
        </div>
      )}

      {s.batches.length > 0 && (
        <>
          <SectionTitle>目前庫存的進貨批次（先過期的先用）</SectionTitle>
          <Table head={["進貨日期", "批號", "有效期限", "剩餘"]}>
            {s.batches.map((b) => (
              <tr key={b.txn.id}>
                <Td>{b.txn.datetime.slice(0, 10)}</Td>
                <Td>{b.txn.batch || "—"}</Td>
                <Td>{b.txn.expiry ? <ExpiryText b={b} /> : "—"}</Td>
                <Td className="font-medium">{fmtQty(m, b.remaining)}</Td>
              </tr>
            ))}
          </Table>
        </>
      )}

      <SectionTitle>異動明細</SectionTitle>
      <Table head={["日期時間", "類型", "增減", "結存", "說明", ""]}>
        {shown.map((mv) => {
          const t = mv.txn;
          return (
            <tr key={mv.key} className={mv.future || mv.before ? "bg-stone-50 opacity-60" : ""}>
              <Td className="whitespace-nowrap">{fmtDT(mv.datetime)}</Td>
              <Td>
                <Badge tone={KIND_TONE[mv.kind]}>{MOVE_LABEL[mv.kind]}</Badge>
                {mv.future && <div className="mt-1 text-xs text-stone-500">未來（還沒扣）</div>}
                {mv.before && <div className="mt-1 text-xs text-stone-500">開始記庫存前，不扣</div>}
              </Td>
              <Td className={`whitespace-nowrap font-medium ${mv.delta < 0 ? "text-red-600" : "text-emerald-700"}`}>
                {mv.kind === "count" && <div className="text-xs font-normal text-stone-500">清點 {fmtQty(m, mv.qty)}</div>}
                {mv.delta > 0 ? "+" : ""}
                {fmtQty(m, mv.delta)}
              </Td>
              <Td className="whitespace-nowrap">{mv.future || mv.before ? "—" : fmtQty(m, mv.balance)}</Td>
              <Td>
                {mv.href ? (
                  <Link href={mv.href} className="text-emerald-700 hover:underline">{mv.label}</Link>
                ) : (
                  <div className="space-y-0.5 text-sm">
                    {t?.kind === "purchase" && (
                      <div>
                        {money(t.price)}
                        {t.supplierId && supplier(t.supplierId) && `・${supplier(t.supplierId)}`}
                        {t.batch && `・批號 ${t.batch}`}
                        {t.expiry && `・期限 ${t.expiry}`}
                      </div>
                    )}
                    {mv.label && <div className="text-stone-500">{mv.label}</div>}
                  </div>
                )}
              </Td>
              <Td>
                {t && canEdit && (
                  <div className="flex justify-end">
                    <Button size="sm" variant="ghost" onClick={() => onEdit(t)} title="編輯"><Pencil size={14} /></Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => onDelete(t)} title="刪除">
                      <Trash2 size={14} />
                    </Button>
                  </div>
                )}
              </Td>
            </tr>
          );
        })}
        {!moves.length && (
          <tr>
            <Td colSpan={6} className="py-6 text-center text-stone-400">還沒有任何進出紀錄。第一次使用請先「盤點」輸入目前的實際數量。</Td>
          </tr>
        )}
      </Table>
      {moves.length > shown.length && (
        <Button variant="ghost" className="mt-2 text-emerald-700" onClick={() => setShowAll(true)}>
          顯示全部 {moves.length} 筆
        </Button>
      )}
    </Modal>
  );
}

/** 一次盤點同一類的所有資材：有填數量的才會產生盤點紀錄 */
function BulkCountModal({
  category,
  code,
  info,
  onClose,
}: {
  category: MaterialCategory;
  code: string;
  info: Map<string, StockInfo>;
  onClose: () => void;
}) {
  const db = useDB();
  const [datetime, setDatetime] = useState(nowStr());
  const [counted, setCounted] = useState<Record<string, number>>({});
  // 按「不盤點」時讓輸入框重新建立，清掉裡面的數字
  const [resets, setResets] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const items = db.materials
    .filter((m) => m.category === category)
    .sort((a, b) => a.nameZh.localeCompare(b.nameZh, "zh-Hant"));
  const filled = Object.keys(counted).length;

  async function save() {
    if (!filled) return alert("請至少填一項實際數量");
    setBusy(true);
    for (const [materialId, qty] of Object.entries(counted)) {
      const m = db.materials.find((x) => x.id === materialId);
      if (m) await upsert("stock", { ...emptyTxn(m, "count"), id: uid(), datetime, qty, note: "批次盤點" }, { code });
    }
    setBusy(false);
    onClose();
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`批次盤點：${CAT_LABEL[category]}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={save} disabled={busy}>{busy ? "儲存中…" : `儲存 ${filled} 項`}</Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <Field label="盤點日期時間">
          <Input type="datetime-local" value={datetime} max={nowStr()} onChange={(e) => setDatetime(e.target.value)} />
        </Field>
        <p className="pb-2 text-sm text-stone-500">只填有清點的項目；沒填的不會改變。數量 0 也要填 0。</p>
      </div>
      <div className="space-y-2">
        {items.map((m) => {
          const s = info.get(m.id);
          const has = m.id in counted;
          return (
            <div key={m.id} className={`grid items-center gap-2 rounded-lg p-2 sm:grid-cols-[1.2fr_1fr_2fr] ${has ? "bg-emerald-50" : "bg-white"}`}>
              <div className="font-medium">{m.nameZh}</div>
              <div className="text-sm text-stone-500">
                系統：{!s || s.status === "untracked" ? "尚未盤點" : fmtQty(m, s.onHand)}
                {has && s && s.status !== "untracked" && (
                  <span className={counted[m.id] - s.onHand < 0 ? "ml-2 text-red-600" : "ml-2 text-emerald-700"}>
                    （{counted[m.id] - s.onHand >= 0 ? "+" : ""}
                    {fmtQty(m, counted[m.id] - s.onHand)}）
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <QtyInput
                  key={resets[m.id] ?? 0}
                  m={m}
                  value={counted[m.id] ?? 0}
                  onChange={(v) => setCounted((p) => ({ ...p, [m.id]: v }))}
                />
                {has && (
                  <button
                    type="button"
                    className="shrink-0 text-xs text-stone-500 underline"
                    onClick={() => {
                      setCounted((p) => {
                        const next = { ...p };
                        delete next[m.id];
                        return next;
                      });
                      setResets((p) => ({ ...p, [m.id]: (p[m.id] ?? 0) + 1 }));
                    }}
                  >
                    不盤點
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
