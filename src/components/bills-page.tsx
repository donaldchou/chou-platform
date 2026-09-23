"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { remove, upsert, useDB } from "@/lib/store";
import type { Bill, BillKind } from "@/lib/types";
import { money, thisMonth, todayStr, uid } from "@/lib/utils";
import {
  BarChart,
  Button,
  Card,
  Field,
  Input,
  Modal,
  NumInput,
  PageHeader,
  PhotoUpload,
  Select,
  StatCard,
  Table,
  Td,
  Thumb,
  confirmDelete,
} from "./ui";

const CYCLES = ["每月", "雙月", "每季", "每年"];
const META: Record<BillKind, { title: string; unit: string }> = {
  water: { title: "水費紀錄", unit: "水費" },
  electricity: { title: "電費紀錄", unit: "電費" },
};

export function BillsPage({ kind }: { kind: BillKind }) {
  const db = useDB();
  const meta = META[kind];
  const [orchardId, setOrchardId] = useState<string>("all");
  const [year, setYear] = useState(todayStr().slice(0, 4));
  const [editing, setEditing] = useState<Bill | null>(null);

  const all = db.bills.filter((b) => b.kind === kind && (orchardId === "all" || b.orchardId === orchardId));
  const years = [...new Set([year, ...all.map((b) => b.month.slice(0, 4))])].sort().reverse();
  const inYear = all.filter((b) => b.month.startsWith(year)).sort((a, b) => b.month.localeCompare(a.month));
  const yearTotal = inYear.reduce((s, b) => s + b.amount, 0);

  const monthly = Array.from({ length: 12 }, (_, i) => {
    const m = `${year}-${String(i + 1).padStart(2, "0")}`;
    return { label: `${i + 1}月`, value: inYear.filter((b) => b.month === m).reduce((s, b) => s + b.amount, 0) };
  });
  const history = [...years].reverse().map((y) => ({
    label: y,
    value: all.filter((b) => b.month.startsWith(y)).reduce((s, b) => s + b.amount, 0),
  }));
  // Compare with the same months of the previous year, so a partial year isn't compared to a full one.
  const prevYear = String(Number(year) - 1);
  const lastMonth = inYear.reduce((m, b) => (b.month > m ? b.month : m), "").slice(5);
  const lastYear = all
    .filter((b) => b.month.startsWith(prevYear) && b.month.slice(5) <= lastMonth)
    .reduce((s, b) => s + b.amount, 0);

  const orchard = db.orchards.find((o) => o.id === orchardId);
  const orchardName = (id: string) => db.orchards.find((o) => o.id === id)?.nameZh ?? "（已刪除）";

  function newBill(): Bill {
    return {
      id: uid(),
      orchardId: orchard?.id ?? db.orchards[0]?.id ?? "",
      kind,
      month: thisMonth(),
      amount: 0,
      cycle: kind === "water" ? "每月" : "雙月",
      photos: [],
      note: "",
    };
  }

  return (
    <>
      <PageHeader
        title={meta.title}
        desc={`登記每期${meta.unit}繳費單，並查看年度與歷年費用。`}
        action={
          <Button onClick={() => setEditing(newBill())} disabled={!db.orchards.length}>
            <Plus size={16} /> 登記繳費單
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-3">
        <Select value={orchardId} onChange={(e) => setOrchardId(e.target.value)} className="!w-auto">
          <option value="all">全部果園</option>
          {db.orchards.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nameZh}
            </option>
          ))}
        </Select>
        <Select value={year} onChange={(e) => setYear(e.target.value)} className="!w-auto">
          {years.map((y) => (
            <option key={y} value={y}>
              {y} 年
            </option>
          ))}
        </Select>
      </div>

      {orchard && (
        <Card title={kind === "water" ? `${orchard.nameZh}・水塔管線照片` : `${orchard.nameZh}・電號資料`} className="mb-6">
          {kind === "electricity" && (
            <Field label="電號" className="mb-3 max-w-xs">
              <Input
                value={orchard.electricityNo}
                onChange={(e) => upsert("orchards", { ...orchard, electricityNo: e.target.value })}
              />
            </Field>
          )}
          <Field label={kind === "water" ? "水塔管線照片" : "電號照片（電表／電費單）"} group>
            <PhotoUpload
              folder="orchards"
              value={kind === "water" ? orchard.waterPipePhotos : orchard.electricityPhotos}
              onChange={(v) =>
                upsert("orchards", kind === "water" ? { ...orchard, waterPipePhotos: v } : { ...orchard, electricityPhotos: v })
              }
            />
          </Field>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={`${year} 年度合計`} value={money(yearTotal)} />
        <StatCard label="繳費筆數" value={`${inYear.length} 筆`} />
        <StatCard label="月平均" value={money(yearTotal / Math.max(1, monthly.filter((m) => m.value).length))} />
        <StatCard
          label="與去年同期比較"
          value={lastYear ? `${yearTotal >= lastYear ? "+" : ""}${(((yearTotal - lastYear) / lastYear) * 100).toFixed(1)}%` : "—"}
          sub={lastYear ? `${prevYear} 年 1～${Number(lastMonth)} 月：${money(lastYear)}` : "無去年同期資料"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card title={`${year} 年度費用（每月）`} className="lg:col-span-2">
          <BarChart data={monthly} format={money} />
        </Card>
        <Card title="歷史年度費用">
          <BarChart data={history} format={money} />
        </Card>
      </div>

      <h2 className="mb-3 mt-8 font-semibold text-stone-800">繳費登記（{year}）</h2>
      <Table head={["繳費月份", "果園", "費用", "週期", "照片", "備註", ""]}>
        {inYear.map((b) => (
          <tr key={b.id} className="hover:bg-stone-50">
            <Td>{b.month}</Td>
            <Td>{orchardName(b.orchardId)}</Td>
            <Td className="font-medium">{money(b.amount)}</Td>
            <Td>{b.cycle}</Td>
            <Td>{b.photos[0] ? <Thumb src={b.photos[0]} /> : <span className="text-stone-400">—</span>}</Td>
            <Td className="text-stone-500">{b.note}</Td>
            <Td className="whitespace-nowrap text-right">
              <Button size="sm" variant="ghost" onClick={() => setEditing(b)}>
                <Pencil size={14} />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600"
                onClick={() => confirmDelete() && remove("bills", b.id)}
              >
                <Trash2 size={14} />
              </Button>
            </Td>
          </tr>
        ))}
        {!inYear.length && (
          <tr>
            <Td colSpan={7} className="py-8 text-center text-stone-400">這一年還沒有繳費紀錄</Td>
          </tr>
        )}
      </Table>

      {editing && (
        <BillModal
          bill={editing}
          onClose={() => setEditing(null)}
          title={`${meta.unit}繳費單`}
        />
      )}
    </>
  );
}

function BillModal({ bill, onClose, title }: { bill: Bill; onClose: () => void; title: string }) {
  const db = useDB();
  const [b, setB] = useState(bill);
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button
            onClick={() => {
              upsert("bills", b);
              onClose();
            }}
          >
            儲存
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="果園" className="sm:col-span-2">
          <Select value={b.orchardId} onChange={(e) => setB({ ...b, orchardId: e.target.value })}>
            {db.orchards.map((o) => (
              <option key={o.id} value={o.id}>{o.nameZh}</option>
            ))}
          </Select>
        </Field>
        <Field label="繳費月份">
          <Input type="month" value={b.month} onChange={(e) => setB({ ...b, month: e.target.value })} />
        </Field>
        <Field label="費用（元）">
          <NumInput value={b.amount} onChange={(v) => setB({ ...b, amount: v })} />
        </Field>
        <Field label="週期">
          <Select value={b.cycle} onChange={(e) => setB({ ...b, cycle: e.target.value })}>
            {CYCLES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="備註">
          <Input value={b.note} onChange={(e) => setB({ ...b, note: e.target.value })} />
        </Field>
        <Field label="繳費單照片" group className="sm:col-span-2">
          <PhotoUpload folder="bills" value={b.photos} onChange={(v) => setB({ ...b, photos: v })} />
        </Field>
      </div>
    </Modal>
  );
}
