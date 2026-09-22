"use client";

import { useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Plus, Sparkles } from "lucide-react";
import { fetchSprayAdvice, remove, upsert, useDB } from "@/lib/store";
import { STAGES } from "@/lib/spray-advice";
import type { SprayingRecord } from "@/lib/types";
import { fmtDT, materialCost, materialName, money, nowStr, uid } from "@/lib/utils";
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
} from "@/components/ui";

export default function SprayingPage() {
  const db = useDB();
  const [editing, setEditing] = useState<SprayingRecord | null>(null);
  const list = [...db.spraying].sort((a, b) => b.datetime.localeCompare(a.datetime));
  const mat = (id: string) => db.materials.find((m) => m.id === id);
  const cost = (r: SprayingRecord) => r.items.reduce((s, i) => s + materialCost(mat(i.materialId), i.amount), 0);

  const create = (): SprayingRecord => ({
    id: uid(), orchardId: db.orchards[0]?.id ?? "", datetime: nowStr(), waterLiters: 500, items: [], targets: [],
    otherTarget: "", stage: STAGES[3], aiSuggestion: "", employeeIds: [], note: "",
  });

  return (
    <>
      <PageHeader
        title="噴藥紀錄"
        desc="記錄噴藥配方、加入順序、使用量與費用，並可取得 AI 用藥建議。"
        action={<Button onClick={() => setEditing(create())}><Plus size={16} /> 新增噴藥紀錄</Button>}
      />
      <Table head={["施用日期時間", "果園", "用水量", "配方（加入順序）", "對象", "費用", "員工", ""]}>
        {list.map((r) => (
          <tr key={r.id} className="hover:bg-stone-50">
            <Td className="whitespace-nowrap">{fmtDT(r.datetime)}</Td>
            <Td className="font-medium">{db.orchards.find((o) => o.id === r.orchardId)?.nameZh ?? "—"}</Td>
            <Td>{r.waterLiters} L</Td>
            <Td>
              <ol className="space-y-0.5">
                {r.items.map((i, n) => (
                  <li key={i.id} className="text-xs">
                    {n + 1}. {mat(i.materialId)?.nameZh ?? "（已刪除）"} {i.amount}{i.unit}
                  </li>
                ))}
              </ol>
            </Td>
            <Td>{targetsText(r.targets, r.otherTarget)}</Td>
            <Td className="font-semibold">{money(cost(r))}</Td>
            <Td>{r.employeeIds.map((id) => db.employees.find((e) => e.id === id)?.name).filter(Boolean).join("、") || "—"}</Td>
            <Td><RowActions onEdit={() => setEditing(r)} onDelete={() => remove("spraying", r.id)} /></Td>
          </tr>
        ))}
        {!list.length && <tr><Td colSpan={8} className="py-8 text-center text-stone-400">尚無噴藥紀錄</Td></tr>}
      </Table>
      {editing && <SprayModal record={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function SprayModal({ record, onClose }: { record: SprayingRecord; onClose: () => void }) {
  const db = useDB();
  const [r, setR] = useState(record);
  const [thinking, setThinking] = useState(false);
  const set = <K extends keyof SprayingRecord>(k: K, v: SprayingRecord[K]) => setR((p) => ({ ...p, [k]: v }));
  const pesticides = db.materials.filter((m) => m.category === "pesticide");
  const ferts = db.materials.filter((m) => m.category === "fertilizer");
  const mat = (id: string) => db.materials.find((m) => m.id === id);
  const total = r.items.reduce((s, i) => s + materialCost(mat(i.materialId), i.amount), 0);

  function move(i: number, d: -1 | 1) {
    const items = [...r.items];
    [items[i], items[i + d]] = [items[i + d], items[i]];
    set("items", items);
  }

  const [aiNote, setAiNote] = useState("");

  async function askAI() {
    setThinking(true);
    setAiNote("");
    try {
      const res = await fetchSprayAdvice({
        stage: r.stage,
        targets: targetsText(r.targets, r.otherTarget),
        waterLiters: r.waterLiters,
        materialIds: r.items.map((i) => i.materialId),
      });
      set("aiSuggestion", res.advice);
      if (res.source === "fallback") setAiNote(res.reason ?? "");
    } catch (e) {
      alert(`取得建議失敗：${e instanceof Error ? e.message : e}`);
    } finally {
      setThinking(false);
    }
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title="噴藥紀錄"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={() => { upsert("spraying", r); onClose(); }}>儲存</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <OrchardSelect value={r.orchardId} onChange={(v) => set("orchardId", v)} />
        <Field label="施用日期時間">
          <Input type="datetime-local" value={r.datetime} onChange={(e) => set("datetime", e.target.value)} />
        </Field>
        <Field label="水使用總量（公升 L）">
          <NumInput value={r.waterLiters} onChange={(v) => set("waterLiters", v)} />
        </Field>
      </div>

      <SectionTitle>農藥／肥料（依加入順序）</SectionTitle>
      <EditorRows
        title="配方"
        addLabel="加入藥品／肥料"
        onAdd={() => {
          const first = pesticides[0] ?? ferts[0];
          if (!first) return alert("請先在「農藥」或「肥料」頁面建立資料。");
          set("items", [...r.items, { id: uid(), materialId: first.id, amount: 0, unit: first.unit === "ml" ? "cc" : "g" }]);
        }}
      >
        {r.items.length === 0 && <p className="text-sm text-stone-400">尚未加入藥品</p>}
        {r.items.map((it, i) => {
          const m = mat(it.materialId);
          const dil = Number(m?.dilution);
          const suggested = dil > 0 ? Math.round((r.waterLiters * 1000) / dil) : 0;
          const upd = (patch: Partial<typeof it>) =>
            set("items", r.items.map((x) => (x.id === it.id ? { ...x, ...patch } : x)));
          return (
            <div key={it.id} className="rounded-lg bg-stone-100 p-2">
              <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[auto_2fr_1fr_0.8fr_1fr_auto]">
                <div className="flex items-center gap-1 pb-1">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">{i + 1}</span>
                  <div className="flex flex-col">
                    <button disabled={i === 0} onClick={() => move(i, -1)} className="text-stone-500 disabled:opacity-20" title="往前"><ArrowUp size={14} /></button>
                    <button disabled={i === r.items.length - 1} onClick={() => move(i, 1)} className="text-stone-500 disabled:opacity-20" title="往後"><ArrowDown size={14} /></button>
                  </div>
                </div>
                <Field label="藥品／肥料品牌">
                  <Select
                    value={it.materialId}
                    onChange={(e) => {
                      const nm = mat(e.target.value);
                      upd({ materialId: e.target.value, unit: nm?.unit === "ml" ? "cc" : "g" });
                    }}
                  >
                    <optgroup label="農藥">
                      {pesticides.map((p) => <option key={p.id} value={p.id}>{materialName(p)}</option>)}
                    </optgroup>
                    <optgroup label="肥料">
                      {ferts.map((p) => <option key={p.id} value={p.id}>{materialName(p)}</option>)}
                    </optgroup>
                  </Select>
                </Field>
                <Field label="使用量">
                  <NumInput value={it.amount} onChange={(v) => upd({ amount: v })} />
                </Field>
                <Field label="單位">
                  <Select value={it.unit} onChange={(e) => upd({ unit: e.target.value as "cc" | "g" })}>
                    <option value="cc">毫升 cc</option>
                    <option value="g">公克 g</option>
                  </Select>
                </Field>
                <div className="pb-2 text-right text-sm">
                  <div className="text-xs text-stone-500">費用</div>
                  <b>{money(materialCost(m, it.amount))}</b>
                </div>
                <DelBtn onClick={() => set("items", r.items.filter((x) => x.id !== it.id))} />
              </div>
              <div className="mt-1 flex flex-wrap gap-2 pl-10 text-xs">
                {suggested > 0 && (
                  <button className="text-emerald-700 hover:underline" onClick={() => upd({ amount: suggested })}>
                    稀釋 {m?.dilution} 倍 → 建議用量 {suggested} {it.unit}（點此帶入）
                  </button>
                )}
                {m?.bannedPeriod && (
                  <span className="flex items-center gap-1 font-semibold text-red-600">
                    <AlertTriangle size={12} /> {m.bannedPeriod}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </EditorRows>
      <Formula>費用統計 <b>{money(total)}</b>（依各藥品包裝價格換算使用量）</Formula>

      <SectionTitle>對象與人員</SectionTitle>
      <div className="space-y-4">
        <TargetPicker value={r.targets} other={r.otherTarget} onChange={(v) => set("targets", v)} onOther={(v) => set("otherTarget", v)} />
        <EmployeePicker value={r.employeeIds} onChange={(v) => set("employeeIds", v)} />
      </div>

      <SectionTitle>AI 建議</SectionTitle>
      <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="果樹目前時間點" className="w-48">
            <Select value={r.stage} onChange={(e) => set("stage", e.target.value)}>
              {STAGES.map((s) => <option key={s}>{s}</option>)}
            </Select>
          </Field>
          <Button onClick={askAI} disabled={thinking} className="!bg-violet-600 hover:!bg-violet-700">
            <Sparkles size={16} /> {thinking ? "分析中…" : "取得 AI 建議"}
          </Button>
        </div>
        {aiNote && <p className="mt-2 text-xs text-stone-500">{aiNote}</p>}
        {r.aiSuggestion && (
          <p className="mt-3 whitespace-pre-line rounded-lg bg-white p-3 text-sm leading-relaxed text-stone-700">{r.aiSuggestion}</p>
        )}
      </div>

      <Field label="備註" className="mt-4">
        <Textarea value={r.note} onChange={(e) => set("note", e.target.value)} />
      </Field>
    </Modal>
  );
}
