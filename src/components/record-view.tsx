"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { useCanEdit, useDB } from "@/lib/store";
import { fmtDT, materialCost, materialName, money } from "@/lib/utils";
import { useFertCost } from "./fert-modal";
import { targetsText } from "./record-parts";
import type { OpenRecord } from "./spray-calendar";
import { Button, Gallery, Modal, Thumb } from "./ui";

const KIND_LABEL = { spraying: "噴藥", fertilizing: "施肥" } as const;

/**
 * 噴藥／施肥紀錄的唯讀檢視：一次並排上次、這次、下次三筆，方便比較。
 * 「修改」編輯的是中間這次；上一筆／下一筆（或鍵盤 ← →）整組往前後移動。
 */
export function RecordView({
  list,
  index,
  go,
  onClose,
  onEdit,
}: {
  list: OpenRecord[];
  index: number;
  go: (index: number) => void;
  onClose: () => void;
  onEdit: () => void;
}) {
  const total = list.length;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && index > 0) go(index - 1);
      else if (e.key === "ArrowRight" && index < total - 1) go(index + 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [index, total, go]);

  const db = useDB();
  const canEdit = useCanEdit();
  const current = list[index];
  const orchard = db.orchards.find((o) => o.id === current.record.orchardId)?.nameZh;
  const slots = [
    { role: "上次", open: list[index - 1], empty: "沒有上一次紀錄" },
    { role: "這次", open: current, empty: "" },
    { role: "下次", open: list[index + 1], empty: "沒有下一次紀錄" },
  ];

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`${orchard ? `${orchard}・` : ""}${KIND_LABEL[current.kind]}紀錄`}
      footer={
        <>
          {total > 1 && (
            <div className="mr-auto flex items-center gap-1">
              <Button variant="secondary" disabled={index === 0} onClick={() => go(index - 1)} aria-label="上一筆">
                <ChevronLeft size={16} /> <span className="hidden sm:inline">上一筆</span>
              </Button>
              <span className="min-w-14 text-center text-sm tabular-nums text-stone-500">
                {index + 1} / {total}
              </span>
              <Button variant="secondary" disabled={index === total - 1} onClick={() => go(index + 1)} aria-label="下一筆">
                <span className="hidden sm:inline">下一筆</span> <ChevronRight size={16} />
              </Button>
            </div>
          )}
          <Button variant="secondary" onClick={onClose}>關閉</Button>
          {canEdit && <Button onClick={onEdit}><Pencil size={15} /> 修改這次</Button>}
        </>
      }
    >
      <div className="grid gap-3 md:grid-cols-3">
        {slots.map(({ role, open, empty }) => {
          const isCurrent = role === "這次";
          return (
            <section
              key={role}
              // 手機上一欄一欄往下排，「這次」排最前面
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
                {open && (
                  <button
                    type="button"
                    onClick={() => !isCurrent && go(list.indexOf(open))}
                    disabled={isCurrent}
                    className="text-sm font-semibold tabular-nums text-stone-800 enabled:cursor-pointer enabled:hover:text-emerald-700 enabled:hover:underline"
                    title={isCurrent ? undefined : "以這筆為中心查看"}
                  >
                    {fmtDT(open.record.datetime)}
                  </button>
                )}
              </div>
              {open ? <RecordCard open={open} /> : <p className="py-8 text-center text-sm text-stone-400">{empty}</p>}
            </section>
          );
        })}
      </div>
    </Modal>
  );
}

/** 一筆紀錄的精簡內容（唯讀） */
export function RecordCard({ open, showKind = true }: { open: OpenRecord; showKind?: boolean }) {
  const db = useDB();
  const fertCost = useFertCost();
  const r = open.record;
  const mat = (id: string) => db.materials.find((m) => m.id === id);
  const people = r.employeeIds.map((id) => db.employees.find((e) => e.id === id)?.name).filter(Boolean).join("、");

  const info: [string, React.ReactNode][] = [
    ...(showKind ? ([["類別", KIND_LABEL[open.kind]]] as [string, React.ReactNode][]) : []),
    ["對象", targetsText(r.targets, r.otherTarget) || "—"],
  ];
  let total: number;
  let items: { id: string; photos?: string[]; name: string; detail: string[] }[];

  if (open.kind === "spraying") {
    const s = open.record;
    info.push(["生長期", s.stage || "—"], ["用水量", `${s.waterLiters} L`]);
    total = s.items.reduce((sum, i) => sum + materialCost(mat(i.materialId), i.amount), 0);
    items = s.items.map((i) => {
      const m = mat(i.materialId);
      return {
        id: i.id,
        photos: m?.photos,
        name: m ? materialName(m) : "（已刪除）",
        detail: [Number(m?.dilution) > 0 ? `${m!.dilution} 倍` : "", `${i.amount} ${i.unit}`].filter(Boolean),
      };
    });
  } else {
    const f = open.record;
    total = fertCost(f).cost;
    items = f.items.map((i) => {
      const m = mat(i.materialId);
      return {
        id: i.id,
        photos: m?.photos,
        name: m ? materialName(m) : "（已刪除）",
        detail: [
          Number(m?.dilution) > 0 ? `${m!.dilution} 倍` : "",
          i.gramsPerTree > 0 ? `每棵 ${i.gramsPerTree} g` : "",
          i.litersPerTree > 0 ? `每棵 ${i.litersPerTree} L${i.seconds ? `（約 ${i.seconds} 秒）` : ""}` : "",
          `${i.packs} 包`,
        ].filter(Boolean),
      };
    });
  }
  info.push(["員工", people || "—"], ["費用", money(total)]);

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

      {items.length ? (
        <ul className="space-y-1.5">
          {items.map((it, n) => (
            <li key={it.id} className="flex items-center gap-2 rounded-lg bg-stone-100/70 p-1.5">
              <Thumb src={it.photos?.[0]} photos={it.photos} showCount className="h-10 w-10" />
              <div className="min-w-0">
                <div className="truncate font-medium text-stone-800">
                  {open.kind === "spraying" && `${n + 1}. `}{it.name}
                </div>
                <div className="text-xs text-stone-600">{it.detail.join("　·　")}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-stone-400">尚未加入藥品</p>
      )}

      {open.kind === "fertilizing" && open.record.photos.length > 0 && <Gallery photos={open.record.photos} size="h-14 w-14" />}

      {r.note && <p className="whitespace-pre-line text-xs text-stone-600"><b>備註：</b>{r.note}</p>}
    </div>
  );
}
