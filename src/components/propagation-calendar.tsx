"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { useCanEdit, useDB } from "@/lib/store";
import { PROPAGATION_KINDS, type PropagationKind, type PropagationRecord } from "@/lib/types";
import { fruitsOf, type CalendarLayout } from "./spray-calendar";
import { Button, Gallery, Modal, type Tone } from "./ui";

export const KINDS = Object.keys(PROPAGATION_KINDS) as PropagationKind[];
export const KIND_TONE: Record<PropagationKind, Tone> = { planting: "green", grafting: "blue", girdling: "amber" };

/** 日期按鈕的顏色：種植綠、嫁接藍、環剝橘（跟清單的標籤同色系） */
const CHIP: Record<PropagationKind, string> = {
  planting: "bg-emerald-50 text-emerald-800 ring-emerald-200 hover:bg-emerald-100",
  grafting: "bg-sky-50 text-sky-800 ring-sky-200 hover:bg-sky-100",
  girdling: "bg-amber-50 text-amber-800 ring-amber-200 hover:bg-amber-100",
};
const SWATCH: Record<PropagationKind, string> = {
  planting: "bg-emerald-200 ring-emerald-400",
  grafting: "bg-sky-200 ring-sky-400",
  girdling: "bg-amber-200 ring-amber-400",
};

/** 成活率：沒填成活株數時顯示「—」 */
export const survivalText = (r: PropagationRecord) =>
  r.kind === "girdling" || !r.survived || !r.count
    ? "—"
    : `${r.survived}/${r.count}（${Math.round((r.survived / r.count) * 100)}%）`;

const NO_FRUIT = "未填果樹";
const fruitOf = (r: PropagationRecord) => r.fruit.trim() || NO_FRUIT;
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
const byDate = (a: PropagationRecord, b: PropagationRecord) => a.date.localeCompare(b.date);

/**
 * 種苗／嫁接／環剝的日期對照表，依果樹分組列出果園。
 * 日曆：果園一列，種植／嫁接／環剝各一欄；月曆：果園一列，1～12 月各一欄。
 * 點日期開唯讀檢視，按「修改」呼叫 onEdit。
 */
export function PropagationCalendar({
  year,
  layout,
  onEdit,
}: {
  year: number;
  layout: CalendarLayout;
  onEdit: (r: PropagationRecord) => void;
}) {
  const db = useDB();
  const [browse, setBrowse] = useState<{ list: PropagationRecord[]; index: number } | null>(null);
  const [monthView, setMonthView] = useState<{ fruit: string; month: number; kind: PropagationKind; focusId: string } | null>(null);
  const records = db.propagation.filter((r) => r.date.startsWith(String(year)));

  // 果樹分組：有種這種果樹的果園，加上今年在這個果樹（例如砧木）有紀錄的果園
  const groups = [...new Set([...db.orchards.flatMap(fruitsOf), ...records.map(fruitOf)])]
    .map((fruit) => ({
      fruit,
      orchards: db.orchards.filter(
        (o) => fruitsOf(o).includes(fruit) || records.some((r) => r.orchardId === o.id && fruitOf(r) === fruit),
      ),
    }))
    .filter((g) => g.orchards.length);

  const cell = (orchardId: string, fruit: string) =>
    records.filter((r) => r.orchardId === orchardId && fruitOf(r) === fruit).sort(byDate);

  return (
    <div className="space-y-4">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-stone-500">
        {layout === "month" &&
          KINDS.map((k) => (
            <span key={k} className="flex items-center gap-1">
              <span className={`h-3 w-3 rounded ring-1 ring-inset ${SWATCH[k]}`} />
              {PROPAGATION_KINDS[k]}
            </span>
          ))}
        滑鼠移到日期上可看品種與株數；點日期可開啟該筆紀錄。
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
                <th colSpan={12} className="border-b border-stone-200 px-3 py-2 text-left font-medium">種植／嫁接／環剝日期</th>
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
                  const row = cell(o.id, fruit);
                  return (
                    <tr key={o.id} className="hover:bg-stone-50">
                      <td className="sticky left-0 z-10 border-r border-stone-200 bg-white px-3 py-2 pl-6 font-medium text-stone-800">
                        {o.nameZh}
                      </td>
                      {MONTHS.map((m) => (
                        <td key={m} className="border-l border-stone-100 p-1 align-top">
                          <Dates
                            list={row.filter((r) => Number(r.date.slice(5, 7)) === m)}
                            onPick={(r) => setMonthView({ fruit, month: m, kind: r.kind, focusId: r.id })}
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
          <table className="w-full min-w-[760px] table-fixed text-sm">
            <colgroup>
              <col className="w-[19%]" />
              <col className="w-[27%]" />
              <col className="w-[27%]" />
              <col className="w-[27%]" />
            </colgroup>
            <thead className="bg-stone-50 text-xs text-stone-500">
              <tr>
                <th className="border-r border-stone-200 px-4 py-3 text-center font-medium">果園名稱</th>
                {KINDS.map((k) => (
                  <th key={k} className="px-4 py-3 text-left font-medium">{PROPAGATION_KINDS[k]}日期</th>
                ))}
              </tr>
            </thead>
            {groups.map(({ fruit, orchards }) => (
              <tbody key={fruit} className="divide-y divide-stone-100 border-t-2 border-stone-300">
                <tr className="bg-emerald-50/60">
                  <td className="border-r border-stone-200 px-4 py-2 text-center font-bold text-emerald-800">{fruit}</td>
                  <td colSpan={3} />
                </tr>
                {orchards.map((o) => {
                  const row = cell(o.id, fruit);
                  return (
                    <tr key={o.id} className="hover:bg-stone-50">
                      <td className="border-r border-stone-200 px-4 py-3 text-center font-medium text-stone-800">{o.nameZh}</td>
                      {KINDS.map((k) => {
                        const list = row.filter((r) => r.kind === k);
                        return (
                          <td key={k} className="px-4 py-3 align-middle">
                            <Dates list={list} onPick={(r) => setBrowse({ list, index: list.indexOf(r) })} />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
        </div>
      )}

      {browse && browse.list[browse.index] && (
        <PropagationView
          list={browse.list}
          index={browse.index}
          go={(index) => setBrowse({ ...browse, index })}
          onClose={() => setBrowse(null)}
          onEdit={(r) => {
            onEdit(r);
            setBrowse(null);
          }}
        />
      )}
      {monthView && (
        <PropagationMonth
          year={year}
          {...monthView}
          onClose={() => setMonthView(null)}
          onEdit={(r) => {
            onEdit(r);
            setMonthView(null);
          }}
        />
      )}
    </div>
  );
}

/** 一格裡的日期；滑鼠移上去顯示品種與株數 */
function Dates({
  list,
  onPick,
  empty = "—",
}: {
  list: PropagationRecord[];
  onPick: (r: PropagationRecord) => void;
  empty?: string;
}) {
  // 用 fixed 定位，才不會被表格的捲動區塊裁掉
  const [tip, setTip] = useState<{ r: PropagationRecord; left: number; top: number; above: boolean } | null>(null);
  if (!list.length) return <span className="text-stone-300">{empty}</span>;

  function show(r: PropagationRecord, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const above = rect.bottom + 140 > window.innerHeight;
    setTip({ r, left: Math.max(8, Math.min(rect.left, window.innerWidth - 248)), top: above ? rect.top - 6 : rect.bottom + 6, above });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((r) => (
        <button
          key={r.id}
          onClick={() => {
            setTip(null);
            onPick(r);
          }}
          onMouseEnter={(e) => show(r, e.currentTarget)}
          onMouseLeave={() => setTip(null)}
          onFocus={(e) => show(r, e.currentTarget)}
          onBlur={() => setTip(null)}
          aria-label={`${r.date} ${PROPAGATION_KINDS[r.kind]}：${r.variety || r.fruit} ${r.count} 株`}
          className={`cursor-pointer rounded-md px-2 py-0.5 text-xs font-medium tabular-nums ring-1 ring-inset ${CHIP[r.kind]}`}
        >
          {md(r.date)}
        </button>
      ))}
      {tip && (
        <div
          role="tooltip"
          style={{ left: tip.left, top: tip.top }}
          className={`pointer-events-none fixed z-50 w-60 rounded-lg border border-stone-200 bg-white p-3 text-xs shadow-lg ${
            tip.above ? "-translate-y-full" : ""
          }`}
        >
          <div className="mb-1.5 font-semibold text-stone-800">
            {tip.r.date}　{PROPAGATION_KINDS[tip.r.kind]}
          </div>
          <TipRows r={tip.r} />
        </div>
      )}
    </div>
  );
}

function TipRows({ r }: { r: PropagationRecord }) {
  const rows: [string, string][] = [
    [r.kind === "grafting" ? "接穗品種" : "品種", [r.fruit, r.variety].filter(Boolean).join(" ") || "—"],
    ...(r.kind === "grafting" ? ([["砧木", r.rootstock || "—"]] as [string, string][]) : []),
    ...(r.kind === "girdling" && r.girdleWidth ? ([["環剝寬度", `${r.girdleWidth} cm`]] as [string, string][]) : []),
    ["株數", r.count ? `${r.count} 株` : "—"],
    ...(r.kind !== "girdling" ? ([["成活", survivalText(r)]] as [string, string][]) : []),
    ...(r.location ? ([["位置", r.location]] as [string, string][]) : []),
  ];
  return (
    <ul className="space-y-1">
      {rows.map(([k, v]) => (
        <li key={k} className="flex justify-between gap-3">
          <span className="text-stone-500">{k}</span>
          <span className="truncate font-medium text-stone-900">{v}</span>
        </li>
      ))}
    </ul>
  );
}

/** 一筆紀錄的精簡內容（唯讀） */
export function PropagationCard({ r, showKind = true }: { r: PropagationRecord; showKind?: boolean }) {
  const db = useDB();
  const people = r.employeeIds.map((id) => db.employees.find((e) => e.id === id)?.name).filter(Boolean).join("、");
  const info: [string, React.ReactNode][] = [
    ...(showKind ? ([["項目", PROPAGATION_KINDS[r.kind]]] as [string, React.ReactNode][]) : []),
    ["果樹", r.fruit || "—"],
    [r.kind === "grafting" ? "接穗品種" : "品種", r.variety || "—"],
    ...(r.kind === "grafting" ? ([["砧木", r.rootstock || "—"]] as [string, React.ReactNode][]) : []),
    ...(r.kind === "planting" ? ([["苗木來源", r.seedlingSource || "—"]] as [string, React.ReactNode][]) : []),
    ...(r.kind === "girdling" ? ([["環剝寬度", r.girdleWidth ? `${r.girdleWidth} cm` : "—"]] as [string, React.ReactNode][]) : []),
    ["區塊／位置", r.location || "—"],
    ["株數", r.count ? `${r.count} 株` : "—"],
    ...(r.kind !== "girdling"
      ? ([
          ["成活檢查日期", r.checkDate || "—"],
          ["成活", survivalText(r)],
        ] as [string, React.ReactNode][])
      : []),
    ["員工", people || "—"],
  ];
  return (
    <div className="space-y-3 text-sm">
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
        {info.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-stone-500">{label}</dt>
            <dd className="truncate font-medium text-stone-800">{value}</dd>
          </div>
        ))}
      </dl>
      {r.photos.length > 0 && <Gallery photos={r.photos} size="h-14 w-14" />}
      {r.note && <p className="whitespace-pre-line text-xs text-stone-600"><b>備註：</b>{r.note}</p>}
    </div>
  );
}

/** 日曆點日期：上次／這次／下次三筆並排，← → 切換 */
function PropagationView({
  list,
  index,
  go,
  onClose,
  onEdit,
}: {
  list: PropagationRecord[];
  index: number;
  go: (index: number) => void;
  onClose: () => void;
  onEdit: (r: PropagationRecord) => void;
}) {
  const db = useDB();
  const canEdit = useCanEdit();
  const total = list.length;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && index > 0) go(index - 1);
      else if (e.key === "ArrowRight" && index < total - 1) go(index + 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, total, go]);

  const current = list[index];
  const orchard = db.orchards.find((o) => o.id === current.orchardId)?.nameZh;
  const slots = [
    { role: "上次", r: list[index - 1], empty: "沒有上一次紀錄" },
    { role: "這次", r: current, empty: "" },
    { role: "下次", r: list[index + 1], empty: "沒有下一次紀錄" },
  ];

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`${orchard ? `${orchard}・` : ""}${PROPAGATION_KINDS[current.kind]}紀錄`}
      footer={
        <>
          {total > 1 && (
            <div className="mr-auto flex items-center gap-1">
              <Button variant="secondary" disabled={index === 0} onClick={() => go(index - 1)} aria-label="上一筆">
                <ChevronLeft size={16} /> <span className="hidden sm:inline">上一筆</span>
              </Button>
              <span className="min-w-14 text-center text-sm tabular-nums text-stone-500">{index + 1} / {total}</span>
              <Button variant="secondary" disabled={index === total - 1} onClick={() => go(index + 1)} aria-label="下一筆">
                <span className="hidden sm:inline">下一筆</span> <ChevronRight size={16} />
              </Button>
            </div>
          )}
          <Button variant="secondary" onClick={onClose}>關閉</Button>
          {canEdit && <Button onClick={() => onEdit(current)}><Pencil size={15} /> 修改這次</Button>}
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-3">
        {slots.map(({ role, r, empty }) => {
          const isCurrent = role === "這次";
          return (
            <section
              key={role}
              className={`flex flex-col rounded-xl border p-3 ${
                isCurrent ? "order-first border-emerald-500 bg-white shadow-sm ring-1 ring-emerald-500 md:order-none" : "border-stone-200 bg-stone-50"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                    isCurrent ? "bg-emerald-700 text-white" : "bg-stone-200 text-stone-600"
                  }`}
                >
                  {role}
                </span>
                {r && (
                  <button
                    type="button"
                    onClick={() => !isCurrent && go(list.indexOf(r))}
                    disabled={isCurrent}
                    className="text-sm font-semibold tabular-nums text-stone-800 enabled:cursor-pointer enabled:hover:text-emerald-700 enabled:hover:underline"
                    title={isCurrent ? undefined : "以這筆為中心查看"}
                  >
                    {r.date}
                  </button>
                )}
              </div>
              {r ? <PropagationCard r={r} showKind={false} /> : <p className="py-8 text-center text-sm text-stone-400">{empty}</p>}
            </section>
          );
        })}
      </div>
    </Modal>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 月曆點日期：同一種果樹所有果園、當月同項目的紀錄；上個月／下個月（← →）切換 */
function PropagationMonth({
  year,
  fruit,
  month: startMonth,
  kind,
  focusId,
  onClose,
  onEdit,
}: {
  year: number;
  fruit: string;
  month: number;
  kind: PropagationKind;
  focusId: string;
  onClose: () => void;
  onEdit: (r: PropagationRecord) => void;
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

  useEffect(() => {
    document.getElementById(`prop-${focusId}`)?.scrollIntoView({ block: "center", inline: "center" });
  }, [focusId]);

  const label = PROPAGATION_KINDS[kind];
  const records = db.propagation
    .filter((r) => r.date.startsWith(`${year}-${pad(month)}`) && r.kind === kind && fruitOf(r) === fruit)
    .sort(byDate);
  const orchards = db.orchards
    .filter((o) => fruitsOf(o).includes(fruit) || records.some((r) => r.orchardId === o.id))
    .map((o) => ({ orchard: o, list: records.filter((r) => r.orchardId === o.id) }));

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`${year} 年 ${month} 月・${fruit}・${label}紀錄`}
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
      <div className="w-max min-w-full">
        <p className="sticky left-0 mb-4 w-fit text-sm text-stone-600">
          共 <b className="text-emerald-700">{records.length}</b> 筆{label}紀錄
        </p>
        <div className="divide-y divide-stone-200 border-y border-stone-200">
          {orchards.map(({ orchard, list }) => (
            <section key={orchard.id} className="flex items-stretch">
              <h3 className="sticky -left-5 z-10 -ml-5 flex w-37 shrink-0 flex-col justify-center border-r border-stone-200 bg-stone-50 py-3 pl-5 pr-3 text-base font-semibold text-stone-800">
                {orchard.nameZh}
                <span className="text-xs font-normal text-stone-500">{list.length} 筆</span>
              </h3>
              <div className="flex flex-nowrap gap-3 py-3 pl-3">
                {list.length ? (
                  list.map((r) => (
                    <article
                      key={r.id}
                      id={`prop-${r.id}`}
                      className={`w-72 shrink-0 rounded-xl border p-3 ${
                        r.id === focusId ? "border-emerald-500 bg-white shadow-sm ring-1 ring-emerald-500" : "border-stone-200 bg-white"
                      }`}
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${CHIP[r.kind]}`}>{label}</span>
                        <span className="text-sm font-semibold tabular-nums text-stone-800">{r.date}</span>
                        {canEdit && (
                          <Button size="sm" variant="ghost" className="ml-auto text-emerald-700" onClick={() => onEdit(r)}>
                            <Pencil size={14} /> 修改
                          </Button>
                        )}
                      </div>
                      <PropagationCard r={r} showKind={false} />
                    </article>
                  ))
                ) : (
                  <p className="self-center py-3 text-sm text-stone-400">本月無{label}紀錄</p>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Modal>
  );
}
