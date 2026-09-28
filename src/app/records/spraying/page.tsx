"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { RecordCalendar, RecordsToolbar, useRecordsFilter } from "@/components/record-calendar";
import { targetsText } from "@/components/record-parts";
import { SprayModal } from "@/components/spray-modal";
import { Button, PageHeader, RowActions, Table, Td } from "@/components/ui";
import { STAGES } from "@/lib/spray-advice";
import { remove, useDB } from "@/lib/store";
import type { SprayingRecord } from "@/lib/types";
import { fmtDT, materialCost, money, nowStr, uid } from "@/lib/utils";

export default function SprayingPage() {
  const db = useDB();
  const [editing, setEditing] = useState<SprayingRecord | null>(null);
  const filter = useRecordsFilter();
  const { year, view } = filter;
  const list = db.spraying.filter(filter.inYear).sort((a, b) => b.datetime.localeCompare(a.datetime));
  const mat = (id: string) => db.materials.find((m) => m.id === id);
  const cost = (r: SprayingRecord) => r.items.reduce((s, i) => s + materialCost(mat(i.materialId), i.amount), 0);

  const create = (): SprayingRecord => ({
    id: uid(), orchardId: db.orchards[0]?.id ?? "", datetime: nowStr(), waterLiters: 500, items: [], targets: [],
    otherTarget: "", stage: STAGES[3], aiSuggestion: "", employeeIds: [], note: "",
  });

  return (
    <>
      <PageHeader
        title="噴藥紀錄"
        desc="記錄噴藥配方、加入順序、使用量與費用，並可取得 AI 用藥建議。"
        action={<Button onClick={() => setEditing(create())}><Plus size={16} /> 新增噴藥紀錄</Button>}
      />
      <RecordsToolbar {...filter} count={`共 ${list.length} 筆噴藥紀錄`} />
      {view !== "list" ? (
        <RecordCalendar year={year} layout={view} />
      ) : (
        <Table head={["施用日期時間", "果園", "用水量", "配方（加入順序）", "對象", "費用", "員工", ""]}>
          {list.map((r) => (
            <tr key={r.id} className="hover:bg-stone-50">
              <Td className="whitespace-nowrap">{fmtDT(r.datetime)}</Td>
              <Td className="font-medium">{db.orchards.find((o) => o.id === r.orchardId)?.nameZh ?? "—"}</Td>
              <Td>{r.waterLiters} L</Td>
              <Td>
                <ol className="space-y-0.5">
                  {r.items.map((i, n) => (
                    <li key={i.id} className="text-xs">
                      {n + 1}. {mat(i.materialId)?.nameZh ?? "（已刪除）"} {i.amount}{i.unit}
                    </li>
                  ))}
                </ol>
              </Td>
              <Td>{targetsText(r.targets, r.otherTarget)}</Td>
              <Td className="font-semibold">{money(cost(r))}</Td>
              <Td>{r.employeeIds.map((id) => db.employees.find((e) => e.id === id)?.name).filter(Boolean).join("、") || "—"}</Td>
              <Td><RowActions onEdit={() => setEditing(r)} onDelete={() => remove("spraying", r.id)} /></Td>
            </tr>
          ))}
          {!list.length && <tr><Td colSpan={8} className="py-8 text-center text-stone-400">{year} 年尚無噴藥紀錄</Td></tr>}
        </Table>
      )}
      {editing && <SprayModal record={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
