"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, History, Plus, Search } from "lucide-react";
import { remove, upsert, useDB } from "@/lib/store";
import type { Material, MaterialCategory, MaterialUnit } from "@/lib/types";
import { UNIT_LABELS, UNIT_SHORT, money, todayStr, uid } from "@/lib/utils";
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

const META: Record<MaterialCategory, { title: string; units: MaterialUnit[]; props: string[] }> = {
  pesticide: { title: "農藥", units: ["ml", "g", "kg"], props: ["殺細菌", "病毒", "殺蟲", "營養補充"] },
  fertilizer: { title: "肥料", units: ["ml", "g", "kg"], props: ["殺細菌", "病毒", "殺蟲", "營養補充"] },
  packaging: { title: "包材／乾貨", units: ["g", "kg", "片"], props: ["套袋", "包裝", "防潮", "資材"] },
};

export function MaterialPage({ category }: { category: MaterialCategory }) {
  const db = useDB();
  const meta = META[category];
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Material | null>(null);
  const list = db.materials
    .filter((m) => m.category === category)
    .filter((m) => !q || `${m.nameZh}${m.nameEn}${m.targets}`.toLowerCase().includes(q.toLowerCase()));
  const supplier = (id: string) => db.suppliers.find((s) => s.id === id);

  const create = (): Material => ({
    id: uid(), category, nameZh: "", nameEn: "", createdAt: todayStr(), updatedAt: todayStr(),
    unit: meta.units[0], size: 0, price: 0, priceHistory: [], dilution: "", targets: "", properties: [],
    usagePeriod: "", bannedPeriod: "", photo: "", supplierId: db.suppliers[0]?.id ?? "",
  });

  return (
    <>
      <PageHeader
        title={`${meta.title}（使用方式）`}
        desc="登錄品項、價格、使用比例與禁用時間；修改價格時會保留歷史價格。"
        action={<Button onClick={() => setEditing(create())}><Plus size={16} /> 新增{meta.title}</Button>}
      />
      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-2.5 text-stone-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜尋名稱或防治對象" className="pl-9" />
      </div>
      <Table head={["", "名稱", "規格／價格", "使用比例", "防治對象", "性質", "使用時間", "禁用時間", "購買地", ""]}>
        {list.map((m) => (
          <tr key={m.id} className="hover:bg-stone-50">
            <Td><Thumb src={m.photo} /></Td>
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
            <Td><RowActions onEdit={() => setEditing(m)} onDelete={() => remove("materials", m.id)} /></Td>
          </tr>
        ))}
        {!list.length && <tr><Td colSpan={10} className="py-8 text-center text-stone-400">沒有資料</Td></tr>}
      </Table>
      {editing && <MaterialModal material={editing} title={meta.title} onClose={() => setEditing(null)} />}
    </>
  );
}

function MaterialModal({ material, title, onClose }: { material: Material; title: string; onClose: () => void }) {
  const db = useDB();
  const meta = META[material.category];
  const [m, setM] = useState(material);
  const set = <K extends keyof Material>(k: K, v: Material[K]) => setM((p) => ({ ...p, [k]: v }));
  const isNew = !db.materials.some((x) => x.id === m.id);

  function save() {
    if (!m.nameZh.trim()) return alert("請填寫中文名稱");
    // 登入／異動時間與歷史價格由後端維護
    upsert("materials", m);
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
          <span>登入時間：{m.createdAt}</span>
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
      {!isNew && m.price !== material.price && (
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
        <Field label="防治對象">
          <Input value={m.targets} onChange={(e) => set("targets", e.target.value)} placeholder="例：炭疽病、薊馬" />
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
        <Field label="照片" group>
          <PhotoUpload max={1} value={m.photo ? [m.photo] : []} onChange={(v) => set("photo", v[0] ?? "")} />
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
