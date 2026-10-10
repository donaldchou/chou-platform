"use client";

import { Fragment, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { FRUITS } from "@/lib/types";
import { Input, Table, Td } from "./ui";

/** 欄位：有 sort 的欄位可以點標題排序 */
export interface SortCol<T> {
  key: string;
  label: string;
  cell: (r: T) => ReactNode;
  sort?: (a: T, b: T) => number;
  /** 第一次點這一欄時由大到小（例如日期） */
  descFirst?: boolean;
  className?: string;
}

type GroupOf = { key: string; label: string; rank: [number, string] };

/**
 * 分組方式：of 回傳這一列屬於哪一組；rank 決定組的順序（先比數字再比文字）。
 * 回傳多組時（例如複選的作物），這一列會出現在每一組裡。
 */
export interface GroupDef<T> {
  value: string;
  label: string;
  of: (r: T) => GroupOf | GroupOf[];
}

/** 作物依常用順序，其他的排後面、空白最後 */
export const fruitRank = (f: string) => {
  const i = (FRUITS as readonly string[]).indexOf(f);
  return i < 0 ? (f ? FRUITS.length : FRUITS.length + 1) : i;
};

export const zh = (a: string, b: string) => a.localeCompare(b, "zh-Hant");

/**
 * 可排序、可分組的表格。
 * 排序相同時用 tiebreak（例如日期新到舊）；分組時組的順序固定，組內照目前的排序。
 */
export function SortableTable<T>({
  rows,
  cols,
  groups,
  rowKey,
  actions,
  empty,
  summary,
  defaultSort,
  tiebreak,
  searchText,
  searchPlaceholder = "關鍵字",
}: {
  rows: T[];
  cols: SortCol<T>[];
  groups: GroupDef<T>[];
  rowKey: (r: T) => string;
  actions?: (r: T) => ReactNode;
  empty: ReactNode;
  /** 每組標題後面的統計（預設只有筆數） */
  summary?: (rows: T[]) => ReactNode;
  defaultSort: { key: string; desc: boolean };
  tiebreak?: (a: T, b: T) => number;
  /** 有給才顯示關鍵字搜尋：回傳這一列可以被搜尋的文字 */
  searchText?: (r: T) => string;
  searchPlaceholder?: string;
}) {
  const [sort, setSort] = useState(defaultSort);
  const [group, setGroup] = useState("none");
  const [q, setQ] = useState("");

  // 關鍵字：空白分開的每個詞都要出現（不分大小寫）
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const shown =
    searchText && terms.length
      ? rows.filter((r) => {
          const text = searchText(r).toLowerCase();
          return terms.every((t) => text.includes(t));
        })
      : rows;

  const sortCol = cols.find((c) => c.key === sort.key && c.sort);
  const sorted = [...shown].sort((a, b) => {
    const c = sortCol ? sortCol.sort!(a, b) : 0;
    return (sort.desc ? -c : c) || (tiebreak?.(a, b) ?? 0);
  });

  const def = groups.find((g) => g.value === group);
  const activeGroup = def ? group : "none";
  const grouped: (GroupOf & { rows: T[] })[] = [];
  if (def) {
    for (const r of sorted) {
      const of = def.of(r);
      for (const g of Array.isArray(of) ? of : [of]) {
        const found = grouped.find((x) => x.key === g.key);
        if (found) {
          if (!found.rows.includes(r)) found.rows.push(r);
        } else grouped.push({ ...g, rows: [r] });
      }
    }
    grouped.sort((a, b) => a.rank[0] - b.rank[0] || zh(a.rank[1], b.rank[1]));
  }

  const width = cols.length + (actions ? 1 : 0);
  const head = [
    ...cols.map((c) =>
      c.sort ? (
        <button
          key={c.key}
          type="button"
          className={`inline-flex items-center gap-1 hover:text-stone-800 ${sort.key === c.key ? "text-stone-800" : ""}`}
          onClick={() => setSort((s) => (s.key === c.key ? { key: c.key, desc: !s.desc } : { key: c.key, desc: !!c.descFirst }))}
        >
          {c.label}
          {sort.key === c.key ? (
            sort.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />
          ) : (
            <ArrowUpDown size={12} className="opacity-40" />
          )}
        </button>
      ) : (
        c.label
      ),
    ),
    ...(actions ? [""] : []),
  ];

  const rowEl = (r: T) => (
    <tr key={rowKey(r)} className="hover:bg-stone-50">
      {cols.map((c) => <Td key={c.key} className={c.className}>{c.cell(r)}</Td>)}
      {actions && <Td>{actions(r)}</Td>}
    </tr>
  );

  const options = [{ value: "none", label: "不分組" }, ...groups];

  return (
    <>
      {searchText && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <div className="relative min-w-48 max-w-md flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQ("")}
              placeholder={searchPlaceholder}
              className="pl-9"
              aria-label="關鍵字"
            />
          </div>
          {terms.length > 0 && (
            <span className="text-stone-500">
              符合 {shown.length} / {rows.length} 筆
              <button type="button" onClick={() => setQ("")} className="ml-2 text-xs text-emerald-700 underline">清除</button>
            </span>
          )}
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-stone-500">分組</span>
        <div className="flex flex-wrap gap-1 rounded-lg bg-stone-200/60 p-1">
          {options.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => setGroup(g.value)}
              className={`rounded-md px-3 py-1 ${
                activeGroup === g.value ? "bg-white font-medium text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-stone-400">點表格標題可排序，再點一次反向</span>
      </div>
      <Table head={head}>
        {def
          ? grouped.map((g) => (
              <Fragment key={g.key}>
                <tr className="bg-stone-100">
                  <td colSpan={width} className="px-4 py-2 text-sm font-semibold text-stone-700">
                    {g.label}
                    <span className="ml-2 text-xs font-normal text-stone-500">
                      {g.rows.length} 筆{summary && <>・{summary(g.rows)}</>}
                    </span>
                  </td>
                </tr>
                {g.rows.map(rowEl)}
              </Fragment>
            ))
          : sorted.map(rowEl)}
        {!shown.length && (
          <tr>
            <Td colSpan={width} className="py-8 text-center text-stone-400">
              {rows.length ? `沒有符合「${q.trim()}」的紀錄` : empty}
            </Td>
          </tr>
        )}
      </Table>
    </>
  );
}
