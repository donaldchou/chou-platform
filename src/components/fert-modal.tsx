"use client";

import { useState } from "react";
import Link from "next/link";
import { upsert, useDB } from "@/lib/store";
import type { FertilizingRecord } from "@/lib/types";
import { ArrowDown, ArrowUp } from "lucide-react";
import { defaultOrchard, fertPacks, fertUnit, fmtDT, materialCost, materialName, money, orchardLabel, uid } from "@/lib/utils";
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

/**
 * 施肥紀錄的總包數、費用與使用量說明。整體用量是 L／kg，依肥料每包容量換算包數；
 * 沒設定每包容量的肥料不算進總包數。
 */
export function useFertCost() {
  const db = useDB();
  return (r: FertilizingRecord) => {
    const rows = r.items.map((i) => {
      const m = db.materials.find((x) => x.id === i.materialId);
      return { m, amount: i.amount, packs: fertPacks(m, i.amount) };
    });
    return {
      packs: Math.round(rows.reduce((s, x) => s + (x.packs ?? 0), 0) * 100) / 100,
      cost: rows.reduce((s, x) => s + materialCost(x.m, x.amount * 1000), 0),
      /** 例：德城牌 粒粒甜 × 3 包、美果硼 × 10 kg（未設定每包容量） */
      usage: rows
        .filter((x) => x.amount > 0)
        .map((x) =>
          x.packs === null
            ? `${x.m?.nameZh ?? "（已刪除）"} × ${x.amount} ${fertUnit(x.m)}（未設定每包容量）`
            : `${x.m!.nameZh} × ${x.packs} 包`,
        )
        .join("、"),
    };
  };
}

/** 新增／編輯施肥紀錄（施肥紀錄頁與日曆共用）；code 是打開前已驗證過的驗證碼，儲存時送給後端 */
export function FertModal({ record, code, onClose }: { record: FertilizingRecord; code?: string; onClose: () => void }) {
  const db = useDB();
  const cost = useFertCost();
  const [r, setR] = useState(record);
  const set = <K extends keyof FertilizingRecord>(k: K, v: FertilizingRecord[K]) => setR((p) => ({ ...p, [k]: v }));
  const ferts = db.materials.filter((m) => m.category === "fertilizer");
  const c = cost(r);

  // 參考過去的施肥紀錄：選果園＋年份＋日期後，把肥料等內容帶入目前表單（不會存進資料庫）
  const [refOrchard, setRefOrchard] = useState(record.orchardId || defaultOrchard(db.orchards)?.id || "");
  const [refId, setRefId] = useState("");
  const [refYear, setRefYear] = useState(""); // YYYY，空白＝全部
  const orchardRecords = db.fertilizing.filter((x) => x.orchardId === refOrchard && x.id !== record.id);
  const refYears = [...new Set(orchardRecords.map((x) => x.datetime.slice(0, 4)).filter(Boolean))].sort().reverse();
  const refRecords = orchardRecords
    .filter((x) => x.datetime.startsWith(refYear))
    .sort((a, b) => b.datetime.localeCompare(a.datetime));
  const matName = (id: string) => db.materials.find((m) => m.id === id)?.nameZh ?? "（已刪除）";

  function applyRef() {
    const src = refRecords.find((x) => x.id === refId);
    if (!src) return;
    if ((r.items.length || r.note) && !window.confirm("要用參考紀錄的內容取代目前已填的肥料與注意事項嗎？")) return;
    // 參考照片不帶入：同一張照片給兩筆紀錄用，刪掉其中一筆時照片會被刪除
    setR((p) => ({
      ...p,
      waterLiters: src.waterLiters ?? 0,
      items: src.items.map((i) => ({ ...i, id: uid() })),
      targets: [...src.targets],
      otherTarget: src.otherTarget,
      employeeIds: [...src.employeeIds],
      note: src.note,
    }));
  }

  function move(i: number, d: -1 | 1) {
    const items = [...r.items];
    [items[i], items[i + d]] = [items[i + d], items[i]];
    set("items", items);
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="施肥紀錄"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={() => { upsert("fertilizing", r, { code }); onClose(); }}>儲存</Button>
        </>
      }
    >
      <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1.5fr_auto]">
          <Field label="參考果園">
            <Select value={refOrchard} onChange={(e) => { setRefOrchard(e.target.value); setRefYear(""); setRefId(""); }}>
              {db.orchards.map((o) => <option key={o.id} value={o.id}>{orchardLabel(o)}</option>)}
            </Select>
          </Field>
          <Field label="年份">
            <Select value={refYear} onChange={(e) => { setRefYear(e.target.value); setRefId(""); }}>
              <option value="">全部</option>
              {refYears.map((y) => <option key={y} value={y}>{y} 年</option>)}
            </Select>
          </Field>
          <Field label="參考日期">
            <Select value={refId} onChange={(e) => setRefId(e.target.value)} disabled={!refRecords.length}>
              <option value="">
                {refRecords.length ? "請選擇要參考的施肥紀錄" : refYear ? "這個年份沒有施肥紀錄" : "此果園尚無施肥紀錄"}
              </option>
              {refRecords.map((x) => (
                <option key={x.id} value={x.id}>
                  {fmtDT(x.datetime)}・{x.items.map((i) => matName(i.materialId)).join("、") || "無肥料"}
                </option>
              ))}
            </Select>
          </Field>
          <Button variant="secondary" onClick={applyRef} disabled={!refId}>帶入</Button>
        </div>
        <p className="mt-2 text-xs text-stone-500">帶入水量、肥料與用量、對象、人員與注意事項，帶入後可再手動調整；果園、日期與參考照片不會被覆蓋。</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <OrchardSelect value={r.orchardId} onChange={(v) => set("orchardId", v)} />
        <Field label="施用日期時間">
          <Input type="datetime-local" value={r.datetime} onChange={(e) => set("datetime", e.target.value)} />
        </Field>
        <Field label="水使用總量（公升 L）">
          <NumInput value={r.waterLiters ?? 0} onChange={(v) => set("waterLiters", v)} />
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
            set("items", [...r.items, { id: uid(), materialId: ferts[0].id, gramsPerTree: 0, litersPerTree: 0, seconds: 0, amount: 0 }])
          }
        >
          {r.items.map((it, i) => {
            const m = db.materials.find((x) => x.id === it.materialId);
            const upd = (patch: Partial<typeof it>) =>
              set("items", r.items.map((x) => (x.id === it.id ? { ...x, ...patch } : x)));
            const packs = fertPacks(m, it.amount);
            return (
              <div key={it.id} className="grid grid-cols-2 items-end gap-2 rounded-lg bg-stone-100 p-2 sm:grid-cols-[auto_auto_2fr_1fr_1fr_1fr_1.2fr_auto]">
                {/* 順序：陣列順序就是施用順序 */}
                <div className="flex items-center gap-1 pb-1">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">{i + 1}</span>
                  <div className="flex flex-col">
                    <button disabled={i === 0} onClick={() => move(i, -1)} className="text-stone-500 disabled:opacity-20" title="往前"><ArrowUp size={14} /></button>
                    <button disabled={i === r.items.length - 1} onClick={() => move(i, 1)} className="text-stone-500 disabled:opacity-20" title="往後"><ArrowDown size={14} /></button>
                  </div>
                </div>
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
                <Field
                  label={`整體用量（${fertUnit(m)}）`}
                  hint={it.amount > 0 ? (packs === null ? "未設定每包容量" : `約 ${packs} 包`) : undefined}
                >
                  <NumInput step="any" value={it.amount} onChange={(v) => upd({ amount: v })} />
                </Field>
                <DelBtn onClick={() => set("items", r.items.filter((x) => x.id !== it.id))} />
              </div>
            );
          })}
        </EditorRows>
      )}
      <Formula>
        總包數 <b>{c.packs}</b> 包　｜　費用統計 <b>{money(c.cost)}</b>（整體用量 × 肥料單價）
        <br />
        使用量說明：{c.usage || "—"}
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
