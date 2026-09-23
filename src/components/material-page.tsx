"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, History, Plus, Search } from "lucide-react";
import { remove, removeWithCode, upsert, useDB, verifyCode } from "@/lib/store";
import type { Material, MaterialCategory, MaterialUnit } from "@/lib/types";
import { UNIT_LABELS, UNIT_SHORT, materialTargetsLabel, money, todayStr, uid } from "@/lib/utils";
import { CodeModal } from "./code-modal";
import {
  Badge,
  Button,
  ChipSelect,
  Field,
  Input,
  Modal,
  NumInput,
  PageHeader,
  PhotoUpload,
  RowActions,
  SectionTitle,
  Select,
  Table,
  Td,
  Thumb,
} from "./ui";

type Meta = {
  title: string;
  units: MaterialUnit[];
  props: string[];
  targetsPlaceholder: string;
  createdLabel: string;
  maxPhotos: number;
  /** 新增／修改／刪除要輸入驗證碼（後端也會檢查） */
  needsCode: boolean;
};

const META: Record<MaterialCategory, Meta> = {
  pesticide: {
    title: "農藥", units: ["ml", "g", "kg"], props: ["殺細菌", "病毒", "殺蟲", "營養補充"],
    targetsPlaceholder: "例：炭疽病、薊馬", createdLabel: "登入時間", maxPhotos: 1, needsCode: false,
  },
  fertilizer: {
    title: "肥料", units: ["ml", "g", "kg"],
    props: ["殺細菌", "病毒", "殺蟲", "營養補充", "顆粒肥", "即溶粉狀肥", "液態肥", "高氮肥", "平均肥", "高鉀肥"],
    targetsPlaceholder: "例：氮 15%、磷 15%、鉀 15%", createdLabel: "登錄時間", maxPhotos: 10, needsCode: true,
  },
  packaging: {
    title: "包材／乾貨", units: ["g", "kg", "片"], props: ["套袋", "包裝", "防潮", "資材"],
    targetsPlaceholder: "", createdLabel: "登入時間", maxPhotos: 1, needsCode: false,
  },
};

export function MaterialPage({ category }: { category: MaterialCategory }) {
  const db = useDB();
  const meta = META[category];
  const targetsLabel = materialTargetsLabel(category);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Material | null>(null);
  // 需要驗證碼的類別：先驗證再打開表單，驗證碼留著儲存時送給後端
  const [gate, setGate] = useState<{ material: Material | null } | null>(null);
  const [deleting, setDeleting] = useState<Material | null>(null);
  const [code, setCode] = useState<string | undefined>();
  // 性質篩選：all＝同時符合所有選取的性質，any＝符合任一個
  const [props, setProps] = useState<string[]>([]);
  const [mode, setMode] = useState<"all" | "any">("all");
  const inCategory = db.materials.filter((m) => m.category === category);
  // 選項：預設選項，加上資料裡實際出現過的其他性質
  const propOptions = [...new Set([...meta.props, ...inCategory.flatMap((m) => m.properties)])];
  const list = inCategory
    .filter((m) => !q || `${m.nameZh}${m.nameEn}${m.targets}`.toLowerCase().includes(q.toLowerCase()))
    .filter((m) => {
      if (!props.length) return true;
      return mode === "all" ? props.every((p) => m.properties.includes(p)) : props.some((p) => m.properties.includes(p));
    });
  const filtered = !!q || props.length > 0;
  const supplier = (id: string) => db.suppliers.find((s) => s.id === id);

  const create = (): Material => ({
    id: uid(), category, nameZh: "", nameEn: "", createdAt: todayStr(), updatedAt: todayStr(),
    unit: meta.units[0], size: 0, price: 0, priceHistory: [], dilution: "", targets: "", properties: [],
    usagePeriod: "", bannedPeriod: "", photos: [], supplierId: db.suppliers[0]?.id ?? "",
  });
  const startCreate = () => (meta.needsCode ? setGate({ material: null }) : setEditing(create()));
  const startEdit = (m: Material) => (meta.needsCode ? setGate({ material: m }) : setEditing(m));

  return (
    <>
      <PageHeader
        title={`${meta.title}（使用方式）`}
        desc="登錄品項、價格、使用比例與禁用時間；修改價格時會保留歷史價格。"
        action={<Button onClick={startCreate}><Plus size={16} /> 新增{meta.title}</Button>}
      />
      <div className="mb-4 space-y-3">
        <div className="relative max-w-sm">
          <Search size={16} className="absolute left-3 top-2.5 text-stone-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`搜尋名稱或${targetsLabel}`} className="pl-9" />
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="篩選性質">
          <span className="text-sm font-medium text-stone-600">性質：</span>
          {propOptions.map((p) => {
            const on = props.includes(p);
            const count = inCategory.filter((m) => m.properties.includes(p)).length;
            return (
              <button
                key={p}
                type="button"
                aria-pressed={on}
                onClick={() => setProps(on ? props.filter((x) => x !== p) : [...props, p])}
                className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                  on
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : count
                      ? "border-stone-300 bg-white text-stone-700 hover:border-emerald-500"
                      : "border-stone-200 bg-white text-stone-400 hover:border-stone-300"
                }`}
              >
                {p}
                <span className={`ml-1 text-xs ${on ? "text-emerald-100" : "text-stone-400"}`}>({count})</span>
              </button>
            );
          })}
        </div>
        {filtered && (
          <div className="flex flex-wrap items-center gap-3 text-sm text-stone-600">
            <span>
              顯示 <b className="text-stone-900">{list.length}</b> / 全部 {inCategory.length} 筆
            </span>
            {props.length > 1 && (
              <div className="flex rounded-lg border border-stone-300 bg-white p-0.5 text-xs" role="group" aria-label="篩選方式">
                {(
                  [
                    ["all", "同時符合"],
                    ["any", "符合任一"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={mode === v}
                    onClick={() => setMode(v)}
                    className={`rounded-md px-2.5 py-1 ${mode === v ? "bg-emerald-700 text-white" : "text-stone-600 hover:bg-stone-100"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setQ("");
                setProps([]);
              }}
              className="text-emerald-700 underline"
            >
              清除篩選
            </button>
          </div>
        )}
      </div>
      <Table head={["", "名稱", "規格／價格", "使用比例", targetsLabel, "性質", "使用時間", "禁用時間", "購買地", ""]}>
        {list.map((m) => {
          const photos = m.photos ?? [];
          return (
            <tr key={m.id} className="hover:bg-stone-50">
              <Td>
                <Thumb src={photos[0]} photos={photos} showCount />
              </Td>
              <Td>
                <div className="font-medium">{m.nameZh}</div>
                <div className="text-xs text-stone-500">{m.nameEn}</div>
              </Td>
              <Td className="whitespace-nowrap">
                {m.size}{UNIT_SHORT[m.unit]}
                <div className="font-semibold">{money(m.price)}</div>
                {m.priceHistory.length > 0 && (
                  <div className="text-xs text-stone-400">前次 {money(m.priceHistory[m.priceHistory.length - 1].price)}</div>
                )}
              </Td>
              <Td>{m.dilution ? `${m.dilution} 倍` : "—"}</Td>
              <Td>{m.targets || "—"}</Td>
              <Td>
                <div className="flex flex-wrap gap-1">{m.properties.map((p) => <Badge key={p} tone="green">{p}</Badge>)}</div>
              </Td>
              <Td>{m.usagePeriod || "—"}</Td>
              <Td>{m.bannedPeriod ? <span className="font-semibold text-red-600">{m.bannedPeriod}</span> : <span className="text-stone-400">—</span>}</Td>
              <Td>{supplier(m.supplierId)?.name ?? "—"}</Td>
              <Td>
                {meta.needsCode ? (
                  <RowActions confirm={false} onEdit={() => startEdit(m)} onDelete={() => setDeleting(m)} />
                ) : (
                  <RowActions onEdit={() => startEdit(m)} onDelete={() => remove("materials", m.id)} />
                )}
              </Td>
            </tr>
          );
        })}
        {!list.length && <tr><Td colSpan={10} className="py-8 text-center text-stone-400">{filtered ? "沒有符合篩選條件的資料" : "沒有資料"}</Td></tr>}
      </Table>

      {gate && (
        <CodeModal
          title={gate.material ? `編輯${meta.title}` : `新增${meta.title}`}
          confirmLabel="下一步"
          onClose={() => setGate(null)}
          onSubmit={async (c) => {
            const res = await verifyCode("materials", gate.material ? "update" : "create", c, category);
            if (res.ok) {
              setCode(c);
              setEditing(gate.material ?? create());
              setGate(null);
            }
            return res;
          }}
        >
          {gate.material ? (
            <>編輯「<b>{gate.material.nameZh}</b>」需要驗證碼。</>
          ) : (
            `新增${meta.title}需要驗證碼。`
          )}
        </CodeModal>
      )}
      {deleting && (
        <CodeModal
          title={`刪除${meta.title}`}
          confirmLabel="確認刪除"
          danger
          onClose={() => setDeleting(null)}
          onSubmit={async (c) => {
            const res = await removeWithCode("materials", deleting.id, c);
            if (res.ok) setDeleting(null);
            return res;
          }}
        >
          即將刪除「<b>{deleting.nameZh}</b>」，照片也會一併刪除，無法復原。
        </CodeModal>
      )}
      {editing && (
        <MaterialModal
          material={editing}
          title={meta.title}
          code={code}
          onClose={() => {
            setEditing(null);
            setCode(undefined);
          }}
        />
      )}
    </>
  );
}

function MaterialModal({
  material,
  title,
  code,
  onClose,
}: {
  material: Material;
  title: string;
  code?: string;
  onClose: () => void;
}) {
  const db = useDB();
  const meta = META[material.category];
  const [m, setM] = useState(material);
  const set = <K extends keyof Material>(k: K, v: Material[K]) => setM((p) => ({ ...p, [k]: v }));
  const isNew = !db.materials.some((x) => x.id === m.id);

  function save() {
    if (!m.nameZh.trim()) return alert("請填寫中文名稱");
    // 登錄／異動時間與歷史價格由後端維護
    upsert("materials", m, { code });
    onClose();
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={isNew ? `新增${title}` : `編輯${title}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={save}>儲存</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="名稱（中文）*">
          <Input value={m.nameZh} onChange={(e) => set("nameZh", e.target.value)} />
        </Field>
        <Field label="名稱（英文）">
          <Input value={m.nameEn} onChange={(e) => set("nameEn", e.target.value)} />
        </Field>
        <div className="flex gap-6 text-sm text-stone-500 sm:col-span-2">
          <span>{meta.createdLabel}：{m.createdAt}</span>
          <span>資訊異動時間：{m.updatedAt}</span>
        </div>
      </div>

      <SectionTitle>規格與價格</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="包裝">
          <Select value={m.unit} onChange={(e) => set("unit", e.target.value as MaterialUnit)}>
            {meta.units.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
          </Select>
        </Field>
        <Field label={`重量／容量（${UNIT_SHORT[m.unit]}）`}>
          <NumInput value={m.size} onChange={(v) => set("size", v)} />
        </Field>
        <Field label="價格（元）">
          <NumInput value={m.price} onChange={(v) => set("price", v)} />
        </Field>
        <Field label="使用比例（倍數）">
          <Input value={m.dilution} onChange={(e) => set("dilution", e.target.value)} placeholder="例：2000" />
        </Field>
      </div>
      {!isNew && m.price !== material.price && material.price > 0 && (
        <p className="mt-2 text-xs text-amber-700">儲存後，原價格 {money(material.price)} 會記錄到歷史價格。</p>
      )}
      {m.priceHistory.length > 0 && (
        <div className="mt-3 rounded-lg bg-stone-100 p-3 text-sm">
          <div className="mb-1 flex items-center gap-1 font-medium text-stone-700"><History size={14} /> 歷史價格</div>
          <ul className="space-y-0.5 text-stone-600">
            {[...m.priceHistory].reverse().map((h, i) => (
              <li key={i}>{h.date}：{money(h.price)}</li>
            ))}
          </ul>
        </div>
      )}

      <SectionTitle>使用方式</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={materialTargetsLabel(m.category)}>
          <Input value={m.targets} onChange={(e) => set("targets", e.target.value)} placeholder={meta.targetsPlaceholder} />
        </Field>
        <Field label="使用時間">
          <Input value={m.usagePeriod} onChange={(e) => set("usagePeriod", e.target.value)} placeholder="例：萌芽期～幼果期" />
        </Field>
        <Field label="性質（可多選）" group>
          <ChipSelect options={meta.props.map((p) => ({ value: p, label: p }))} value={m.properties} onChange={(v) => set("properties", v)} />
        </Field>
        <Field label="禁用時間（紅字提醒）" hint={m.bannedPeriod && <span className="flex items-center gap-1 font-semibold text-red-600"><AlertTriangle size={12} />{m.bannedPeriod}</span>}>
          <Input value={m.bannedPeriod} onChange={(e) => set("bannedPeriod", e.target.value)} placeholder="例：採收前 14 天禁用" className="text-red-600" />
        </Field>
        <Field label={meta.maxPhotos > 1 ? "照片（可上傳多張）" : "照片"} group>
          <PhotoUpload folder="materials" max={meta.maxPhotos} value={m.photos ?? []} onChange={(v) => set("photos", v)} />
        </Field>
        <Field
          label="購買地"
          hint={<Link href="/suppliers" className="text-emerald-700 underline">管理貨源店家</Link>}
        >
          <Select value={m.supplierId} onChange={(e) => set("supplierId", e.target.value)}>
            <option value="">（未指定）</option>
            {db.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
        </Field>
      </div>
    </Modal>
  );
}
