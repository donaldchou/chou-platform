"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { useCanEdit, useDB } from "@/lib/store";
import { fmtDT } from "@/lib/utils";
import { RecordCard } from "./record-view";
import { coversFruit, fruitsOf, toOpen, tonesOf, type OpenRecord, type Tone } from "./spray-calendar";
import { Button, Modal } from "./ui";

const pad = (n: number) => String(n).padStart(2, "0");
const TONE_LABEL: Record<Tone, string> = { pest: "噴藥", fert: "施肥" };

/**
 * 月曆點日期後的視窗：同一種果樹的所有果園，當月全部噴藥（點農藥日期）或施肥（點肥料日期）紀錄，唯讀。
 * 每座果園一列、紀錄往右排，整個視窗共用一條左右捲動軸。
 * 每筆都有「修改」；上個月／下個月（或鍵盤 ← →）切換月份。
 */
export function MonthRecords({
  year,
  fruit,
  month: startMonth,
  tone,
  focusId,
  onClose,
  onEdit,
}: {
  year: number;
  fruit: string;
  month: number;
  tone: Tone;
  focusId: string;
  onClose: () => void;
  onEdit: (o: OpenRecord) => void;
}) {
  const db = useDB();
  const canEdit = useCanEdit();
  const [month, setMonth] = useState(startMonth);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setMonth((m) => Math.max(1, m - 1));
      else if (e.key === "ArrowRight") setMonth((m) => Math.min(12, m + 1));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // 打開時捲到點的那一筆
  useEffect(() => {
    document.getElementById(`rec-${focusId}`)?.scrollIntoView({ block: "center", inline: "center" });
  }, [focusId]);

  const category = (id: string) => db.materials.find((m) => m.id === id)?.category;
  const prefix = `${year}-${pad(month)}`;
  const records = [...db.spraying, ...db.fertilizing]
    .filter((r) => r.datetime.startsWith(prefix) && coversFruit(r, fruit) && tonesOf(r, category).includes(tone))
    .sort((a, b) => a.datetime.localeCompare(b.datetime))
    .map(toOpen);
  const orchards = db.orchards
    .filter((o) => fruitsOf(o).includes(fruit))
    .map((o) => ({ orchard: o, list: records.filter((r) => r.record.orchardId === o.id) }));
  const total = orchards.reduce((s, o) => s + o.list.length, 0);
  const badge = tone === "pest" ? "bg-sky-50 text-sky-800 ring-sky-200" : "bg-amber-50 text-amber-800 ring-amber-200";

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`${year} 年 ${month} 月・${fruit}・${TONE_LABEL[tone]}紀錄`}
      footer={
        <>
          <div className="mr-auto flex items-center gap-1">
            <Button variant="secondary" disabled={month === 1} onClick={() => setMonth(month - 1)} aria-label="上個月">
              <ChevronLeft size={16} /> <span className="hidden sm:inline">上個月</span>
            </Button>
            <Button variant="secondary" disabled={month === 12} onClick={() => setMonth(month + 1)} aria-label="下個月">
              <span className="hidden sm:inline">下個月</span> <ChevronRight size={16} />
            </Button>
          </div>
          <Button variant="secondary" onClick={onClose}>關閉</Button>
        </>
      }
    >
      {/* 內容比視窗寬時，由視窗內容區下方的捲動軸左右拖拉 */}
      <div className="w-max min-w-full">
        <p className="sticky left-0 mb-4 w-fit text-sm text-stone-600">
          共 <b className={tone === "pest" ? "text-sky-700" : "text-amber-700"}>{total}</b> 筆{TONE_LABEL[tone]}紀錄
        </p>

        <div className="divide-y divide-stone-200 border-y border-stone-200">
          {orchards.map(({ orchard, list }) => (
            <section key={orchard.id} className="flex items-stretch">
              {/* 果園名稱固定在左邊，往右捲時仍看得到；-ml-5／pl-5 蓋住視窗內距，捲動的卡片才不會從左邊露出來 */}
              <h3 className="sticky -left-5 z-10 -ml-5 flex w-37 shrink-0 flex-col justify-center border-r border-stone-200 bg-stone-50 py-3 pl-5 pr-3 text-base font-semibold text-stone-800">
                {orchard.nameZh}
                <span className="text-xs font-normal text-stone-500">{list.length} 筆</span>
              </h3>
              <div className="flex flex-nowrap gap-3 py-3 pl-3">
                {list.length ? (
                  list.map((o) => {
                    const focus = o.record.id === focusId;
                    return (
                      <article
                        key={o.record.id}
                        id={`rec-${o.record.id}`}
                        className={`w-72 shrink-0 rounded-xl border p-3 ${
                          focus ? "border-emerald-500 bg-white shadow-sm ring-1 ring-emerald-500" : "border-stone-200 bg-white"
                        }`}
                      >
                        <div className="mb-2 flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${badge}`}>
                            {o.kind === "spraying" ? "噴藥" : "施肥"}
                          </span>
                          <span className="text-sm font-semibold tabular-nums text-stone-800">{fmtDT(o.record.datetime)}</span>
                          {canEdit && (
                            <Button size="sm" variant="ghost" className="ml-auto text-emerald-700" onClick={() => onEdit(o)}>
                              <Pencil size={14} /> 修改
                            </Button>
                          )}
                        </div>
                        <RecordCard open={o} showKind={false} />
                      </article>
                    );
                  })
                ) : (
                  <p className="self-center py-3 text-sm text-stone-400">本月無{TONE_LABEL[tone]}紀錄</p>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
}
