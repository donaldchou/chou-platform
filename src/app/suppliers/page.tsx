"use client";

import { useState } from "react";
import { MapPin, Phone, Plus, Store } from "lucide-react";
import { remove, upsert, useDB } from "@/lib/store";
import type { Supplier } from "@/lib/types";
import { uid } from "@/lib/utils";
import {
  Button,
  Card,
  Empty,
  Field,
  Input,
  Modal,
  PageHeader,
  PhotoUpload,
  RowActions,
  Textarea,
  Thumb,
} from "@/components/ui";

export default function SuppliersPage() {
  const db = useDB();
  const [editing, setEditing] = useState<Supplier | null>(null);

  return (
    <>
      <PageHeader
        title="貨源店家管理"
        desc="登錄購買農藥、肥料與資材的店家，資材資料可直接選擇購買地。"
        action={
          <Button onClick={() => setEditing({ id: uid(), name: "", phone: "", address: "", cardPhoto: "", note: "" })}>
            <Plus size={16} /> 新增店家
          </Button>
        }
      />
      {db.suppliers.length === 0 && <Empty>尚未登錄店家</Empty>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {db.suppliers.map((s) => {
          const count = db.materials.filter((m) => m.supplierId === s.id).length;
          return (
            <Card key={s.id}>
              <div className="flex gap-4">
                {s.cardPhoto ? (
                  <Thumb src={s.cardPhoto} className="h-20 w-32 shrink-0" />
                ) : (
                  <div className="flex h-20 w-32 shrink-0 flex-col items-center justify-center rounded-md bg-stone-100 text-xs text-stone-400">
                    <Store size={22} />無名片
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between">
                    <div className="font-semibold text-stone-900">{s.name}</div>
                    <RowActions onEdit={() => setEditing(s)} onDelete={() => remove("suppliers", s.id)} />
                  </div>
                  <a href={`tel:${s.phone}`} className="flex items-center gap-1 text-sm text-emerald-700">
                    <Phone size={13} /> {s.phone || "—"}
                  </a>
                  <a
                    href={`https://www.google.com/maps/search/${encodeURIComponent(s.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-1 text-sm text-stone-600 hover:underline"
                  >
                    <MapPin size={13} className="mt-0.5 shrink-0" /> {s.address || "—"}
                  </a>
                </div>
              </div>
              <div className="mt-3 flex justify-between border-t border-stone-100 pt-3 text-xs text-stone-500">
                <span>{s.note}</span>
                <span>供應 {count} 項資材</span>
              </div>
            </Card>
          );
        })}
      </div>
      {editing && <SupplierModal supplier={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function SupplierModal({ supplier, onClose }: { supplier: Supplier; onClose: () => void }) {
  const [s, setS] = useState(supplier);
  return (
    <Modal
      open
      onClose={onClose}
      title="貨源店家"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button
            onClick={() => {
              if (!s.name.trim()) return alert("請填寫店家名稱");
              upsert("suppliers", s);
              onClose();
            }}
          >
            儲存
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="店家名稱*">
          <Input value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
        </Field>
        <Field label="電話">
          <Input type="tel" value={s.phone} onChange={(e) => setS({ ...s, phone: e.target.value })} />
        </Field>
        <Field label="地址" className="sm:col-span-2">
          <Input value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} />
        </Field>
        <Field label="名片" group>
          <PhotoUpload max={1} value={s.cardPhoto ? [s.cardPhoto] : []} onChange={(v) => setS({ ...s, cardPhoto: v[0] ?? "" })} />
        </Field>
        <Field label="備註">
          <Textarea value={s.note} onChange={(e) => setS({ ...s, note: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
