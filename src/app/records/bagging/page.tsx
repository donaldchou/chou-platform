"use client";

import { useState } from "react";
import { Plus, Wand2 } from "lucide-react";
import { remove, upsert, useDB } from "@/lib/store";
import type { BaggingRecord } from "@/lib/types";
import { BENTO_PRICE, attendanceDays, money, todayStr, uid } from "@/lib/utils";
import {
  AttendanceEditor,
  BentoToggle,
  BoxUsageEditor,
  DelBtn,
  EditorRows,
  EmployeePicker,
  Formula,
  OrchardSelect,
  boxesToBags,
} from "@/components/record-parts";
import {
  Badge,
  Button,
  Card,
  ChipSelect,
  Empty,
  Field,
  Input,
  Modal,
  NumInput,
  PageHeader,
  RowActions,
  SectionTitle,
} from "@/components/ui";

const wageTotal = (r: BaggingRecord) =>
  r.wages.reduce((s, w) => s + w.bags * r.pricePerBag + w.bentoDays * BENTO_PRICE, 0);

export default function BaggingPage() {
  const db = useDB();
  const [editing, setEditing] = useState<BaggingRecord | null>(null);
  const orchard = (id: string) => db.orchards.find((o) => o.id === id);

  function create(): BaggingRecord {
    const d = todayStr();
    return {
      id: uid(), orchardId: db.orchards[0]?.id ?? "", start: d, end: "", employeeIds: [], ownBoxes: [],
      ownRemainingBags: 0, workerIds: [], attendance: [], bentoMode: "便當", externalBoxes: [],
      externalRemainingBags: 0, pricePerBag: 1, wages: [],
    };
  }

  const list = [...db.bagging].sort((a, b) => b.start.localeCompare(a.start));

  return (
    <>
      <PageHeader
        title="套袋紀錄"
        desc="記錄套袋期間、紙袋用量、外請工人進場與工資結算。"
        action={<Button onClick={() => setEditing(create())}><Plus size={16} /> 新增套袋紀錄</Button>}
      />
      {list.length === 0 && <Empty>尚無套袋紀錄</Empty>}
      <div className="space-y-4">
        {list.map((r) => {
          const o = orchard(r.orchardId);
          const ownUsed = boxesToBags(r.ownBoxes) - r.ownRemainingBags;
          const extUsed = boxesToBags(r.externalBoxes) - r.externalRemainingBags;
          return (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold">
                    {o?.nameZh ?? "（已刪除）"} <span className="text-sm font-normal text-stone-500">{o?.nameEn}</span>
                  </div>
                  <div className="text-sm text-stone-500">
                    {r.start} ~ {r.end || <Badge tone="amber">進行中</Badge>}
                  </div>
                </div>
                <RowActions onEdit={() => setEditing(r)} onDelete={() => remove("bagging", r.id)} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Stat label="自己員工使用袋數" value={`${ownUsed.toLocaleString()} 袋`} sub={`${r.employeeIds.length} 人，結餘 ${r.ownRemainingBags.toLocaleString()} 袋`} />
                <Stat label="外請工人使用袋數" value={`${extUsed.toLocaleString()} 袋`} sub={`結餘 ${r.externalRemainingBags.toLocaleString()} 袋`} />
                <Stat label="每袋工資" value={`${r.pricePerBag} 元`} sub={`${r.workerIds.length} 位外請工人`} />
                <Stat label="工資總計" value={money(wageTotal(r))} sub={`${r.attendance.length} 筆進場紀錄`} />
              </div>
            </Card>
          );
        })}
      </div>
      {editing && <BaggingModal record={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-stone-50 p-3">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="mt-1 font-semibold text-stone-900">{value}</div>
      {sub && <div className="text-xs text-stone-500">{sub}</div>}
    </div>
  );
}

function BaggingModal({ record, onClose }: { record: BaggingRecord; onClose: () => void }) {
  const db = useDB();
  const [r, setR] = useState(record);
  const set = <K extends keyof BaggingRecord>(k: K, v: BaggingRecord[K]) => setR((p) => ({ ...p, [k]: v }));
  const workerNames = db.workers.filter((w) => r.workerIds.includes(w.id)).map((w) => w.nameZh);
  const total = wageTotal(r);

  function fillFromAttendance() {
    const days = attendanceDays(r.attendance);
    set(
      "wages",
      days.map((d) => {
        const prev = r.wages.find((w) => w.name === d.name);
        return { id: prev?.id ?? uid(), name: d.name, bags: prev?.bags ?? 0, bentoDays: d.days };
      }),
    );
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="套袋紀錄"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={() => { upsert("bagging", r); onClose(); }}>儲存</Button>
        </>
      }
    >
      <SectionTitle>基本資料</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <OrchardSelect value={r.orchardId} onChange={(v) => set("orchardId", v)} />
        <Field label="開始套袋日期">
          <Input type="date" value={r.start} onChange={(e) => set("start", e.target.value)} />
        </Field>
        <Field label="結束套袋日期">
          <Input type="date" value={r.end} onChange={(e) => set("end", e.target.value)} />
        </Field>
      </div>

      <SectionTitle>自己員工</SectionTitle>
      <div className="space-y-4 rounded-xl bg-stone-100 p-4">
        <EmployeePicker value={r.employeeIds} onChange={(v) => set("employeeIds", v)} />
        <BoxUsageEditor title="紙袋箱數" rows={r.ownBoxes} onChange={(v) => set("ownBoxes", v)} />
        <div className="grid items-end gap-4 sm:grid-cols-2">
          <Field label="結餘袋數（未使用完）">
            <NumInput value={r.ownRemainingBags} onChange={(v) => set("ownRemainingBags", v)} />
          </Field>
          <p className="pb-2 text-sm text-stone-600">
            領用 {boxesToBags(r.ownBoxes).toLocaleString()} 袋，實際使用{" "}
            <b>{(boxesToBags(r.ownBoxes) - r.ownRemainingBags).toLocaleString()}</b> 袋
          </p>
        </div>
      </div>

      <SectionTitle>年度外請工人</SectionTitle>
      <ChipSelect
        options={db.workers.map((w) => ({ value: w.id, label: `${w.nameZh}・${w.phone}` }))}
        value={r.workerIds}
        onChange={(v) => set("workerIds", v)}
        empty="尚未建立外請工人，請到「外請工人」頁面新增"
      />

      <SectionTitle>套袋費用計算</SectionTitle>
      <div className="space-y-5 rounded-xl bg-stone-100 p-4">
        <AttendanceEditor rows={r.attendance} names={workerNames} onChange={(v) => set("attendance", v)} />
        <BentoToggle value={r.bentoMode} onChange={(v) => set("bentoMode", v)} />
        <BoxUsageEditor title="紙袋箱數（外請工人）" rows={r.externalBoxes} onChange={(v) => set("externalBoxes", v)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="結餘袋數（未使用完）">
            <NumInput value={r.externalRemainingBags} onChange={(v) => set("externalRemainingBags", v)} />
          </Field>
          <Field label="每袋幾元">
            <NumInput step="0.1" value={r.pricePerBag} onChange={(v) => set("pricePerBag", v)} />
          </Field>
        </div>

        <EditorRows
          title="工資結算"
          addLabel="新增人員"
          onAdd={() => set("wages", [...r.wages, { id: uid(), name: "", bags: 0, bentoDays: 0 }])}
        >
          <Button size="sm" variant="ghost" onClick={fillFromAttendance} className="text-emerald-700">
            <Wand2 size={14} /> 依進場紀錄自動帶入人員與便當天數
          </Button>
          {r.wages.map((w) => {
            const upd = (patch: Partial<typeof w>) =>
              set("wages", r.wages.map((x) => (x.id === w.id ? { ...x, ...patch } : x)));
            return (
              <div key={w.id} className="grid grid-cols-2 items-end gap-2 rounded-lg bg-white p-2 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
                <Field label="姓名">
                  <Input value={w.name} list="attendance-names" onChange={(e) => upd({ name: e.target.value })} />
                </Field>
                <Field label="總袋數">
                  <NumInput value={w.bags} onChange={(v) => upd({ bags: v })} />
                </Field>
                <Field label="便當天數">
                  <NumInput value={w.bentoDays} onChange={(v) => upd({ bentoDays: v })} />
                </Field>
                <div className="pb-2 text-right text-sm">
                  <div className="text-xs text-stone-500">總金額</div>
                  <b>{money(w.bags * r.pricePerBag + w.bentoDays * BENTO_PRICE)}</b>
                </div>
                <DelBtn onClick={() => set("wages", r.wages.filter((x) => x.id !== w.id))} />
              </div>
            );
          })}
        </EditorRows>
        <Formula>
          總金額 = 總袋數 × 每袋 {r.pricePerBag} 元 + 便當天數 × {BENTO_PRICE} 元　｜　全部工資合計 <b>{money(total)}</b>
        </Formula>
      </div>
    </Modal>
  );
}
