"use client";

import { useState } from "react";
import { CalendarDays, List } from "lucide-react";
import { useDB } from "@/lib/store";
import type { FertilizingRecord, SprayingRecord } from "@/lib/types";
import { FertModal } from "./fert-modal";
import { RecordView } from "./record-view";
import { SprayCalendar, type OpenRecord } from "./spray-calendar";
import { SprayModal } from "./spray-modal";
import { Select } from "./ui";

export type RecordsView = "list" | "calendar";

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

/** 日曆：點日期先開唯讀檢視，按「修改」才進入噴藥／施肥的編輯表單 */
export function RecordCalendar({ year }: { year: number }) {
  const [browse, setBrowse] = useState<{ list: OpenRecord[]; index: number } | null>(null);
  const [spray, setSpray] = useState<SprayingRecord | null>(null);
  const [fert, setFert] = useState<FertilizingRecord | null>(null);
  const viewing = browse?.list[browse.index];
  return (
    <>
      <SprayCalendar year={year} onOpen={(list, index) => setBrowse({ list, index })} />
      {browse && viewing && (
        <RecordView
          open={viewing}
          nav={{
            index: browse.index,
            total: browse.list.length,
            go: (index) => setBrowse({ ...browse, index }),
          }}
          onClose={() => setBrowse(null)}
          onEdit={() => {
            if (viewing.kind === "spraying") setSpray(viewing.record);
            else setFert(viewing.record);
            setBrowse(null);
          }}
        />
      )}
      {spray && <SprayModal record={spray} onClose={() => setSpray(null)} />}
      {fert && <FertModal record={fert} onClose={() => setFert(null)} />}
    </>
  );
}
