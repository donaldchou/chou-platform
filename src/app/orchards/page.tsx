"use client";

import Link from "next/link";
import { Plus, Trees, Zap } from "lucide-react";
import { useDB } from "@/lib/store";
import { Badge, Button, Empty, PageHeader } from "@/components/ui";
import { FRUITS } from "@/lib/types";
import { contractStatus, orchardArea, orchardTrees } from "@/lib/utils";

export default function OrchardsPage() {
  const db = useDB();

  return (
    <>
      <PageHeader
        title="果園列表"
        desc="管理每個果園的位置、合約、果樹與設備資料。"
        action={
          <Link href="/orchards/new">
            <Button>
              <Plus size={16} /> 新增果園
            </Button>
          </Link>
        }
      />

      {db.orchards.length === 0 ? (
        <Empty>還沒有果園，點右上角「新增果園」開始建立。</Empty>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {db.orchards.map((o) => {
            const s = contractStatus(o);
            return (
              <Link
                key={o.id}
                href={`/orchards/${o.id}`}
                className="group overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="relative h-36 bg-gradient-to-br from-emerald-600 to-lime-500">
                  {o.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={o.photos[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Trees className="absolute bottom-3 right-4 text-white/40" size={64} />
                  )}
                  <div className="absolute left-3 top-3">
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-lg font-semibold text-stone-900 group-hover:text-emerald-700">{o.nameZh}</div>
                  <div className="text-sm text-stone-500">{o.nameEn || "—"}</div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-lg bg-stone-50 py-2">
                      <div className="font-semibold">{orchardArea(o).toFixed(1)}</div>
                      <div className="text-xs text-stone-500">分地</div>
                    </div>
                    <div className="rounded-lg bg-stone-50 py-2">
                      <div className="font-semibold">{orchardTrees(o)}</div>
                      <div className="text-xs text-stone-500">果樹</div>
                    </div>
                    <div className="rounded-lg bg-stone-50 py-2">
                      <div className="font-semibold">{o.parcels.length}</div>
                      <div className="text-xs text-stone-500">地號</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {FRUITS.filter((f) => o.trees[f] > 0).map((f) => (
                      <Badge key={f} tone="green">
                        {f} {o.trees[f]}
                      </Badge>
                    ))}
                    {o.trees.other > 0 && (
                      <Badge tone="green">
                        {o.trees.otherName || "其它"} {o.trees.other}
                      </Badge>
                    )}
                    {o.fence.has && (
                      <Badge tone="blue">
                        <Zap size={12} className="mr-0.5" />電網 {o.fence.voltage}V
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
