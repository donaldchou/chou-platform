"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { upsert } from "@/lib/store";
import { FRUITS, LAND_TYPES, type LandType, type Orchard, type Seedlings } from "@/lib/types";
import { daysUntil, uid } from "@/lib/utils";
import { Button, Card, Field, Input, NumInput, PhotoUpload, Select } from "./ui";

const SEEDLINGS: (keyof Seedlings)[] = ["苦桃苗", "甜柿苗", "李子苗"];

export function OrchardForm({ initial, isNew }: { initial: Orchard; isNew: boolean }) {
  const router = useRouter();
  const [o, setO] = useState<Orchard>(initial);
  const set = <K extends keyof Orchard>(k: K, v: Orchard[K]) => setO((p) => ({ ...p, [k]: v }));

  function save() {
    if (!o.nameZh.trim()) {
      alert("請填寫果園中文名稱");
      return;
    }
    upsert("orchards", o);
    router.push(`/orchards/${o.id}`);
  }

  const contractDays = daysUntil(o.contract.end);

  return (
    <div className="space-y-6">
      <Card title="基本資料">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="果園名稱（中文）*">
            <Input value={o.nameZh} onChange={(e) => set("nameZh", e.target.value)} placeholder="例：梨山一號園" />
          </Field>
          <Field label="果園名稱（英文）">
            <Input value={o.nameEn} onChange={(e) => set("nameEn", e.target.value)} placeholder="e.g. Lishan No.1" />
          </Field>
          <Field label="果園照片" group className="sm:col-span-2">
            <PhotoUpload value={o.photos} onChange={(v) => set("photos", v)} />
          </Field>
        </div>
      </Card>

      <Card
        title="位置資訊（地號）"
        action={
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              set("parcels", [...o.parcels, { id: uid(), landNo: "", lat: "", lng: "", landType: "農牧", areaFen: 0 }])
            }
          >
            <Plus size={14} /> 新增地號
          </Button>
        }
      >
        <div className="space-y-3">
          {o.parcels.map((p, i) => {
            const upd = (patch: Partial<typeof p>) =>
              set("parcels", o.parcels.map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
            return (
              <div key={p.id} className="grid gap-3 rounded-lg bg-stone-50 p-3 sm:grid-cols-12">
                <Field label={`地號 ${i + 1}`} className="sm:col-span-3">
                  <Input value={p.landNo} onChange={(e) => upd({ landNo: e.target.value })} placeholder="○○段 123 地號" />
                </Field>
                <Field label="緯度" className="sm:col-span-2">
                  <Input value={p.lat} onChange={(e) => upd({ lat: e.target.value })} placeholder="24.2536" />
                </Field>
                <Field label="經度" className="sm:col-span-2">
                  <Input value={p.lng} onChange={(e) => upd({ lng: e.target.value })} placeholder="121.2485" />
                </Field>
                <Field label="地目" className="sm:col-span-2">
                  <Select value={p.landType} onChange={(e) => upd({ landType: e.target.value as LandType })}>
                    {LAND_TYPES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="面積（分）" className="sm:col-span-2">
                  <NumInput step="0.1" value={p.areaFen} onChange={(v) => upd({ areaFen: v })} />
                </Field>
                <div className="flex items-end gap-1 sm:col-span-1">
                  {p.lat && p.lng && (
                    <a
                      href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg p-2 text-emerald-700 hover:bg-emerald-50"
                      title="在 Google 地圖開啟"
                    >
                      <MapPin size={18} />
                    </a>
                  )}
                  {o.parcels.length > 1 && (
                    <button
                      onClick={() => set("parcels", o.parcels.filter((x) => x.id !== p.id))}
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50"
                      title="刪除地號"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="取得資訊">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="取得成本（元）">
              <NumInput value={o.acquisition.cost} onChange={(v) => set("acquisition", { ...o.acquisition, cost: v })} />
            </Field>
            <Field label="取得時間">
              <Input type="date" value={o.acquisition.date} onChange={(e) => set("acquisition", { ...o.acquisition, date: e.target.value })} />
            </Field>
            <Field label="對象姓名">
              <Input value={o.acquisition.name} onChange={(e) => set("acquisition", { ...o.acquisition, name: e.target.value })} />
            </Field>
            <Field label="對象電話">
              <Input type="tel" value={o.acquisition.phone} onChange={(e) => set("acquisition", { ...o.acquisition, phone: e.target.value })} />
            </Field>
          </div>
        </Card>

        <Card title="合約">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="合約開始日">
              <Input type="date" value={o.contract.start} onChange={(e) => set("contract", { ...o.contract, start: e.target.value })} />
            </Field>
            <Field
              label="合約結束日"
              hint={
                o.contract.end &&
                (contractDays < 0 ? (
                  <span className="text-red-600">合約已到期</span>
                ) : contractDays <= 90 ? (
                  <span className="text-amber-700">剩 {contractDays} 天，已進入 3 個月到期提醒</span>
                ) : (
                  "到期前 3 個月會在儀表板提醒"
                ))
              }
            >
              <Input type="date" value={o.contract.end} onChange={(e) => set("contract", { ...o.contract, end: e.target.value })} />
            </Field>
            <Field label="合約照片" group className="sm:col-span-2">
              <PhotoUpload value={o.contract.photos} onChange={(v) => set("contract", { ...o.contract, photos: v })} />
            </Field>
          </div>
        </Card>
      </div>

      <Card title="種植果樹數量">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {FRUITS.map((f) => (
            <Field key={f} label={`${f}（棵）`}>
              <NumInput value={o.trees[f]} onChange={(v) => set("trees", { ...o.trees, [f]: v })} />
            </Field>
          ))}
          <Field label="其它果樹名稱">
            <Input value={o.trees.otherName} onChange={(e) => set("trees", { ...o.trees, otherName: e.target.value })} placeholder="例：蘋果" />
          </Field>
          <Field label="其它果樹（棵）">
            <NumInput value={o.trees.other} onChange={(v) => set("trees", { ...o.trees, other: v })} />
          </Field>
        </div>
      </Card>

      <Card title="設備">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3">
            <div className="text-sm font-semibold text-stone-600">水塔</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="大小（噸）">
                <NumInput value={o.waterTank.sizeTon} onChange={(v) => set("waterTank", { ...o.waterTank, sizeTon: v })} />
              </Field>
              <Field label="數量">
                <NumInput value={o.waterTank.count} onChange={(v) => set("waterTank", { ...o.waterTank, count: v })} />
              </Field>
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-sm font-semibold text-stone-600">加壓馬達</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="規格">
                <Input value={o.pump.spec} onChange={(e) => set("pump", { ...o.pump, spec: e.target.value })} placeholder="2HP" />
              </Field>
              <Field label="價格（元）">
                <NumInput value={o.pump.price} onChange={(v) => set("pump", { ...o.pump, price: v })} />
              </Field>
            </div>
          </div>
          <div className="space-y-3">
            <div className="text-sm font-semibold text-stone-600">噴藥管線</div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="管徑（分）">
                <NumInput value={o.sprayPipe.diameterFen} onChange={(v) => set("sprayPipe", { ...o.sprayPipe, diameterFen: v })} />
              </Field>
              <Field label="每捲價格">
                <NumInput value={o.sprayPipe.pricePerRoll} onChange={(v) => set("sprayPipe", { ...o.sprayPipe, pricePerRoll: v })} />
              </Field>
              <Field label="接頭（個）">
                <NumInput value={o.sprayPipe.fittings} onChange={(v) => set("sprayPipe", { ...o.sprayPipe, fittings: v })} />
              </Field>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-stone-50 p-4">
          <div className="mb-3 flex items-center gap-4">
            <span className="text-sm font-semibold text-stone-600">電網</span>
            {[true, false].map((v) => (
              <label key={String(v)} className="flex items-center gap-1.5 text-sm">
                <input
                  type="radio"
                  checked={o.fence.has === v}
                  onChange={() => set("fence", { ...o.fence, has: v })}
                  className="accent-emerald-600"
                />
                {v ? "有" : "無"}
              </label>
            ))}
          </div>
          {o.fence.has && (
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="電壓（伏特 V）">
                <NumInput value={o.fence.voltage} onChange={(v) => set("fence", { ...o.fence, voltage: v })} />
              </Field>
              <Field label="使用材料規格">
                <Input value={o.fence.materialSpec} onChange={(e) => set("fence", { ...o.fence, materialSpec: e.target.value })} />
              </Field>
              <Field label="材料價格（元）">
                <NumInput value={o.fence.materialPrice} onChange={(v) => set("fence", { ...o.fence, materialPrice: v })} />
              </Field>
              <Field label="總施工材料費用（元）">
                <NumInput value={o.fence.totalCost} onChange={(v) => set("fence", { ...o.fence, totalCost: v })} />
              </Field>
            </div>
          )}
        </div>
      </Card>

      <Card title="待完成事項">
        <div className="grid gap-6 sm:grid-cols-2">
          {(["graft", "replant"] as const).map((k) => (
            <div key={k}>
              <div className="mb-3 text-sm font-semibold text-stone-600">{k === "graft" ? "待嫁接" : "待重新種植"}</div>
              <div className="grid grid-cols-3 gap-3">
                {SEEDLINGS.map((s) => (
                  <Field key={s} label={`${s}（棵）`}>
                    <NumInput
                      value={o.todo[k][s]}
                      onChange={(v) => set("todo", { ...o.todo, [k]: { ...o.todo[k], [s]: v } })}
                    />
                  </Field>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-stone-200 bg-stone-100/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <Button variant="secondary" onClick={() => router.back()}>
          取消
        </Button>
        <Button onClick={save}>{isNew ? "建立果園" : "儲存變更"}</Button>
      </div>
    </div>
  );
}
