"use client";

import { useState } from "react";
import Link from "next/link";
import { upsert, useDB } from "@/lib/store";
import type { FertilizingRecord } from "@/lib/types";
import { materialName, money, uid } from "@/lib/utils";
import {
  DelBtn,
  EditorRows,
  EmployeePicker,
  Formula,
  OrchardSelect,
  TargetPicker,
} from "./record-parts";
import {
  Button,
  Field,
  Input,
  Modal,
  NumInput,
  PhotoUpload,
  SectionTitle,
  Select,
  Textarea,
  Thumb,
} from "./ui";

export function useFertCost() {
  const db = useDB();
  return (r: FertilizingRecord) => ({
    packs: r.items.reduce((s, i) => s + i.packs, 0),
    cost: r.items.reduce((s, i) => s + i.packs * (db.materials.find((m) => m.id === i.materialId)?.price ?? 0), 0),
  });
}

/** 新增／編輯施肥紀錄（施肥紀錄頁與噴藥日曆共用） */
export function FertModal({ record, onClose }: { record: FertilizingRecord; onClose: () => void }) {
  const db = useDB();
  const cost = useFertCost();
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
