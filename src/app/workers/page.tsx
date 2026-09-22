"use client";

import { useState } from "react";
import { MessageCircle, Phone, Plus, UserRound } from "lucide-react";
import { remove, upsert, useDB } from "@/lib/store";
import type { Worker } from "@/lib/types";
import { money, todayStr, uid } from "@/lib/utils";
import {
  Button,
  Card,
  Empty,
  Field,
  Input,
  Modal,
  NumInput,
  PageHeader,
  PhotoUpload,
  RowActions,
  Thumb,
} from "@/components/ui";

export default function WorkersPage() {
  const db = useDB();
  const [editing, setEditing] = useState<Worker | null>(null);

  const jobs = (w: Worker) =>
    db.bagging.filter((r) => r.workerIds.includes(w.id)).length +
    db.labor.filter((r) => r.workers.some((x) => x.workerId === w.id)).length;

  return (
    <>
      <PageHeader
        title="外請工人管理"
        desc="建立外請工人資料，套袋、剪枝、砍草紀錄可直接選用。"
        action={
          <Button
            onClick={() =>
              setEditing({ id: uid(), nameZh: "", nameEn: "", phone: "", lineName: "", photo: "", createdAt: todayStr(), dailyRate: 1800 })
            }
          >
            <Plus size={16} /> 新增工人
          </Button>
        }
      />
      {db.workers.length === 0 && <Empty>尚未建立外請工人</Empty>}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {db.workers.map((w) => (
          <Card key={w.id}>
            <div className="flex items-start justify-between">
              {w.photo ? (
                <Thumb src={w.photo} className="h-14 w-14 rounded-full" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <UserRound size={26} />
                </div>
              )}
              <RowActions onEdit={() => setEditing(w)} onDelete={() => remove("workers", w.id)} />
            </div>
            <div className="mt-3 font-semibold text-stone-900">{w.nameZh}</div>
            <div className="text-sm text-stone-500">{w.nameEn || "—"}</div>
            <div className="mt-2 space-y-1 text-sm">
              <a href={`tel:${w.phone}`} className="flex items-center gap-1.5 text-emerald-700"><Phone size={13} /> {w.phone || "—"}</a>
              <div className="flex items-center gap-1.5 text-stone-600"><MessageCircle size={13} /> LINE：{w.lineName || "—"}</div>
            </div>
            <div className="mt-3 flex justify-between border-t border-stone-100 pt-2 text-xs text-stone-500">
              <span>日薪 {money(w.dailyRate)}</span>
              <span>參與 {jobs(w)} 次作業</span>
            </div>
            <div className="mt-1 text-xs text-stone-400">登入時間 {w.createdAt}</div>
          </Card>
        ))}
      </div>
      {editing && <WorkerModal worker={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function WorkerModal({ worker, onClose }: { worker: Worker; onClose: () => void }) {
  const [w, setW] = useState(worker);
  return (
    <Modal
      open
      onClose={onClose}
      title="外請工人"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button
            onClick={() => {
              if (!w.nameZh.trim()) return alert("請填寫中文姓名");
              upsert("workers", w);
              onClose();
            }}
          >
            儲存
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="姓名（中文）*">
          <Input value={w.nameZh} onChange={(e) => setW({ ...w, nameZh: e.target.value })} />
        </Field>
        <Field label="姓名（英文）">
          <Input value={w.nameEn} onChange={(e) => setW({ ...w, nameEn: e.target.value })} />
        </Field>
        <Field label="電話">
          <Input type="tel" value={w.phone} onChange={(e) => setW({ ...w, phone: e.target.value })} />
        </Field>
        <Field label="LINE 名稱">
          <Input value={w.lineName} onChange={(e) => setW({ ...w, lineName: e.target.value })} />
        </Field>
        <Field label="預設日薪（元）">
          <NumInput value={w.dailyRate} onChange={(v) => setW({ ...w, dailyRate: v })} />
        </Field>
        <Field label="登入時間">
          <Input value={w.createdAt} disabled />
        </Field>
        <Field label="照片" group>
          <PhotoUpload max={1} value={w.photo ? [w.photo] : []} onChange={(v) => setW({ ...w, photo: v[0] ?? "" })} />
        </Field>
      </div>
    </Modal>
  );
}
