"use client";

import { useState } from "react";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, List, Search, X } from "lucide-react";
import { useDB } from "@/lib/store";
import { FRUITS, type FertilizingRecord, type SprayingRecord } from "@/lib/types";
import { MonthRecords } from "./month-records";
import { useRecordActions } from "./record-actions";
import { RecordView } from "./record-view";
import { SprayCalendar, type CalendarLayout, type OnOpenMonth, type OpenRecord } from "./spray-calendar";
import { Button, Input, Select } from "./ui";

export type RecordsView = "list" | "calendar" | "month";

type Rec = SprayingRecord | FertilizingRecord;

const splitOther = (s: string) => s.split(/[、,，\s]+/).filter(Boolean);

/**
 * 噴藥／施肥紀錄頁共用：年度（清單和日曆一起連動）、顯示方式，
 * 以及清單的篩選（關鍵字、果園、對象、員工）。
 */
export function useRecordsFilter() {
  const db = useDB();
  const thisYear = new Date().getFullYear();
  const dataYears = [...db.spraying, ...db.fertilizing].map((r) => Number(r.datetime.slice(0, 4))).filter(Boolean);
  const [year, setYear] = useState(thisYear);
  const years = [...new Set([thisYear, year, ...dataYears])].sort((a, b) => b - a);
  // 上年度／下年度可以走到最早有資料的年度，往後最多到今年
  const minYear = Math.min(...years);
  const maxYear = Math.max(thisYear, ...dataYears);
  const [view, setView] = useState<RecordsView>("list");
  const inYear = (r: { datetime: string }) => r.datetime.startsWith(String(year));

  const [q, setQ] = useState("");
  const [orchardId, setOrchardId] = useState("");
  const [target, setTarget] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const filtering = !!(q.trim() || orchardId || target || employeeId);
  const clearFilters = () => {
    setQ("");
    setOrchardId("");
    setTarget("");
    setEmployeeId("");
  };

  const targetsOf = (r: Rec) => [...r.targets, ...splitOther(r.otherTarget)];
  // 對象選項：固定的果樹種類，加上紀錄裡手動填過的其它果樹
  const targetOptions = [...new Set([...FRUITS, ...[...db.spraying, ...db.fertilizing].flatMap((r) => splitOther(r.otherTarget))])];

  /** 關鍵字可以用空白分隔多個，全部都要符合；會搜尋日期、果園、對象、藥品／肥料、員工、生長期、備註 */
  function matches(r: Rec) {
    if (orchardId && r.orchardId !== orchardId) return false;
    if (target && !targetsOf(r).includes(target)) return false;
    if (employeeId && !r.employeeIds.includes(employeeId)) return false;
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return true;
    const o = db.orchards.find((x) => x.id === r.orchardId);
    const text = [
      r.datetime.replace("T", " "),
      o?.nameZh,
      o?.nameEn,
      ...targetsOf(r),
      ...r.items.flatMap((i) => {
        const m = db.materials.find((x) => x.id === i.materialId);
        return [m?.nameZh, m?.nameEn];
      }),
      ...r.employeeIds.map((id) => db.employees.find((e) => e.id === id)?.name),
      "stage" in r ? r.stage : "",
      r.note,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return terms.every((t) => text.includes(t));
  }

  return {
    years, year, setYear, minYear, maxYear, view, setView, inYear,
    q, setQ, orchardId, setOrchardId, target, setTarget, employeeId, setEmployeeId,
    targetOptions, filtering, clearFilters, matches,
  };
}

export function RecordsToolbar({
  years,
  year,
  setYear,
  minYear,
  maxYear,
  view,
  setView,
  count,
}: Pick<ReturnType<typeof useRecordsFilter>, "years" | "year" | "setYear" | "minYear" | "maxYear" | "view" | "setView"> & {
  count: string;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5 text-sm text-stone-600">
        <Button variant="secondary" disabled={year <= minYear} onClick={() => setYear(year - 1)} aria-label="上年度">
          <ChevronLeft size={16} /> <span className="hidden sm:inline">上年度</span>
        </Button>
        <label className="flex items-center gap-2">
          <span className="sr-only sm:not-sr-only">年度</span>
          <Select value={year} onChange={(e) => setYear(Number(e.target.value))} className="!w-28">
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </label>
        <Button variant="secondary" disabled={year >= maxYear} onClick={() => setYear(year + 1)} aria-label="下年度">
          <span className="hidden sm:inline">下年度</span> <ChevronRight size={16} />
        </Button>
      </div>
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

/** 清單上方的篩選列：關鍵字、果園、對象、員工 */
export function RecordFilters(f: ReturnType<typeof useRecordsFilter>) {
  const db = useDB();
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white p-3 shadow-sm">
      <div className="relative min-w-48 flex-1">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <Input
          type="search"
          value={f.q}
          onChange={(e) => f.setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && f.setQ("")}
          placeholder="關鍵字：藥品、肥料、備註、日期…"
          className="pl-9"
          aria-label="關鍵字"
        />
      </div>
      <Select value={f.orchardId} onChange={(e) => f.setOrchardId(e.target.value)} className="!w-auto min-w-36" aria-label="果園">
        <option value="">全部果園</option>
        {db.orchards.map((o) => <option key={o.id} value={o.id}>{o.nameZh}</option>)}
      </Select>
      <Select value={f.target} onChange={(e) => f.setTarget(e.target.value)} className="!w-auto min-w-32" aria-label="對象">
        <option value="">全部對象</option>
        {f.targetOptions.map((t) => <option key={t} value={t}>{t}</option>)}
      </Select>
      <Select value={f.employeeId} onChange={(e) => f.setEmployeeId(e.target.value)} className="!w-auto min-w-32" aria-label="員工">
        <option value="">全部員工</option>
        {db.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </Select>
      {f.filtering && (
        <Button variant="ghost" onClick={f.clearFilters} className="text-stone-600">
          <X size={16} /> 清除篩選
        </Button>
      )}
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
