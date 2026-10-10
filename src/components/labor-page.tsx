"use client";

import { useState } from "react";
import { Plus, Wand2 } from "lucide-react";
import { remove, upsert, useDB } from "@/lib/store";
import type { DB, LaborKind, LaborRecord } from "@/lib/types";
import { BENTO_PRICE, attendanceDays, daySpan, defaultOrchard, money, todayStr, uid } from "@/lib/utils";
import {
  AttendanceEditor,
  BentoToggle,
  DelBtn,
  EditorRows,
  EmployeePicker,
  Formula,
  OrchardSelect,
} from "./record-parts";
import {
  Badge,
  Button,
  ComboInput,
  Field,
  Input,
  Modal,
  NumInput,
  PageHeader,
  RowActions,
  SectionTitle,
  Select,
  Table,
  Td,
  Textarea,
} from "./ui";

export const LABOR_LABEL: Record<LaborKind, string> = { pruning: "剪枝", weeding: "砍草" };

export const laborTotal = (r: LaborRecord) =>
  r.wages.reduce((s, w) => s + w.days * w.dailyRate + w.bentoDays * BENTO_PRICE, 0);

export const newLaborRecord = (kind: LaborKind, db: DB): LaborRecord => ({
  id: uid(), kind, orchardId: defaultOrchard(db.orchards)?.id ?? "", start: todayStr(), end: "",
  employeeIds: [], workers: [], attendance: [], bentoMode: "便當", wages: [], note: "",
});

/** 今年累計工資的說明文字 */
export function laborDesc(kind: LaborKind, db: DB) {
  const label = LABOR_LABEL[kind];
  const year = todayStr().slice(0, 4);
  const yearCost = db.labor
    .filter((r) => r.kind === kind && r.start.startsWith(year))
    .reduce((s, r) => s + laborTotal(r), 0);
  return `記錄${label}工期、參與人員、外請工人進場時間與工資結算。${year} 年累計工資 ${money(yearCost)}。`;
}

export function LaborPage({ kind }: { kind: LaborKind }) {
  const db = useDB();
  const label = LABOR_LABEL[kind];
  const [editing, setEditing] = useState<LaborRecord | null>(null);

  return (
    <>
      <PageHeader
        title={`${label}紀錄`}
        desc={laborDesc(kind, db)}
        action={<Button onClick={() => setEditing(newLaborRecord(kind, db))}><Plus size={16} /> 新增{label}紀錄</Button>}
      />
      <LaborTable kind={kind} onEdit={setEditing} />
      {editing && <LaborModal record={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

export function LaborTable({ kind, onEdit }: { kind: LaborKind; onEdit: (r: LaborRecord) => void }) {
  const db = useDB();
  const label = LABOR_LABEL[kind];
  const list = db.labor.filter((r) => r.kind === kind).sort((a, b) => b.start.localeCompare(a.start));
  const orchard = (id: string) => db.orchards.find((o) => o.id === id);

  return (
      <Table head={["果園", "開始日期", "完工日期", "工期", "自己員工", "外請工人", "工資合計", "備註", ""]}>
        {list.map((r) => (
          <tr key={r.id} className="hover:bg-stone-50">
            <Td>
              <div className="font-medium">{orchard(r.orchardId)?.nameZh ?? "（已刪除）"}</div>
              <div className="text-xs text-stone-500">{orchard(r.orchardId)?.nameEn}</div>
            </Td>
            <Td>{r.start}</Td>
            <Td>{r.end || <Badge tone="amber">進行中</Badge>}</Td>
            <Td>{r.end ? `${daySpan(r.start, r.end)} 天` : "—"}</Td>
            <Td>{r.employeeIds.map((id) => db.employees.find((e) => e.id === id)?.name).filter(Boolean).join("、") || "—"}</Td>
            <Td>{r.workers.map((w) => db.workers.find((x) => x.id === w.workerId)?.nameZh).filter(Boolean).join("、") || "—"}</Td>
            <Td className="font-semibold">{money(laborTotal(r))}</Td>
            <Td className="text-stone-500">{r.note}</Td>
            <Td><RowActions onEdit={() => onEdit(r)} onDelete={() => remove("labor", r.id)} /></Td>
          </tr>
        ))}
        {!list.length && (
          <tr><Td colSpan={9} className="py-8 text-center text-stone-400">尚無{label}紀錄</Td></tr>
        )}
      </Table>
  );
}

export function LaborModal({ record, onClose }: { record: LaborRecord; onClose: () => void }) {
  const db = useDB();
  const label = LABOR_LABEL[record.kind];
  // 舊紀錄沒有 note 欄位
  const [r, setR] = useState({ ...record, note: record.note ?? "" });
  const set = <K extends keyof LaborRecord>(k: K, v: LaborRecord[K]) => setR((p) => ({ ...p, [k]: v }));
  const workerName = (id: string) => db.workers.find((w) => w.id === id)?.nameZh ?? "";
  const names = r.workers.map((w) => workerName(w.workerId)).filter(Boolean);
  const available = db.workers.filter((w) => !r.workers.some((x) => x.workerId === w.id));

  function fillFromAttendance() {
    set(
      "wages",
      attendanceDays(r.attendance).map((d) => {
        const prev = r.wages.find((w) => w.name === d.name);
        const w = r.workers.find((x) => workerName(x.workerId) === d.name);
        return {
          id: prev?.id ?? uid(),
          name: d.name,
          days: d.days,
          dailyRate: w?.dailyRate ?? prev?.dailyRate ?? 0,
          bentoDays: d.days,
        };
      }),
    );
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`${label}紀錄`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={() => { upsert("labor", r); onClose(); }}>儲存</Button>
        </>
      }
    >
      <SectionTitle>基本資料</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <OrchardSelect value={r.orchardId} onChange={(v) => set("orchardId", v)} />
        <Field label="開始日期">
          <Input type="date" value={r.start} onChange={(e) => set("start", e.target.value)} />
        </Field>
        <Field label="完工日期">
          <Input type="date" value={r.end} onChange={(e) => set("end", e.target.value)} />
        </Field>
      </div>
      <div className="mt-4">
        <EmployeePicker value={r.employeeIds} onChange={(v) => set("employeeIds", v)} />
      </div>

      <SectionTitle>外請員工管理</SectionTitle>
      <EditorRows
        title="外請工人與日薪"
        addLabel="加入工人"
        onAdd={() => {
          const w = available[0];
          if (!w) return alert("沒有其他可加入的外請工人，請先到「外請工人」頁面新增。");
          set("workers", [...r.workers, { workerId: w.id, dailyRate: w.dailyRate }]);
        }}
      >
        {r.workers.length === 0 && <p className="text-sm text-stone-400">尚未加入外請工人</p>}
        {r.workers.map((w, i) => {
          const info = db.workers.find((x) => x.id === w.workerId);
          return (
            <div key={w.workerId} className="grid grid-cols-2 items-end gap-2 rounded-lg bg-stone-100 p-2 sm:grid-cols-[1.5fr_1fr_1fr_auto]">
              <Field label="姓名">
                <Select
                  value={w.workerId}
                  onChange={(e) => {
                    const nw = db.workers.find((x) => x.id === e.target.value)!;
                    set("workers", r.workers.map((x, j) => (j === i ? { workerId: nw.id, dailyRate: nw.dailyRate } : x)));
                  }}
                >
                  {[info, ...available].filter(Boolean).map((x) => (
                    <option key={x!.id} value={x!.id}>{x!.nameZh}</option>
                  ))}
                </Select>
              </Field>
              <div className="pb-2 text-sm text-stone-500">{info?.phone}</div>
              <Field label="費用（日金額）">
                <NumInput
                  value={w.dailyRate}
                  onChange={(v) => set("workers", r.workers.map((x, j) => (j === i ? { ...x, dailyRate: v } : x)))}
                />
              </Field>
              <DelBtn onClick={() => set("workers", r.workers.filter((_, j) => j !== i))} />
            </div>
          );
        })}
      </EditorRows>

      <SectionTitle>{label}費用計算</SectionTitle>
      <div className="space-y-5 rounded-xl bg-stone-100 p-4">
        <AttendanceEditor rows={r.attendance} names={names} onChange={(v) => set("attendance", v)} />
        <BentoToggle value={r.bentoMode} onChange={(v) => set("bentoMode", v)} />
        <EditorRows
          title="工資結算"
          addLabel="新增人員"
          onAdd={() => set("wages", [...r.wages, { id: uid(), name: "", days: 0, dailyRate: 0, bentoDays: 0 }])}
        >
          <Button size="sm" variant="ghost" onClick={fillFromAttendance} className="text-emerald-700">
            <Wand2 size={14} /> 依進場紀錄自動計算天數與日薪
          </Button>
          {r.wages.map((w) => {
            const upd = (patch: Partial<typeof w>) =>
              set("wages", r.wages.map((x) => (x.id === w.id ? { ...x, ...patch } : x)));
            return (
              <div key={w.id} className="grid grid-cols-2 items-end gap-2 rounded-lg bg-white p-2 sm:grid-cols-[1.2fr_0.8fr_1fr_0.8fr_1fr_auto]">
                <Field label="姓名">
                  <ComboInput value={w.name} options={names} onChange={(v) => upd({ name: v })} />
                </Field>
                <Field label="天數">
                  <NumInput value={w.days} onChange={(v) => upd({ days: v })} />
                </Field>
                <Field label="日金額">
                  <NumInput value={w.dailyRate} onChange={(v) => upd({ dailyRate: v })} />
                </Field>
                <Field label="便當天數">
                  <NumInput value={w.bentoDays} onChange={(v) => upd({ bentoDays: v })} />
                </Field>
                <div className="pb-2 text-right text-sm">
                  <div className="text-xs text-stone-500">總金額</div>
                  <b>{money(w.days * w.dailyRate + w.bentoDays * BENTO_PRICE)}</b>
                </div>
                <DelBtn onClick={() => set("wages", r.wages.filter((x) => x.id !== w.id))} />
              </div>
            );
          })}
        </EditorRows>
        <Formula>
          總金額 = 天數 × 日金額 + 便當天數 × {BENTO_PRICE} 元　｜　全部工資合計 <b>{money(laborTotal(r))}</b>
        </Formula>
      </div>

      <SectionTitle>備註</SectionTitle>
      <Textarea value={r.note} onChange={(e) => set("note", e.target.value)} />
    </Modal>
  );
}
