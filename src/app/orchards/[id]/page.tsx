"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Pencil, Trash2 } from "lucide-react";
import { remove, useDB, useDBStatus } from "@/lib/store";
import { FRUITS } from "@/lib/types";
import {
  Badge,
  Button,
  Card,
  Empty,
  PageHeader,
  Gallery,
  StatCard,
  confirmDelete,
} from "@/components/ui";
import { contractStatus, money, orchardArea, orchardTrees, todayStr } from "@/lib/utils";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-stone-500">{label}</span>
      <span className="text-right font-medium text-stone-800">{children || "—"}</span>
    </div>
  );
}

export default function OrchardDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const db = useDB();
  const { ready } = useDBStatus();
  const o = db.orchards.find((x) => x.id === id);

  if (!ready) return null;
  if (!o) return <Empty>找不到這個果園。<Link href="/orchards" className="text-emerald-700 underline">回列表</Link></Empty>;

  const s = contractStatus(o);
  const year = todayStr().slice(0, 4);
  const bills = db.bills.filter((b) => b.orchardId === o.id && b.month.startsWith(year));
  const water = bills.filter((b) => b.kind === "water").reduce((a, b) => a + b.amount, 0);
  const elec = bills.filter((b) => b.kind === "electricity").reduce((a, b) => a + b.amount, 0);
  const firstGeo = o.parcels.find((p) => p.lat && p.lng);
  const treeRows = [
    ...FRUITS.map((f) => ({ name: f, n: o.trees[f] })),
    ...(o.trees.other ? [{ name: o.trees.otherName || "其它", n: o.trees.other }] : []),
  ];
  const maxTrees = Math.max(1, ...treeRows.map((t) => t.n));

  const records = [
    { label: "套袋", n: db.bagging.filter((r) => r.orchardId === o.id).length, href: "/records/bagging" },
    { label: "採收", n: db.harvests.filter((r) => r.orchardId === o.id).length, href: "/records/harvest" },
    { label: "施肥", n: db.fertilizing.filter((r) => r.orchardId === o.id).length, href: "/records/fertilizing" },
    { label: "噴藥", n: db.spraying.filter((r) => r.orchardId === o.id).length, href: "/records/spraying" },
    { label: "剪枝", n: db.labor.filter((r) => r.orchardId === o.id && r.kind === "pruning").length, href: "/records/pruning" },
    { label: "砍草", n: db.labor.filter((r) => r.orchardId === o.id && r.kind === "weeding").length, href: "/records/weeding" },
  ];

  return (
    <>
      <Link href="/orchards" className="mb-3 inline-flex items-center gap-1 text-sm text-stone-500 hover:text-emerald-700">
        <ArrowLeft size={16} /> 果園列表
      </Link>
      <PageHeader
        title={o.nameZh}
        desc={o.nameEn}
        action={
          <>
            <Link href={`/orchards/${o.id}/edit`}>
              <Button>
                <Pencil size={16} /> 編輯
              </Button>
            </Link>
            <Button
              variant="secondary"
              className="text-red-600"
              onClick={async () => {
                if (confirmDelete(`「${o.nameZh}」`) && (await remove("orchards", o.id))) {
                  router.push("/orchards");
                }
              }}
            >
              <Trash2 size={16} /> 刪除
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="面積" value={`${orchardArea(o).toFixed(1)} 分`} sub={`${o.parcels.length} 筆地號`} />
        <StatCard label="果樹總數" value={`${orchardTrees(o)} 棵`} />
        <StatCard label={`${year} 水費`} value={money(water)} />
        <StatCard label={`${year} 電費`} value={money(elec)} sub={o.electricityNo && `電號 ${o.electricityNo}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {o.photos.length > 0 && (
            <Card title="果園照片">
              <Gallery photos={o.photos} size="h-32 w-32" />
            </Card>
          )}

          <Card title="位置資訊">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="text-xs text-stone-500">
                  <tr>
                    <th className="pb-2 text-left font-medium">地號</th>
                    <th className="pb-2 text-left font-medium">地目</th>
                    <th className="pb-2 text-right font-medium">面積</th>
                    <th className="pb-2 text-right font-medium">經緯度</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {o.parcels.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2">{p.landNo || "—"}</td>
                      <td className="py-2"><Badge>{p.landType}</Badge></td>
                      <td className="py-2 text-right">{p.areaFen} 分</td>
                      <td className="py-2 text-right">
                        {p.lat && p.lng ? (
                          <a
                            href={`https://www.google.com/maps?q=${p.lat},${p.lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-700 hover:underline"
                          >
                            <MapPin size={14} /> {p.lat}, {p.lng}
                          </a>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {firstGeo && (
              <iframe
                title="果園地圖"
                className="mt-4 h-64 w-full rounded-lg border border-stone-200"
                loading="lazy"
                src={`https://maps.google.com/maps?q=${firstGeo.lat},${firstGeo.lng}&z=16&output=embed`}
              />
            )}
          </Card>

          <Card title="種植果樹">
            <div className="space-y-2">
              {treeRows.map((t) => (
                <div key={t.name} className="flex items-center gap-3 text-sm">
                  <span className="w-14 shrink-0 text-stone-600">{t.name}</span>
                  <div className="h-5 flex-1 rounded bg-stone-100">
                    <div className="h-5 rounded bg-emerald-500" style={{ width: `${(t.n / maxTrees) * 100}%` }} />
                  </div>
                  <span className="w-16 text-right font-medium">{t.n} 棵</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="設備">
            <div className="grid gap-x-8 sm:grid-cols-2">
              <div className="divide-y divide-stone-100">
                <Row label="水塔">{o.waterTank.count ? `${o.waterTank.sizeTon} 噸 × ${o.waterTank.count} 座` : ""}</Row>
                <Row label="加壓馬達">{o.pump.spec && `${o.pump.spec}（${money(o.pump.price)}）`}</Row>
                <Row label="噴藥管線">
                  {o.sprayPipe.diameterFen ? `${o.sprayPipe.diameterFen} 分管，每捲 ${money(o.sprayPipe.pricePerRoll)}，接頭 ${o.sprayPipe.fittings} 個` : ""}
                </Row>
              </div>
              <div className="divide-y divide-stone-100">
                <Row label="電網">{o.fence.has ? <Badge tone="blue">有・{o.fence.voltage} V</Badge> : "無"}</Row>
                {o.fence.has && (
                  <>
                    <Row label="材料規格">{o.fence.materialSpec}</Row>
                    <Row label="材料價格">{money(o.fence.materialPrice)}</Row>
                    <Row label="總施工材料費">{money(o.fence.totalCost)}</Row>
                  </>
                )}
              </div>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="合約">
            <div className="mb-2">
              <Badge tone={s.tone}>{s.label}</Badge>
            </div>
            <div className="divide-y divide-stone-100">
              <Row label="合約期間">{o.contract.start && `${o.contract.start} ~ ${o.contract.end}`}</Row>
              <Row label="取得成本">{money(o.acquisition.cost)}</Row>
              <Row label="取得時間">{o.acquisition.date}</Row>
              <Row label="對象">{o.acquisition.name && `${o.acquisition.name}／${o.acquisition.phone}`}</Row>
            </div>
            {o.contract.photos.length > 0 && (
              <div className="mt-3">
                <Gallery photos={o.contract.photos} />
              </div>
            )}
          </Card>

          <Card title="待完成事項">
            {(["graft", "replant"] as const).map((k) => (
              <div key={k} className="mb-3 last:mb-0">
                <div className="mb-1 text-sm font-semibold text-stone-600">{k === "graft" ? "待嫁接" : "待重新種植"}</div>
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  {Object.entries(o.todo[k]).map(([name, n]) => (
                    <div key={name} className={`rounded-lg py-2 ${n ? "bg-amber-50" : "bg-stone-50"}`}>
                      <div className="font-semibold">{n}</div>
                      <div className="text-xs text-stone-500">{name}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </Card>

          <Card title="相關作業紀錄">
            <div className="grid grid-cols-3 gap-2">
              {records.map((r) => (
                <Link key={r.label} href={r.href} className="rounded-lg bg-stone-50 py-2 text-center text-sm hover:bg-emerald-50">
                  <div className="font-semibold">{r.n}</div>
                  <div className="text-xs text-stone-500">{r.label}</div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
