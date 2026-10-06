"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { remove, upsert, useDB } from "@/lib/store";
import type { Bill, BillKind } from "@/lib/types";
import { defaultOrchard, money, thisMonth, todayStr, uid } from "@/lib/utils";
import {
  BarChart,
  Button,
  Card,
  EditOnly,
  Field,
  Gallery,
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
  const meterNo = (b: Bill) => {
    if (!b.meterId) return <span className="text-stone-400">—</span>;
    const m = db.orchards.find((o) => o.id === b.orchardId)?.meters.find((x) => x.id === b.meterId);
    return m ? m.no || "（未填號碼）" : <span className="text-stone-400">已移除的電錶</span>;
  };

  function newBill(): Bill {
    const o = orchard ?? defaultOrchard(db.orchards);
    return {
      id: uid(),
      orchardId: o?.id ?? "",
      kind,
      month: thisMonth(),
      amount: 0,
      cycle: kind === "water" ? "每月" : "雙月",
      meterId: kind === "electricity" ? (o?.meters[0]?.id ?? "") : "",
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

      {orchard && kind === "water" && (
        <Card title={`${orchard.nameZh}・水塔管線照片`} className="mb-6">
          <Field label="水塔管線照片" group>
            <PhotoUpload
              folder="orchards"
              value={orchard.waterPipePhotos}
              onChange={(v) => upsert("orchards", { ...orchard, waterPipePhotos: v })}
            />
          </Field>
        </Card>
      )}
      {orchard && kind === "electricity" && (
        <Card
          title={`${orchard.nameZh}・電錶`}
          className="mb-6"
          action={
            <EditOnly>
              <Link href={`/orchards/${orchard.id}/edit`} className="text-sm text-emerald-700 hover:underline">
                到果園資料編輯電錶
              </Link>
            </EditOnly>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {orchard.meters.map((m, i) => (
              <div key={m.id} className="rounded-lg bg-stone-50 p-3">
                <div className="text-xs text-stone-500">電錶號碼 {i + 1}</div>
                <div className="mb-2 font-semibold text-stone-800">{m.no || "（未填）"}</div>
                {m.photos.length ? <Gallery photos={m.photos} /> : <div className="text-sm text-stone-400">沒有照片</div>}
              </div>
            ))}
          </div>
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
      <Table head={["繳費月份", "果園", ...(kind === "electricity" ? ["電錶號碼"] : []), "費用", "週期", "照片", "備註", ""]}>
        {inYear.map((b) => (
          <tr key={b.id} className="hover:bg-stone-50">
            <Td>{b.month}</Td>
            <Td>{orchardName(b.orchardId)}</Td>
            {kind === "electricity" && <Td>{meterNo(b)}</Td>}
            <Td className="font-medium">{money(b.amount)}</Td>
            <Td>{b.cycle}</Td>
            <Td>{b.photos[0] ? <Thumb src={b.photos[0]} photos={b.photos} showCount /> : <span className="text-stone-400">—</span>}</Td>
            <Td className="text-stone-500">{b.note}</Td>
            <Td className="whitespace-nowrap text-right">
              <EditOnly>
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
              </EditOnly>
            </Td>
          </tr>
        ))}
        {!inYear.length && (
          <tr>
            <Td colSpan={kind === "electricity" ? 8 : 7} className="py-8 text-center text-stone-400">這一年還沒有繳費紀錄</Td>
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
  const meters = db.orchards.find((o) => o.id === b.orchardId)?.meters ?? [];
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
          <Select
            value={b.orchardId}
            onChange={(e) => {
              const orchardId = e.target.value;
              // 換果園時，電錶改成新果園的第一個
              const first = db.orchards.find((o) => o.id === orchardId)?.meters[0]?.id ?? "";
              setB({ ...b, orchardId, meterId: b.kind === "electricity" ? first : "" });
            }}
          >
            {db.orchards.map((o) => (
              <option key={o.id} value={o.id}>{o.nameZh}</option>
            ))}
          </Select>
        </Field>
        {b.kind === "electricity" && (
          <Field label="電錶號碼" className="sm:col-span-2">
            <Select value={b.meterId} onChange={(e) => setB({ ...b, meterId: e.target.value })}>
              {!meters.some((m) => m.id === b.meterId) && <option value={b.meterId}>{b.meterId ? "已移除的電錶" : "（未選擇）"}</option>}
              {meters.map((m, i) => (
                <option key={m.id} value={m.id}>{m.no || `電錶 ${i + 1}（未填號碼）`}</option>
              ))}
            </Select>
          </Field>
        )}
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
