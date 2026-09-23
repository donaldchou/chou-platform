"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Printer, Share2 } from "lucide-react";
import { remove, upsert, useDB } from "@/lib/store";
import type { FertilizingRecord } from "@/lib/types";
import { fmtDT, materialName, money, nowStr, orchardLabel, uid } from "@/lib/utils";
import {
  DelBtn,
  EditorRows,
  EmployeePicker,
  Formula,
  OrchardSelect,
  TargetPicker,
  targetsText,
} from "@/components/record-parts";
import {
  Button,
  Field,
  Gallery,
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
  Textarea,
  Thumb,
} from "@/components/ui";

function useCost() {
  const db = useDB();
  return (r: FertilizingRecord) => ({
    packs: r.items.reduce((s, i) => s + i.packs, 0),
    cost: r.items.reduce((s, i) => s + i.packs * (db.materials.find((m) => m.id === i.materialId)?.price ?? 0), 0),
  });
}

export default function FertilizingPage() {
  const db = useDB();
  const cost = useCost();
  const [editing, setEditing] = useState<FertilizingRecord | null>(null);
  const [card, setCard] = useState<FertilizingRecord | null>(null);
  const list = [...db.fertilizing].sort((a, b) => b.datetime.localeCompare(a.datetime));
  const mat = (id: string) => db.materials.find((m) => m.id === id);

  const create = (): FertilizingRecord => ({
    id: uid(), orchardId: db.orchards[0]?.id ?? "", datetime: nowStr(), items: [], targets: [], otherTarget: "",
    employeeIds: [], photos: [], note: "",
  });

  return (
    <>
      <PageHeader
        title="施肥紀錄"
        desc="記錄施肥日期、肥料、每棵樹用量與費用，可產生參考卡給員工。"
        action={<Button onClick={() => setEditing(create())}><Plus size={16} /> 新增施肥紀錄</Button>}
      />
      <Table head={["施用日期時間", "果園", "肥料", "對象", "總包數", "費用", "員工", ""]}>
        {list.map((r) => {
          const c = cost(r);
          return (
            <tr key={r.id} className="hover:bg-stone-50">
              <Td className="whitespace-nowrap">{fmtDT(r.datetime)}</Td>
              <Td className="font-medium">{db.orchards.find((o) => o.id === r.orchardId)?.nameZh ?? "—"}</Td>
              <Td>{r.items.map((i) => mat(i.materialId)?.nameZh ?? "（已刪除）").join("、") || "—"}</Td>
              <Td>{targetsText(r.targets, r.otherTarget)}</Td>
              <Td>{c.packs} 包</Td>
              <Td className="font-semibold">{money(c.cost)}</Td>
              <Td>{r.employeeIds.map((id) => db.employees.find((e) => e.id === id)?.name).filter(Boolean).join("、") || "—"}</Td>
              <Td>
                <div className="flex items-center justify-end">
                  <Button size="sm" variant="ghost" className="text-emerald-700" onClick={() => setCard(r)} title="員工參考卡">
                    <Share2 size={14} />
                  </Button>
                  <RowActions onEdit={() => setEditing(r)} onDelete={() => remove("fertilizing", r.id)} />
                </div>
              </Td>
            </tr>
          );
        })}
        {!list.length && <tr><Td colSpan={8} className="py-8 text-center text-stone-400">尚無施肥紀錄</Td></tr>}
      </Table>
      {editing && <FertModal record={editing} onClose={() => setEditing(null)} />}
      {card && <ReferenceCard record={card} onClose={() => setCard(null)} />}
    </>
  );
}

function FertModal({ record, onClose }: { record: FertilizingRecord; onClose: () => void }) {
  const db = useDB();
  const cost = useCost();
  const [r, setR] = useState(record);
  const set = <K extends keyof FertilizingRecord>(k: K, v: FertilizingRecord[K]) => setR((p) => ({ ...p, [k]: v }));
  const ferts = db.materials.filter((m) => m.category === "fertilizer");
  const c = cost(r);

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="施肥紀錄"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={() => { upsert("fertilizing", r); onClose(); }}>儲存</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <OrchardSelect value={r.orchardId} onChange={(v) => set("orchardId", v)} />
        <Field label="施用日期時間">
          <Input type="datetime-local" value={r.datetime} onChange={(e) => set("datetime", e.target.value)} />
        </Field>
      </div>

      <SectionTitle>肥料使用</SectionTitle>
      {ferts.length === 0 ? (
        <p className="text-sm text-stone-500">
          尚未建立肥料資料，請先到 <Link href="/materials/fertilizers" className="text-emerald-700 underline">肥料</Link> 頁面新增。
        </p>
      ) : (
        <EditorRows
          title="肥料品牌與用量"
          addLabel="新增肥料"
          onAdd={() =>
            set("items", [...r.items, { id: uid(), materialId: ferts[0].id, gramsPerTree: 0, litersPerTree: 0, seconds: 0, packs: 1 }])
          }
        >
          {r.items.map((it) => {
            const m = db.materials.find((x) => x.id === it.materialId);
            const upd = (patch: Partial<typeof it>) =>
              set("items", r.items.map((x) => (x.id === it.id ? { ...x, ...patch } : x)));
            return (
              <div key={it.id} className="grid grid-cols-2 items-end gap-2 rounded-lg bg-stone-100 p-2 sm:grid-cols-[auto_2fr_1fr_1fr_1fr_1fr_auto]">
                <Thumb src={m?.photos?.[0]} photos={m?.photos} showCount className="h-10 w-10" />
                <Field label="肥料品牌">
                  <Select value={it.materialId} onChange={(e) => upd({ materialId: e.target.value })}>
                    {ferts.map((f) => <option key={f.id} value={f.id}>{materialName(f)}</option>)}
                  </Select>
                </Field>
                <Field label="重量 g／每棵">
                  <NumInput value={it.gramsPerTree} onChange={(v) => upd({ gramsPerTree: v })} />
                </Field>
                <Field label="液態 L／每棵">
                  <NumInput step="0.1" value={it.litersPerTree} onChange={(v) => upd({ litersPerTree: v })} />
                </Field>
                <Field label="時間（秒）">
                  <NumInput value={it.seconds} onChange={(v) => upd({ seconds: v })} />
                </Field>
                <Field label="使用包數">
                  <NumInput value={it.packs} onChange={(v) => upd({ packs: v })} />
                </Field>
                <DelBtn onClick={() => set("items", r.items.filter((x) => x.id !== it.id))} />
              </div>
            );
          })}
        </EditorRows>
      )}
      <Formula>
        總包數 <b>{c.packs}</b> 包　｜　費用統計 <b>{money(c.cost)}</b>（包數 × 肥料單價）
      </Formula>

      <SectionTitle>對象與人員</SectionTitle>
      <div className="space-y-4">
        <TargetPicker value={r.targets} other={r.otherTarget} onChange={(v) => set("targets", v)} onOther={(v) => set("otherTarget", v)} />
        <EmployeePicker value={r.employeeIds} onChange={(v) => set("employeeIds", v)} />
        <Field label="參考照片（提供給員工）" group>
          <PhotoUpload folder="fertilizing" value={r.photos} onChange={(v) => set("photos", v)} />
        </Field>
        <Field label="備註">
          <Textarea value={r.note} onChange={(e) => set("note", e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

function ReferenceCard({ record: r, onClose }: { record: FertilizingRecord; onClose: () => void }) {
  const db = useDB();
  const o = db.orchards.find((x) => x.id === r.orchardId);
  return (
    <Modal
      open
      onClose={onClose}
      title="員工參考卡"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>關閉</Button>
          <Button onClick={() => window.print()}><Printer size={16} /> 列印／存成 PDF</Button>
        </>
      }
    >
      <div className="print-area space-y-4 rounded-xl border-2 border-emerald-600 bg-white p-5">
        <div>
          <div className="text-xs text-stone-500">施肥工作單</div>
          <div className="text-xl font-bold">{orchardLabel(o)}</div>
          <div className="text-sm text-stone-600">施用時間：{fmtDT(r.datetime)}</div>
        </div>
        <div className="text-sm"><b>對象：</b>{targetsText(r.targets, r.otherTarget)}</div>
        <div className="space-y-2">
          {r.items.map((it) => {
            const m = db.materials.find((x) => x.id === it.materialId);
            return (
              <div key={it.id} className="flex gap-3 rounded-lg bg-stone-50 p-3">
                <Thumb src={m?.photos?.[0]} photos={m?.photos} showCount className="h-16 w-16" />
                <div className="text-sm">
                  <div className="font-semibold">{materialName(m)}</div>
                  {it.gramsPerTree > 0 && <div>每棵樹 {it.gramsPerTree} 公克</div>}
                  {it.litersPerTree > 0 && <div>每棵樹 {it.litersPerTree} 公升，約 {it.seconds} 秒</div>}
                  <div>共 {it.packs} 包</div>
                </div>
              </div>
            );
          })}
        </div>
        {r.note && <div className="text-sm"><b>注意事項：</b>{r.note}</div>}
        <div className="text-sm">
          <b>負責員工：</b>
          {r.employeeIds.map((id) => db.employees.find((e) => e.id === id)?.name).filter(Boolean).join("、") || "—"}
        </div>
        {r.photos.length > 0 && (
          <div>
            <div className="mb-1 text-sm font-semibold">參考照片</div>
            <Gallery photos={r.photos} size="h-28 w-28" />
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-stone-500">可列印或存成 PDF 後透過 LINE 傳給員工。</p>
    </Modal>
  );
}
