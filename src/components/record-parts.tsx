"use client";

import { Plus, Trash2 } from "lucide-react";
import { useDB } from "@/lib/store";
import type { Attendance, BentoMode, BoxUsage } from "@/lib/types";
import { FRUITS } from "@/lib/types";
import { BAG_TYPES, BENTO_PRICE, bagsPerBox, hoursBetween, todayStr, uid } from "@/lib/utils";
import { Button, ChipSelect, Field, Input, NumInput, Select } from "./ui";

export function OrchardSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const db = useDB();
  return (
    <Field label="果園名稱">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {db.orchards.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nameZh}
            {o.nameEn ? `（${o.nameEn}）` : ""}
          </option>
        ))}
      </Select>
    </Field>
  );
}

export function EmployeePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const db = useDB();
  return (
    <Field label="自己員工（可多選）" group>
      <ChipSelect
        options={db.employees.map((e) => ({ value: e.id, label: `${e.name}・${e.phone}` }))}
        value={value}
        onChange={onChange}
        empty="尚未建立員工，請到「員工工作回報 → 員工名冊」新增"
      />
    </Field>
  );
}

export function TargetPicker({
  value,
  other,
  onChange,
  onOther,
}: {
  value: string[];
  other: string;
  onChange: (v: string[]) => void;
  onOther: (v: string) => void;
}) {
  return (
    <Field label="對象（可複選）" group>
      <div className="flex flex-wrap items-center gap-2">
        <ChipSelect options={FRUITS.map((f) => ({ value: f, label: f }))} value={value} onChange={onChange} />
        <Input
          value={other}
          onChange={(e) => onOther(e.target.value)}
          placeholder="其它果樹（手動填入）"
          className="!w-48"
        />
      </div>
    </Field>
  );
}

export const targetsText = (targets: string[], other: string) =>
  [...targets, ...(other ? [other] : [])].join("、") || "—";

export function EditorRows({
  title,
  onAdd,
  addLabel = "新增一列",
  children,
}: {
  title: string;
  onAdd: () => void;
  addLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-stone-700">{title}</span>
        <Button size="sm" variant="secondary" onClick={onAdd}>
          <Plus size={14} /> {addLabel}
        </Button>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function DelBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg p-2 text-red-600 hover:bg-red-50" title="刪除">
      <Trash2 size={16} />
    </button>
  );
}

export function AttendanceEditor({
  rows,
  names,
  onChange,
}: {
  rows: Attendance[];
  names: string[];
  onChange: (rows: Attendance[]) => void;
}) {
  const upd = (id: string, patch: Partial<Attendance>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const day = todayStr();
  return (
    <EditorRows
      title="進場時間紀錄"
      addLabel="新增進場"
      onAdd={() =>
        onChange([...rows, { id: uid(), name: names[0] ?? "", in: `${day}T07:00`, out: `${day}T16:00` }])
      }
    >
      {rows.length === 0 && <p className="text-sm text-stone-400">尚無進場紀錄</p>}
      {rows.map((r) => (
        <div key={r.id} className="grid grid-cols-2 items-end gap-2 rounded-lg bg-white p-2 sm:grid-cols-[1fr_1.3fr_1.3fr_auto_auto]">
          <Field label="姓名">
            <Input list="attendance-names" value={r.name} onChange={(e) => upd(r.id, { name: e.target.value })} />
          </Field>
          <Field label="進場時間">
            <Input type="datetime-local" value={r.in} onChange={(e) => upd(r.id, { in: e.target.value })} />
          </Field>
          <Field label="離場時間">
            <Input type="datetime-local" value={r.out} onChange={(e) => upd(r.id, { out: e.target.value })} />
          </Field>
          <div className="pb-2 text-sm text-stone-500">{hoursBetween(r.in, r.out)} 小時</div>
          <DelBtn onClick={() => onChange(rows.filter((x) => x.id !== r.id))} />
        </div>
      ))}
      <datalist id="attendance-names">
        {names.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
    </EditorRows>
  );
}

export function BoxUsageEditor({
  title,
  rows,
  onChange,
}: {
  title: string;
  rows: BoxUsage[];
  onChange: (rows: BoxUsage[]) => void;
}) {
  const upd = (id: string, patch: Partial<BoxUsage>) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <EditorRows
      title={title}
      addLabel="新增箱數"
      onAdd={() => onChange([...rows, { id: uid(), type: BAG_TYPES[0].type, date: todayStr(), boxes: 1 }])}
    >
      {rows.length === 0 && <p className="text-sm text-stone-400">尚未登記紙袋</p>}
      {rows.map((r) => (
        <div key={r.id} className="grid grid-cols-2 items-end gap-2 rounded-lg bg-white p-2 sm:grid-cols-[1.4fr_1fr_0.7fr_auto_auto]">
          <Field label="類型">
            <Select value={r.type} onChange={(e) => upd(r.id, { type: e.target.value })}>
              {BAG_TYPES.map((b) => (
                <option key={b.type} value={b.type}>
                  {b.type}（{b.perBox.toLocaleString()} 袋/箱）
                </option>
              ))}
            </Select>
          </Field>
          <Field label="日期">
            <Input type="date" value={r.date} onChange={(e) => upd(r.id, { date: e.target.value })} />
          </Field>
          <Field label="箱數">
            <NumInput value={r.boxes} onChange={(v) => upd(r.id, { boxes: v })} />
          </Field>
          <div className="pb-2 text-sm text-stone-500">= {(r.boxes * bagsPerBox(r.type)).toLocaleString()} 袋</div>
          <DelBtn onClick={() => onChange(rows.filter((x) => x.id !== r.id))} />
        </div>
      ))}
    </EditorRows>
  );
}

export const boxesToBags = (rows: BoxUsage[]) => rows.reduce((s, r) => s + r.boxes * bagsPerBox(r.type), 0);

export function BentoToggle({ value, onChange }: { value: BentoMode; onChange: (v: BentoMode) => void }) {
  return (
    <Field label={`便當費用（每人每日 ${BENTO_PRICE} 元）`} group>
      <div className="flex gap-4 pt-1">
        {(["便當", "餐費補貼"] as const).map((m) => (
          <label key={m} className="flex items-center gap-1.5 text-sm">
            <input type="radio" className="accent-emerald-600" checked={value === m} onChange={() => onChange(m)} />
            {m === "便當" ? "每日一個便當" : `${BENTO_PRICE} 元餐費補貼`}
          </label>
        ))}
      </div>
    </Field>
  );
}

export function Formula({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{children}</p>;
}
