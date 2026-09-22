"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { remove, upsert, useDB } from "@/lib/store";
import { FRUITS, type HarvestRecord } from "@/lib/types";
import { daySpan, todayStr, uid } from "@/lib/utils";
import { OrchardSelect } from "@/components/record-parts";
import {
  Badge,
  Button,
  Field,
  Input,
  Modal,
  PageHeader,
  RowActions,
  Table,
  Td,
  Textarea,
} from "@/components/ui";

export default function HarvestPage() {
  const db = useDB();
  const [editing, setEditing] = useState<HarvestRecord | null>(null);
  const list = [...db.harvests].sort((a, b) => b.start.localeCompare(a.start));
  const orchard = (id: string) => db.orchards.find((o) => o.id === id);

  return (
    <>
      <PageHeader
        title="採收紀錄"
        desc="記錄每個果園的開始與結束採收時間。"
        action={
          <Button
            onClick={() =>
              setEditing({ id: uid(), orchardId: db.orchards[0]?.id ?? "", fruit: FRUITS[0], start: todayStr(), end: "", note: "" })
            }
          >
            <Plus size={16} /> 新增採收紀錄
          </Button>
        }
      />
      <Table head={["果園", "果樹", "開始採收", "結束採收", "採收天數", "備註", ""]}>
        {list.map((r) => (
          <tr key={r.id} className="hover:bg-stone-50">
            <Td className="font-medium">{orchard(r.orchardId)?.nameZh ?? "（已刪除）"}</Td>
            <Td><Badge tone="green">{r.fruit}</Badge></Td>
            <Td>{r.start}</Td>
            <Td>{r.end || <Badge tone="amber">採收中</Badge>}</Td>
            <Td>{r.end ? `${daySpan(r.start, r.end)} 天` : "—"}</Td>
            <Td className="text-stone-500">{r.note}</Td>
            <Td><RowActions onEdit={() => setEditing(r)} onDelete={() => remove("harvests", r.id)} /></Td>
          </tr>
        ))}
        {!list.length && <tr><Td colSpan={7} className="py-8 text-center text-stone-400">尚無採收紀錄</Td></tr>}
      </Table>
      {editing && <HarvestModal record={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function HarvestModal({ record, onClose }: { record: HarvestRecord; onClose: () => void }) {
  const [r, setR] = useState(record);
  return (
    <Modal
      open
      onClose={onClose}
      title="採收紀錄"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={() => { upsert("harvests", r); onClose(); }}>儲存</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <OrchardSelect value={r.orchardId} onChange={(v) => setR({ ...r, orchardId: v })} />
        <Field label="果樹">
          <Input list="fruit-list" value={r.fruit} onChange={(e) => setR({ ...r, fruit: e.target.value })} />
          <datalist id="fruit-list">{FRUITS.map((f) => <option key={f} value={f} />)}</datalist>
        </Field>
        <Field label="開始採收時間">
          <Input type="date" value={r.start} onChange={(e) => setR({ ...r, start: e.target.value })} />
        </Field>
        <Field label="結束採收時間">
          <Input type="date" value={r.end} onChange={(e) => setR({ ...r, end: e.target.value })} />
        </Field>
        <Field label="備註" className="sm:col-span-2">
          <Textarea value={r.note} onChange={(e) => setR({ ...r, note: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
