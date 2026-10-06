"use client";

import { useState } from "react";
import { useDB } from "@/lib/store";
import { FRUITS, type FertilizingRecord, type Material, type Orchard, type SprayingRecord } from "@/lib/types";

type Rec = SprayingRecord | FertilizingRecord;

/** 使用的藥品／肥料與倍數 */
type Entry = { name: string; rate: string };

/** 同一天的施用（可能有好幾筆紀錄，點日期時開啟第一筆） */
type Day = { date: string; tone: Tone; entries: Entry[]; record?: Rec };

/** pest＝農藥日期（藍）、fert＝肥料日期（橘） */
export type Tone = "pest" | "fert";

/**
 * 紀錄會出現在哪一種日期：噴藥紀錄有農藥（或還沒加藥品）算農藥、有肥料（葉面肥）算肥料；施肥紀錄算肥料。
 * 一筆噴藥紀錄可能兩種都算。
 */
export function tonesOf(r: Rec, category: (materialId: string) => string | undefined): Tone[] {
  if (!("stage" in r)) return ["fert"];
  const cats = r.items.map((i) => category(i.materialId));
  const pest = cats.includes("pesticide");
  const fert = cats.includes("fertilizer");
  return [...(pest || !fert ? (["pest"] as const) : []), ...(fert ? (["fert"] as const) : [])];
}

/** 日曆：果園在中間、左農藥右肥料；月曆：果園在左、1～12 月各一欄 */
export type CalendarLayout = "calendar" | "month";

export type OpenRecord = { kind: "spraying"; record: SprayingRecord } | { kind: "fertilizing"; record: FertilizingRecord };

/** 紀錄的對象是否包含這種果樹；沒選對象的紀錄視為整個果園都有施用 */
export function coversFruit(r: Rec, fruit: string) {
  if (!r.targets.length && !r.otherTarget.trim()) return true;
  return r.targets.includes(fruit) || r.otherTarget.split(/[、,，\s]+/).includes(fruit);
}

export function fruitsOf(o: Orchard) {
  const list: string[] = FRUITS.filter((f) => o.trees[f] > 0);
  if (o.trees.other > 0 && o.trees.otherName.trim()) list.push(o.trees.otherName.trim());
  return list;
}

const dilutionOf = (m?: Material) => (Number(m?.dilution) > 0 ? `${m!.dilution} 倍` : "");

/** 噴藥：顯示資材的使用倍數；資材沒填倍數時，用這次的用水量與用量換算 */
function sprayEntry(r: SprayingRecord, item: SprayingRecord["items"][number], m: Material): Entry {
  const rate =
    dilutionOf(m) || (item.amount > 0 && r.waterLiters > 0 ? `約 ${Math.round((r.waterLiters * 1000) / item.amount)} 倍` : "");
  return { name: m.nameZh, rate: rate || "未填倍數" };
}

/** 施肥：有稀釋倍數就顯示倍數，否則顯示每棵用量 */
function fertEntry(item: FertilizingRecord["items"][number], m?: Material): Entry {
  const rate =
    dilutionOf(m) ||
    (item.gramsPerTree > 0 ? `每棵 ${item.gramsPerTree} g` : item.litersPerTree > 0 ? `每棵 ${item.litersPerTree} L` : "");
  return { name: m?.nameZh ?? "（已刪除）", rate };
}

function addDay(days: Map<string, Day>, tone: Tone, date: string, entries: Entry[], record: Rec) {
  const d = days.get(date) ?? { date, tone, entries: [] };
  for (const e of entries) {
    if (!d.entries.some((x) => x.name === e.name && x.rate === e.rate)) d.entries.push(e);
  }
  d.record ??= record;
  days.set(date, d);
}

const sorted = (days: Map<string, Day>) => [...days.values()].sort((a, b) => a.date.localeCompare(b.date));

/** 1/11 這種月/日格式 */
const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** 點日期時傳出可前後切換的紀錄（日曆：同一格；月曆：同一列）與點到的位置 */
export type OnOpen = (list: OpenRecord[], index: number) => void;

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * 噴藥、施肥日期對照表，依果樹種類分組列出果園。
 * 噴藥紀錄裡有農藥就算農藥日期、有肥料（葉面肥）就算肥料日期；施肥紀錄都算肥料日期。
 */
/** 月曆點日期：開啟該果樹種類、該月份所有果園的噴藥（或施肥）紀錄 */
export type OnOpenMonth = (m: { fruit: string; month: number; tone: Tone; focusId: string }) => void;

export function SprayCalendar({
  year,
  layout,
  onOpen,
  onOpenMonth,
}: {
  year: number;
  layout: CalendarLayout;
  onOpen: OnOpen;
  onOpenMonth: OnOpenMonth;
}) {
  // 日曆：在同一格的日期之間前後切換
  const openIn = (list: Day[]) => (d: Day) => onOpen(list.map((x) => toOpen(x.record!)), list.indexOf(d));
  const db = useDB();
  const mat = (id: string) => db.materials.find((m) => m.id === id);
  const inYear = (r: Rec) => r.datetime.startsWith(String(year));
  const spraying = db.spraying.filter(inYear);
  const fertilizing = db.fertilizing.filter(inYear);

  function datesFor(orchardId: string, fruit: string) {
    const pest = new Map<string, Day>();
    const fert = new Map<string, Day>();
    // 先放施肥紀錄，同一天也有葉面肥噴藥時，點肥料日期優先開啟施肥紀錄
    for (const r of fertilizing) {
      if (r.orchardId !== orchardId || !coversFruit(r, fruit)) continue;
      addDay(fert, "fert", r.datetime.slice(0, 10), r.items.map((i) => fertEntry(i, mat(i.materialId))), r);
    }
    for (const r of spraying) {
      if (r.orchardId !== orchardId || !coversFruit(r, fruit)) continue;
      const date = r.datetime.slice(0, 10);
      const used = r.items.flatMap((i) => {
        const m = mat(i.materialId);
        return m ? [{ m, e: sprayEntry(r, i, m) }] : [];
      });
      const p = used.filter((u) => u.m.category === "pesticide").map((u) => u.e);
      const f = used.filter((u) => u.m.category === "fertilizer").map((u) => u.e);
      // 還沒加入藥品的噴藥紀錄仍算噴藥日期
      if (p.length || !f.length) addDay(pest, "pest", date, p, r);
      if (f.length) addDay(fert, "fert", date, f, r);
    }
    return { pest: sorted(pest), fert: sorted(fert) };
  }

  // 各果樹種類，列出有種植這種果樹的果園
  const groups = [...new Set(db.orchards.flatMap(fruitsOf))]
    .map((fruit) => ({ fruit, orchards: db.orchards.filter((o) => fruitsOf(o).includes(fruit)) }))
    .filter((g) => g.orchards.length);

  return (
    <div className="space-y-4">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
        {layout === "month" && (
          <>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-sky-200 ring-1 ring-inset ring-sky-400" />農藥</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-200 ring-1 ring-inset ring-amber-400" />肥料</span>
          </>
        )}
        滑鼠移到日期上可看使用的藥品／肥料與倍數；點日期可開啟該筆噴藥／施肥紀錄。
      </p>

      {!groups.length ? (
        <p className="rounded-xl border border-stone-200 bg-white py-8 text-center text-sm text-stone-400">
          尚無果園或果園未登錄果樹株數
        </p>
      ) : layout === "month" ? (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full min-w-[1100px] table-fixed text-sm">
            <colgroup>
              <col className="w-36" />
              {MONTHS.map((m) => <col key={m} />)}
            </colgroup>
            <thead className="bg-stone-50 text-xs text-stone-500">
              <tr>
                <th rowSpan={2} className="sticky left-0 z-10 border-r border-stone-200 bg-stone-50 px-3 py-2 text-left font-medium">
                  果園名稱
                </th>
                <th colSpan={12} className="border-b border-stone-200 px-3 py-2 text-left font-medium">農藥／肥料噴灑日期</th>
              </tr>
              <tr>
                {MONTHS.map((m) => (
                  <th key={m} className="border-l border-stone-100 px-1 py-2 text-center font-medium">{m}月</th>
                ))}
              </tr>
            </thead>
            {groups.map(({ fruit, orchards }) => (
              <tbody key={fruit} className="divide-y divide-stone-100 border-t-2 border-stone-300">
                <tr className="bg-emerald-50/60">
                  <td className="sticky left-0 z-10 border-r border-stone-200 bg-emerald-50 px-3 py-2 font-bold text-emerald-800">{fruit}</td>
                  <td colSpan={12} />
                </tr>
                {orchards.map((o) => {
                  const { pest, fert } = datesFor(o.id, fruit);
                  // 整列依日期排序，檢視視窗可在這座果園全年的噴藥、施肥之間切換
                  const row = [...pest, ...fert].sort((a, b) => a.date.localeCompare(b.date) || a.tone.localeCompare(b.tone));
                  return (
                    <tr key={o.id} className="hover:bg-stone-50">
                      <td className="sticky left-0 z-10 border-r border-stone-200 bg-white px-3 py-2 pl-6 font-medium text-stone-800">
                        {o.nameZh}
                      </td>
                      {MONTHS.map((m) => (
                        <td key={m} className="border-l border-stone-100 p-1 align-top">
                          <Dates
                            days={row.filter((d) => Number(d.date.slice(5, 7)) === m)}
                            onPick={(d) => onOpenMonth({ fruit, month: m, tone: d.tone, focusId: d.record!.id })}
                            empty=""
                          />
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
          <table className="w-full min-w-[640px] table-fixed text-sm">
            <colgroup>
              <col className="w-[40%]" />
              <col className="w-[20%]" />
              <col className="w-[40%]" />
            </colgroup>
            <thead className="bg-stone-50 text-xs text-stone-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">農藥噴灑日期</th>
                <th className="border-x border-stone-200 px-4 py-3 text-center font-medium">果園名稱</th>
                <th className="px-4 py-3 text-left font-medium">肥料施用日期</th>
              </tr>
            </thead>
            {groups.map(({ fruit, orchards }) => (
              <tbody key={fruit} className="divide-y divide-stone-100 border-t-2 border-stone-300">
                <tr className="bg-emerald-50/60">
                  <td />
                  <td className="border-x border-stone-200 px-4 py-2 text-center font-bold text-emerald-800">{fruit}</td>
                  <td />
                </tr>
                {orchards.map((o) => {
                  const { pest, fert } = datesFor(o.id, fruit);
                  return (
                    <tr key={o.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 align-middle"><Dates days={pest} onPick={openIn(pest)} /></td>
                      <td className="border-x border-stone-200 px-4 py-3 text-center font-medium text-stone-800">{o.nameZh}</td>
                      <td className="px-4 py-3 align-middle"><Dates days={fert} onPick={openIn(fert)} /></td>
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </div>
  );
}

export const toOpen = (r: Rec): OpenRecord =>
  // 只有噴藥紀錄有 stage（施肥紀錄也有 waterLiters，不能用來判斷）
  "stage" in r ?{ kind: "spraying", record: r } : { kind: "fertilizing", record: r };

const TONE: Record<Tone, string> = {
  pest: "bg-sky-50 text-sky-800 ring-sky-200 hover:bg-sky-100",
  fert: "bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100",
};

/** 一格裡的日期，點日期時呼叫 onPick */
function Dates({ days, onPick, empty = "—" }: { days: Day[]; onPick: (d: Day) => void; empty?: string }) {
  // 滑鼠移上去時的小視窗；用 fixed 定位，才不會被表格的捲動區塊裁掉
  const [tip, setTip] = useState<{ day: Day; left: number; top: number; above: boolean } | null>(null);
  if (!days.length) return <span className="text-stone-300">{empty}</span>;

  function show(day: Day, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const above = rect.bottom + 160 > window.innerHeight;
    setTip({
      day,
      left: Math.max(8, Math.min(rect.left, window.innerWidth - 248)),
      top: above ? rect.top - 6 : rect.bottom + 6,
      above,
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {days.map((d) => {
        return (
          <button
            key={d.tone + d.date}
            onClick={() => {
              setTip(null);
              onPick(d);
            }}
            onMouseEnter={(e) => show(d, e.currentTarget)}
            onMouseLeave={() => setTip(null)}
            onFocus={(e) => show(d, e.currentTarget)}
            onBlur={() => setTip(null)}
            aria-label={`${d.date} ${d.tone === "pest" ? "噴藥" : "施肥"}：${d.entries.map((x) => `${x.name} ${x.rate}`).join("、") || "未加入藥品"}`}
            className={`cursor-pointer rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset ${TONE[d.tone]}`}
          >
            {md(d.date)}
          </button>
        );
      })}
      {tip && (
        <div
          role="tooltip"
          style={{ left: tip.left, top: tip.top }}
          className={`pointer-events-none fixed z-50 w-60 rounded-lg border border-stone-200 bg-white p-3 text-xs shadow-lg ${
            tip.above ? "-translate-y-full" : ""
          }`}
        >
          <div className="mb-1.5 font-semibold text-stone-800">
            {tip.day.date}　{tip.day.tone === "pest" ? "噴藥" : "施肥"}
          </div>
          {tip.day.entries.length ? (
            <ul className="space-y-1">
              {tip.day.entries.map((e, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-stone-700">{e.name}</span>
                  <span className="shrink-0 font-medium tabular-nums text-stone-900">{e.rate}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-stone-400">未加入藥品</p>
          )}
        </div>
      )}
    </div>
  );
}
