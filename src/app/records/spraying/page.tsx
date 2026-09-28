"use client";

import { useState } from "react";
import { AlertTriangle, Plus, Printer, Share2 } from "lucide-react";
import { useRecordActions } from "@/components/record-actions";
import { RecordCalendar, RecordsToolbar, useRecordsFilter } from "@/components/record-calendar";
import { targetsText } from "@/components/record-parts";
import { Button, Modal, PageHeader, RowActions, Table, Td, Thumb } from "@/components/ui";
import { STAGES } from "@/lib/spray-advice";
import { useDB } from "@/lib/store";
import type { SprayingRecord } from "@/lib/types";
import { fmtDT, materialCost, materialName, money, nowStr, orchardLabel, uid } from "@/lib/utils";

export default function SprayingPage() {
  const db = useDB();
  const { edit, remove, dialogs } = useRecordActions();
  const [card, setCard] = useState<SprayingRecord | null>(null);
  const filter = useRecordsFilter();
  const { year, view } = filter;
  const list = db.spraying.filter(filter.inYear).sort((a, b) => b.datetime.localeCompare(a.datetime));
  const mat = (id: string) => db.materials.find((m) => m.id === id);
  const cost = (r: SprayingRecord) => r.items.reduce((s, i) => s + materialCost(mat(i.materialId), i.amount), 0);
  const open = (record: SprayingRecord) => ({ kind: "spraying" as const, record });

  const create = (): SprayingRecord => ({
    id: uid(), orchardId: db.orchards[0]?.id ?? "", datetime: nowStr(), waterLiters: 500, items: [], targets: [],
    otherTarget: "", stage: STAGES[3], aiSuggestion: "", employeeIds: [], note: "",
  });

  return (
    <>
      <PageHeader
        title="噴藥紀錄"
        desc="記錄噴藥配方、加入順序、使用量與費用，並可取得 AI 用藥建議、產生參考卡給員工。"
        action={<Button onClick={() => edit(open(create()))}><Plus size={16} /> 新增噴藥紀錄</Button>}
      />
      <RecordsToolbar {...filter} count={`共 ${list.length} 筆噴藥紀錄`} />
      {view !== "list" ? (
        <RecordCalendar year={year} layout={view} />
      ) : (
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
              <Td>
                <div className="flex items-center justify-end">
                  <Button size="sm" variant="ghost" className="text-emerald-700" onClick={() => setCard(r)} title="員工參考卡">
                    <Share2 size={14} />
                  </Button>
                  <RowActions confirm={false} onEdit={() => edit(open(r))} onDelete={() => remove(open(r))} />
                </div>
              </Td>
            </tr>
          ))}
          {!list.length && <tr><Td colSpan={8} className="py-8 text-center text-stone-400">{year} 年尚無噴藥紀錄</Td></tr>}
        </Table>
      )}
      {dialogs}
      {card && <ReferenceCard record={card} onClose={() => setCard(null)} />}
    </>
  );
}

/** 噴藥工作單：給員工照著調配（依加入順序、用量、稀釋倍數、禁用提醒） */
function ReferenceCard({ record: r, onClose }: { record: SprayingRecord; onClose: () => void }) {
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
          <div className="text-xs text-stone-500">噴藥工作單</div>
          <div className="text-xl font-bold">{orchardLabel(o)}</div>
          <div className="text-sm text-stone-600">施用時間：{fmtDT(r.datetime)}</div>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><b>對象：</b>{targetsText(r.targets, r.otherTarget) || "—"}</div>
          <div><b>生長期：</b>{r.stage || "—"}</div>
          <div className="col-span-2 rounded-lg bg-sky-50 p-2 text-base"><b>用水量：</b>{r.waterLiters} 公升</div>
        </div>
        <div>
          <div className="mb-1 text-sm font-semibold">依序加入</div>
          <div className="space-y-2">
            {r.items.map((it, n) => {
              const m = db.materials.find((x) => x.id === it.materialId);
              return (
                <div key={it.id} className="flex gap-3 rounded-lg bg-stone-50 p-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-sm font-bold text-white">
                    {n + 1}
                  </span>
                  <Thumb src={m?.photos?.[0]} photos={m?.photos} showCount className="h-16 w-16" />
                  <div className="text-sm">
                    <div className="font-semibold">{materialName(m)}</div>
                    <div>用量 <b>{it.amount} {it.unit}</b>{Number(m?.dilution) > 0 && `（${m!.dilution} 倍）`}</div>
                    {m?.bannedPeriod && (
                      <div className="flex items-center gap-1 font-semibold text-red-600">
                        <AlertTriangle size={12} /> {m.bannedPeriod}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {!r.items.length && <p className="text-sm text-stone-400">尚未加入藥品</p>}
          </div>
        </div>
        {r.note && <div className="text-sm"><b>注意事項：</b>{r.note}</div>}
        <div className="text-sm">
          <b>負責員工：</b>
          {r.employeeIds.map((id) => db.employees.find((e) => e.id === id)?.name).filter(Boolean).join("、") || "—"}
        </div>
      </div>
      <p className="mt-3 text-xs text-stone-500">可列印或存成 PDF 後透過 LINE 傳給員工。</p>
    </Modal>
  );
}
