"use client";

import { useState } from "react";
import { CalendarDays, CalendarRange, List } from "lucide-react";
import { useDB } from "@/lib/store";
import { MonthRecords } from "./month-records";
import { useRecordActions } from "./record-actions";
import { RecordView } from "./record-view";
import { SprayCalendar, type CalendarLayout, type OnOpenMonth, type OpenRecord } from "./spray-calendar";
import { Select } from "./ui";

export type RecordsView = "list" | "calendar" | "month";

/** 噴藥／施肥紀錄頁共用：年度（清單和日曆一起連動）與顯示方式 */
export function useRecordsFilter() {
  const db = useDB();
  const thisYear = new Date().getFullYear();
  const years = [...new Set([thisYear, ...[...db.spraying, ...db.fertilizing].map((r) => Number(r.datetime.slice(0, 4)))])]
    .filter(Boolean)
    .sort((a, b) => b - a);
  const [year, setYear] = useState(thisYear);
  const [view, setView] = useState<RecordsView>("list");
  const inYear = (r: { datetime: string }) => r.datetime.startsWith(String(year));
  return { years, year, setYear, view, setView, inYear };
}

export function RecordsToolbar({
  years,
  year,
  setYear,
  view,
  setView,
  count,
}: ReturnType<typeof useRecordsFilter> & { count: string }) {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm text-stone-600">
        年度
        <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="!w-28">
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </Select>
      </label>
      <span className="text-sm text-stone-500">{count}</span>
      <div className="ml-auto flex rounded-lg border border-stone-300 bg-white p-0.5" role="group" aria-label="顯示方式">
        {(
          [
            { v: "list", label: "清單", icon: List },
            { v: "calendar", label: "日曆", icon: CalendarDays },
            { v: "month", label: "月曆", icon: CalendarRange },
          ] as const
        ).map(({ v, label, icon: Icon }) => (
          <button
            key={v}
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              view === v ? "bg-emerald-700 text-white" : "text-stone-600 hover:bg-stone-100"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * 日曆：點日期開上次／這次／下次三筆並排；月曆：點日期開同果樹所有果園當月的紀錄。
 * 都是唯讀，按「修改」並輸入驗證碼後才進入噴藥／施肥的編輯表單。
 */
export function RecordCalendar({ year, layout }: { year: number; layout: CalendarLayout }) {
  const [browse, setBrowse] = useState<{ list: OpenRecord[]; index: number } | null>(null);
  const [monthView, setMonthView] = useState<Parameters<OnOpenMonth>[0] | null>(null);
  const viewing = browse?.list[browse.index];
  const { edit, dialogs } = useRecordActions();
  return (
    <>
      <SprayCalendar
        year={year}
        layout={layout}
        onOpen={(list, index) => setBrowse({ list, index })}
        onOpenMonth={setMonthView}
      />
      {monthView && (
        <MonthRecords
          year={year}
          {...monthView}
          onClose={() => setMonthView(null)}
          onEdit={(o) => {
            edit(o);
            setMonthView(null);
          }}
        />
      )}
      {browse && viewing && (
        <RecordView
          list={browse.list}
          index={browse.index}
          go={(index) => setBrowse({ ...browse, index })}
          onClose={() => setBrowse(null)}
          onEdit={() => {
            edit(viewing);
            setBrowse(null);
          }}
        />
      )}
      {dialogs}
    </>
  );
}
