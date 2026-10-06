"use client";

import { useState } from "react";
import { Plus, Printer, Share2 } from "lucide-react";
import { useDB } from "@/lib/store";
import type { FertilizingRecord } from "@/lib/types";
import { fmtDT, materialName, money, nowStr, orchardLabel, uid } from "@/lib/utils";
import { useFertCost } from "@/components/fert-modal";
import { useRecordActions } from "@/components/record-actions";
import { RecordCalendar, RecordFilters, RecordsToolbar, useRecordsFilter } from "@/components/record-calendar";
import { targetsText } from "@/components/record-parts";
import { Button, Gallery, Modal, PageHeader, PrintArea, RowActions, Table, Td, Thumb } from "@/components/ui";

export default function FertilizingPage() {
  const db = useDB();
  const cost = useFertCost();
  const { edit, remove, dialogs } = useRecordActions();
  const [card, setCard] = useState<FertilizingRecord | null>(null);
  const open = (record: FertilizingRecord) => ({ kind: "fertilizing" as const, record });
  const filter = useRecordsFilter();
  const { year, view } = filter;
  const yearList = db.fertilizing.filter(filter.inYear);
  const list = yearList.filter(filter.matches).sort((a, b) => b.datetime.localeCompare(a.datetime));
  const count = filter.filtering ? `符合 ${list.length} / ${yearList.length} 筆施肥紀錄` : `共 ${yearList.length} 筆施肥紀錄`;
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
        action={<Button onClick={() => edit(open(create()))}><Plus size={16} /> 新增施肥紀錄</Button>}
      />
      <RecordsToolbar {...filter} count={view === "list" ? count : `共 ${yearList.length} 筆施肥紀錄`} />
      {view !== "list" ? (
        <RecordCalendar year={year} layout={view} />
      ) : (
        <>
          <RecordFilters {...filter} />
          <Table head={["施用日期時間", "果園", "肥料", "對象", "總包數", "費用", "員工", ""]}>
            {list.map((r) => {
              const c = cost(r);
              return (
                <tr key={r.id} className="hover:bg-stone-50">
                  <Td className="whitespace-nowrap">{fmtDT(r.datetime)}</Td>
                  <Td className="whitespace-nowrap font-medium">{db.orchards.find((o) => o.id === r.orchardId)?.nameZh ?? "—"}</Td>
                  <Td>{r.items.map((i) => mat(i.materialId)?.nameZh ?? "（已刪除）").join("、") || "—"}</Td>
                  <Td>{targetsText(r.targets, r.otherTarget)}</Td>
                  <Td>{c.packs} 包</Td>
                  <Td className="whitespace-nowrap font-semibold">{money(c.cost)}</Td>
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
              );
            })}
            {!list.length && (
              <tr>
                <Td colSpan={8} className="py-8 text-center text-stone-400">
                  {yearList.length ? "沒有符合篩選條件的施肥紀錄" : `${year} 年尚無施肥紀錄`}
                </Td>
              </tr>
            )}
          </Table>
        </>
      )}
      {dialogs}
      {card && <ReferenceCard record={card} onClose={() => setCard(null)} />}
    </>
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
      <PrintArea className="space-y-4 rounded-xl border-2 border-emerald-600 bg-white p-5">
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
      </PrintArea>
      <p className="mt-3 text-xs text-stone-500">可列印或存成 PDF 後透過 LINE 傳給員工。</p>
    </Modal>
  );
}
