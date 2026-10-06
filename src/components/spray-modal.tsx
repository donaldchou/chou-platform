"use client";

import { useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Sparkles } from "lucide-react";
import { fetchSprayAdvice, upsert, useDB } from "@/lib/store";
import { STAGES } from "@/lib/spray-advice";
import type { Material, SprayingRecord } from "@/lib/types";
import { defaultOrchard, fmtDT, materialCost, materialName, money, orchardLabel, uid } from "@/lib/utils";
import {
  DelBtn,
  EditorRows,
  EmployeePicker,
  Formula,
  OrchardSelect,
  TargetPicker,
  targetsText,
} from "./record-parts";
import {
  Button,
  Field,
  Input,
  Modal,
  NumInput,
  SearchSelect,
  SectionTitle,
  Select,
  Textarea,
  type SearchOption,
} from "./ui";

/** 新增／編輯噴藥紀錄（噴藥紀錄頁與日曆共用）；code 是打開前已驗證過的驗證碼，儲存時送給後端 */
export function SprayModal({ record, code, onClose }: { record: SprayingRecord; code?: string; onClose: () => void }) {
  const db = useDB();
  const [r, setR] = useState(record);
  const [thinking, setThinking] = useState(false);
  const set = <K extends keyof SprayingRecord>(k: K, v: SprayingRecord[K]) => setR((p) => ({ ...p, [k]: v }));
  const pesticides = db.materials.filter((m) => m.category === "pesticide");
  const ferts = db.materials.filter((m) => m.category === "fertilizer");
  const mat = (id: string) => db.materials.find((m) => m.id === id);
  // 搜尋時也比對廠商與成分說明
  const toOption = (group: string) => (m: Material): SearchOption => ({
    value: m.id,
    label: materialName(m),
    group,
    keywords: `${m.manufacturer ?? ""} ${m.targets}`,
  });
  const materialOptions = [...pesticides.map(toOption("農藥")), ...ferts.map(toOption("肥料"))];

  // 參考過去的噴藥紀錄：選果園＋日期後，把配方等內容帶入目前表單（不會存進資料庫）
  const [refOrchard, setRefOrchard] = useState(record.orchardId || defaultOrchard(db.orchards)?.id || "");
  const [refId, setRefId] = useState("");
  const [refYear, setRefYear] = useState(""); // YYYY，空白＝全部
  const orchardRecords = db.spraying.filter((x) => x.orchardId === refOrchard && x.id !== record.id);
  const refYears = [...new Set(orchardRecords.map((x) => x.datetime.slice(0, 4)).filter(Boolean))].sort().reverse();
  const refRecords = orchardRecords
    .filter((x) => x.datetime.startsWith(refYear))
    .sort((a, b) => b.datetime.localeCompare(a.datetime));

  function applyRef() {
    const src = refRecords.find((x) => x.id === refId);
    if (!src) return;
    if (r.items.length && !window.confirm("要用參考紀錄的內容取代目前已填的配方嗎？")) return;
    setR((p) => ({
      ...p,
      waterLiters: src.waterLiters,
      items: src.items.map((i) => ({ ...i, id: uid() })),
      targets: [...src.targets],
      otherTarget: src.otherTarget,
      employeeIds: [...src.employeeIds],
      stage: src.stage,
    }));
  }
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
          <Button onClick={() => { upsert("spraying", r, { code }); onClose(); }}>儲存</Button>
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
                {refRecords.length ? "請選擇要參考的噴藥紀錄" : refYear ? "這個年份沒有噴藥紀錄" : "此果園尚無噴藥紀錄"}
              </option>
              {refRecords.map((x) => (
                <option key={x.id} value={x.id}>
                  {fmtDT(x.datetime)}・{x.items.map((i) => mat(i.materialId)?.nameZh ?? "（已刪除）").join("、") || "無藥品"}
                </option>
              ))}
            </Select>
          </Field>
          <Button variant="secondary" onClick={applyRef} disabled={!refId}>帶入</Button>
        </div>
        <p className="mt-2 text-xs text-stone-500">帶入水量、配方、對象、人員與時間點，帶入後可再手動調整；果園與日期不會被覆蓋。</p>
      </div>

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
                  <SearchSelect
                    value={it.materialId}
                    options={materialOptions}
                    onChange={(id) => {
                      const nm = mat(id);
                      upd({ materialId: id, unit: nm?.unit === "ml" ? "cc" : "g" });
                    }}
                  />
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
