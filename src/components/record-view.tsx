"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { useDB } from "@/lib/store";
import { fmtDT, materialCost, materialName, money } from "@/lib/utils";
import { useFertCost } from "./fert-modal";
import { targetsText } from "./record-parts";
import type { OpenRecord } from "./spray-calendar";
import { Button, Gallery, Modal, Thumb } from "./ui";

type Nav = { index: number; total: number; go: (index: number) => void };

/** 噴藥／施肥紀錄的唯讀檢視；按「修改」才開啟編輯表單。有 nav 時可切換上一筆／下一筆（也可用鍵盤 ← →） */
export function RecordView({
  open,
  nav,
  onClose,
  onEdit,
}: {
  open: OpenRecord;
  nav?: Nav;
  onClose: () => void;
  onEdit: () => void;
}) {
  useEffect(() => {
    if (!nav || nav.total < 2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && nav.index > 0) nav.go(nav.index - 1);
      else if (e.key === "ArrowRight" && nav.index < nav.total - 1) nav.go(nav.index + 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [nav]);

  const db = useDB();
  const fertCost = useFertCost();
  const r = open.record;
  const mat = (id: string) => db.materials.find((m) => m.id === id);
  const people = r.employeeIds.map((id) => db.employees.find((e) => e.id === id)?.name).filter(Boolean).join("、");

  const info: [string, React.ReactNode][] = [
    ["施用日期時間", fmtDT(r.datetime)],
    ["果園", db.orchards.find((o) => o.id === r.orchardId)?.nameZh ?? "—"],
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
        detail: [Number(m?.dilution) > 0 ? `${m!.dilution} 倍` : "", `用量 ${i.amount} ${i.unit}`].filter(Boolean),
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
    <Modal
      open
      onClose={onClose}
      title={open.kind === "spraying" ? "噴藥紀錄" : "施肥紀錄"}
      footer={
        <>
          {nav && nav.total > 1 && (
            <div className="mr-auto flex items-center gap-1">
              <Button variant="secondary" disabled={nav.index === 0} onClick={() => nav.go(nav.index - 1)} aria-label="上一筆">
                <ChevronLeft size={16} /> <span className="hidden sm:inline">上一筆</span>
              </Button>
              <span className="min-w-14 text-center text-sm tabular-nums text-stone-500">
                {nav.index + 1} / {nav.total}
              </span>
              <Button
                variant="secondary"
                disabled={nav.index === nav.total - 1}
                onClick={() => nav.go(nav.index + 1)}
                aria-label="下一筆"
              >
                <span className="hidden sm:inline">下一筆</span> <ChevronRight size={16} />
              </Button>
            </div>
          )}
          <Button variant="secondary" onClick={onClose}>關閉</Button>
          <Button onClick={onEdit}><Pencil size={15} /> 修改</Button>
        </>
      }
    >
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
        {info.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-stone-500">{label}</dt>
            <dd className="mt-0.5 font-medium text-stone-800">{value}</dd>
          </div>
        ))}
      </dl>

      <h3 className="mb-2 mt-5 text-sm font-semibold text-stone-700">
        {open.kind === "spraying" ? "農藥／肥料（依加入順序）" : "肥料"}
      </h3>
      {items.length ? (
        <ul className="space-y-2">
          {items.map((it, n) => (
            <li key={it.id} className="flex items-center gap-3 rounded-lg bg-stone-50 p-2">
              <Thumb src={it.photos?.[0]} photos={it.photos} showCount className="h-14 w-14" />
              <div className="min-w-0 text-sm">
                <div className="font-medium text-stone-800">
                  {open.kind === "spraying" && `${n + 1}. `}{it.name}
                </div>
                <div className="text-xs text-stone-600">{it.detail.join("　·　")}</div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-stone-400">尚未加入藥品</p>
      )}

      {open.kind === "fertilizing" && open.record.photos.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-sm font-semibold text-stone-700">參考照片</h3>
          <Gallery photos={open.record.photos} />
        </>
      )}

      {r.note && (
        <>
          <h3 className="mb-1 mt-5 text-sm font-semibold text-stone-700">備註</h3>
          <p className="whitespace-pre-line text-sm text-stone-700">{r.note}</p>
        </>
      )}

      {open.kind === "spraying" && open.record.aiSuggestion && (
        <>
          <h3 className="mb-1 mt-5 text-sm font-semibold text-stone-700">AI 建議</h3>
          <p className="whitespace-pre-line rounded-lg bg-violet-50 p-3 text-sm text-stone-700">{open.record.aiSuggestion}</p>
        </>
      )}
    </Modal>
  );
}
