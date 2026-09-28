"use client";

import { useState } from "react";
import { useDB } from "@/lib/store";
import { FRUITS, type FertilizingRecord, type Material, type Orchard, type SprayingRecord } from "@/lib/types";

type Rec = SprayingRecord | FertilizingRecord;

/** 使用的藥品／肥料與倍數 */
type Entry = { name: string; rate: string };

/** 同一天的施用（可能有好幾筆紀錄，點日期時開啟第一筆） */
type Day = { date: string; entries: Entry[]; record?: Rec };

export type OpenRecord = { kind: "spraying"; record: SprayingRecord } | { kind: "fertilizing"; record: FertilizingRecord };

/** 紀錄的對象是否包含這種果樹；沒選對象的紀錄視為整個果園都有施用 */
function coversFruit(r: Rec, fruit: string) {
  if (!r.targets.length && !r.otherTarget.trim()) return true;
  return r.targets.includes(fruit) || r.otherTarget.split(/[、,，\s]+/).includes(fruit);
}

function fruitsOf(o: Orchard) {
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

function addDay(days: Map<string, Day>, date: string, entries: Entry[], record: Rec) {
  const d = days.get(date) ?? { date, entries: [] };
  for (const e of entries) {
    if (!d.entries.some((x) => x.name === e.name && x.rate === e.rate)) d.entries.push(e);
  }
  d.record ??= record;
  days.set(date, d);
}

const sorted = (days: Map<string, Day>) => [...days.values()].sort((a, b) => a.date.localeCompare(b.date));

/** 1/11 這種月/日格式 */
const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/**
 * 噴藥、施肥日期對照表：依果樹種類分組，中間是果園，左邊農藥噴灑日期、右邊肥料施用日期。
 * 噴藥紀錄裡有農藥就算農藥日期、有肥料（葉面肥）就算肥料日期；施肥紀錄都算肥料日期。
 */
/** 點日期時傳出同一格（同果園、同果樹、同欄）的所有紀錄與點到的位置 */
export type OnOpen = (list: OpenRecord[], index: number) => void;

export function SprayCalendar({ year, onOpen }: { year: number; onOpen: OnOpen }) {
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
      addDay(fert, r.datetime.slice(0, 10), r.items.map((i) => fertEntry(i, mat(i.materialId))), r);
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
      if (p.length || !f.length) addDay(pest, date, p, r);
      if (f.length) addDay(fert, date, f, r);
    }
    return { pest: sorted(pest), fert: sorted(fert) };
  }

  // 各果樹種類，列出有種植這種果樹的果園
  const groups = [...new Set(db.orchards.flatMap(fruitsOf))]
    .map((fruit) => ({ fruit, orchards: db.orchards.filter((o) => fruitsOf(o).includes(fruit)) }))
    .filter((g) => g.orchards.length);

  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-500">滑鼠移到日期上可看使用的藥品／肥料與倍數；點日期可開啟該筆噴藥／施肥紀錄。</p>

      {!groups.length ? (
        <p className="rounded-xl border border-stone-200 bg-white py-8 text-center text-sm text-stone-400">
          尚無果園或果園未登錄果樹株數
        </p>
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
                      <td className="px-4 py-3 align-middle"><Dates days={pest} tone="pest" onOpen={onOpen} /></td>
                      <td className="border-x border-stone-200 px-4 py-3 text-center font-medium text-stone-800">{o.nameZh}</td>
                      <td className="px-4 py-3 align-middle"><Dates days={fert} tone="fert" onOpen={onOpen} /></td>
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

const toOpen = (r: Rec): OpenRecord =>
  // 噴藥紀錄有 waterLiters，施肥紀錄沒有
  "waterLiters" in r ? { kind: "spraying", record: r } : { kind: "fertilizing", record: r };

function Dates({ days, tone, onOpen }: { days: Day[]; tone: "pest" | "fert"; onOpen: OnOpen }) {
  // 滑鼠移上去時的小視窗；用 fixed 定位，才不會被表格的捲動區塊裁掉
  const [tip, setTip] = useState<{ day: Day; left: number; top: number; above: boolean } | null>(null);
  if (!days.length) return <span className="text-stone-300">—</span>;
  const color =
    tone === "pest"
      ? "bg-sky-50 text-sky-800 ring-sky-200 hover:bg-sky-100"
      : "bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100";

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
      {days.map((d, i) => {
        return (
          <button
            key={d.date}
            onClick={() => {
              setTip(null);
              // 同一格的日期依序傳出去，檢視視窗才能切換上一筆／下一筆
              onOpen(days.map((x) => toOpen(x.record!)), i);
            }}
            onMouseEnter={(e) => show(d, e.currentTarget)}
            onMouseLeave={() => setTip(null)}
            onFocus={(e) => show(d, e.currentTarget)}
            onBlur={() => setTip(null)}
            aria-label={`${d.date}：${d.entries.map((x) => `${x.name} ${x.rate}`).join("、") || "未加入藥品"}`}
            className={`cursor-pointer rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset ${color}`}
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
            {tip.day.date}　{tone === "pest" ? "噴藥" : "施肥"}
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
