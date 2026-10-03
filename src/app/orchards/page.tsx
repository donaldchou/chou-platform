"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Plus, Trees, Zap } from "lucide-react";
import { useDB } from "@/lib/store";
import { Badge, Button, Empty, PageHeader, Table, Td } from "@/components/ui";
import { FRUITS, type Orchard } from "@/lib/types";
import { contractStatus, orchardArea, orchardTrees, photoSrc } from "@/lib/utils";

type View = "grid" | "list";

/** 果樹種類＋電網標籤（卡片與清單共用） */
function OrchardTags({ o }: { o: Orchard }) {
  return (
    <div className="flex flex-wrap gap-1.5">
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
  );
}

function OrchardGrid({ orchards }: { orchards: Orchard[] }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
      {orchards.map((o) => {
        const s = contractStatus(o);
        return (
          <Link
            key={o.id}
            href={`/orchards/${o.id}`}
            className={`group overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
              o.active ? "" : "opacity-60 grayscale"
            }`}
          >
            <div className="relative h-36 bg-gradient-to-br from-emerald-600 to-lime-500">
              {o.photos[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoSrc(o.photos[0])} alt="" className="h-full w-full object-cover" />
              ) : (
                <Trees className="absolute bottom-3 right-4 text-white/40" size={64} />
              )}
              <div className="absolute left-3 top-3 flex gap-1.5">
                {!o.active && <Badge>已關閉</Badge>}
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
              <div className="mt-3">
                <OrchardTags o={o} />
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function OrchardList({ orchards, closed }: { orchards: Orchard[]; closed: boolean }) {
  const router = useRouter();
  return (
    <Table head={["果園", "合約", "面積（分）", "果樹", "地號", "果樹種類／設備", ...(closed ? ["關閉原因"] : [])]}>
      {orchards.map((o) => {
        const s = contractStatus(o);
        return (
          <tr
            key={o.id}
            onClick={() => router.push(`/orchards/${o.id}`)}
            className={`cursor-pointer hover:bg-emerald-50/50 ${closed ? "text-stone-500" : ""}`}
          >
            <Td>
              <Link href={`/orchards/${o.id}`} className="font-semibold text-stone-900 hover:text-emerald-700">
                {o.nameZh}
              </Link>
              {o.nameEn && <div className="text-xs text-stone-500">{o.nameEn}</div>}
            </Td>
            <Td>
              <Badge tone={s.tone}>{s.label}</Badge>
            </Td>
            <Td className="tabular-nums text-stone-700">{orchardArea(o).toFixed(1)}</Td>
            <Td className="tabular-nums text-stone-700">{orchardTrees(o)}</Td>
            <Td className="tabular-nums text-stone-700">{o.parcels.length}</Td>
            <Td>
              <OrchardTags o={o} />
            </Td>
            {closed && <Td className="max-w-xs whitespace-pre-wrap text-stone-600">{o.closedReason || "—"}</Td>}
          </tr>
        );
      })}
    </Table>
  );
}

export default function OrchardsPage() {
  const db = useDB();
  const [view, setView] = useState<View>("list");

  const groups = [
    { key: "active", title: "啟用中", closed: false, list: db.orchards.filter((o) => o.active) },
    { key: "closed", title: "已關閉", closed: true, list: db.orchards.filter((o) => !o.active) },
  ].filter((g) => g.list.length > 0);

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
        <>
          <div className="mb-4 flex justify-end">
            <div className="flex rounded-lg border border-stone-300 bg-white p-0.5" role="group" aria-label="顯示方式">
              {(
                [
                  { v: "list", label: "清單", icon: List },
                  { v: "grid", label: "卡片", icon: LayoutGrid },
                ] as const
              ).map(({ v, label, icon: Icon }) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                    view === v ? "bg-emerald-700 text-white" : "text-stone-600 hover:bg-stone-100"
                  }`}
                >
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-8">
            {groups.map((g) => (
              <section key={g.key}>
                <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-stone-700">
                  {g.title}
                  <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-medium text-stone-600">
                    {g.list.length}
                  </span>
                </h2>
                {view === "grid" ? (
                  <OrchardGrid orchards={g.list} />
                ) : (
                  <OrchardList orchards={g.list} closed={g.closed} />
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </>
  );
}
