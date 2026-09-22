"use client";

import Link from "next/link";
import { AlertTriangle, CalendarClock, Coins, Map, Sprout, Trees } from "lucide-react";
import { useDB } from "@/lib/store";
import { Badge, Card, PageHeader, StatCard } from "@/components/ui";
import {
  contractStatus,
  fmtDT,
  money,
  orchardArea,
  orchardLabel,
  orchardTrees,
  todayStr,
} from "@/lib/utils";

export default function Dashboard() {
  const db = useDB();
  const year = todayStr().slice(0, 4);
  const orchard = (id: string) => db.orchards.find((o) => o.id === id);

  const totalArea = db.orchards.reduce((s, o) => s + orchardArea(o), 0);
  const totalTrees = db.orchards.reduce((s, o) => s + orchardTrees(o), 0);
  const yearBills = db.bills.filter((b) => b.month.startsWith(year));
  const water = yearBills.filter((b) => b.kind === "water").reduce((s, b) => s + b.amount, 0);
  const elec = yearBills.filter((b) => b.kind === "electricity").reduce((s, b) => s + b.amount, 0);

  const expiring = db.orchards
    .map((o) => ({ o, s: contractStatus(o) }))
    .filter(({ s }) => s.tone === "red" || s.tone === "amber")
    .sort((a, b) => a.s.days - b.s.days);

  const todoRows = db.orchards
    .map((o) => ({
      o,
      graft: Object.values(o.todo.graft).reduce((a, b) => a + b, 0),
      replant: Object.values(o.todo.replant).reduce((a, b) => a + b, 0),
    }))
    .filter((r) => r.graft + r.replant > 0);

  const openTasks = db.tasks.filter((t) => t.status !== "已完成");
  const banned = db.materials.filter((m) => m.bannedPeriod);

  const recent = [
    ...db.spraying.map((r) => ({ at: r.datetime, type: "噴藥", orchardId: r.orchardId, href: "/records/spraying" })),
    ...db.fertilizing.map((r) => ({ at: r.datetime, type: "施肥", orchardId: r.orchardId, href: "/records/fertilizing" })),
    ...db.labor.map((r) => ({
      at: r.start,
      type: r.kind === "pruning" ? "剪枝" : "砍草",
      orchardId: r.orchardId,
      href: r.kind === "pruning" ? "/records/pruning" : "/records/weeding",
    })),
    ...db.bagging.map((r) => ({ at: r.start, type: "套袋", orchardId: r.orchardId, href: "/records/bagging" })),
    ...db.harvests.map((r) => ({ at: r.start, type: "採收", orchardId: r.orchardId, href: "/records/harvest" })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6);

  return (
    <>
      <PageHeader title="儀表板" desc={`今天是 ${todayStr()}，以下是農場的整體狀況。`} />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="果園數" value={db.orchards.length} icon={<Trees size={18} />} sub="管理中的果園" />
        <StatCard label="總面積" value={`${totalArea.toFixed(1)} 分`} icon={<Map size={18} />} sub={`約 ${(totalArea * 0.097).toFixed(2)} 公頃`} />
        <StatCard label="果樹總數" value={`${totalTrees.toLocaleString()} 棵`} icon={<Sprout size={18} />} />
        <StatCard label={`${year} 年水電費`} value={money(water + elec)} icon={<Coins size={18} />} sub={`水 ${money(water)}／電 ${money(elec)}`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title={<span className="flex items-center gap-2"><CalendarClock size={18} className="text-amber-600" />合約到期提醒（3 個月內）</span>}>
          {expiring.length ? (
            <ul className="divide-y divide-stone-100">
              {expiring.map(({ o, s }) => (
                <li key={o.id} className="flex items-center justify-between py-2.5">
                  <Link href={`/orchards/${o.id}`} className="font-medium text-stone-800 hover:text-emerald-700">
                    {orchardLabel(o)}
                  </Link>
                  <div className="flex items-center gap-2 text-sm text-stone-500">
                    到期日 {o.contract.end}
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">目前沒有即將到期的合約。</p>
          )}
        </Card>

        <Card title="待完成事項（嫁接／重新種植）">
          {todoRows.length ? (
            <table className="w-full text-sm">
              <thead className="text-xs text-stone-500">
                <tr>
                  <th className="pb-2 text-left font-medium">果園</th>
                  <th className="pb-2 text-right font-medium">待嫁接</th>
                  <th className="pb-2 text-right font-medium">待重新種植</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {todoRows.map((r) => (
                  <tr key={r.o.id}>
                    <td className="py-2">
                      <Link href={`/orchards/${r.o.id}`} className="hover:text-emerald-700">{r.o.nameZh}</Link>
                    </td>
                    <td className="py-2 text-right">{r.graft} 棵</td>
                    <td className="py-2 text-right">{r.replant} 棵</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-stone-500">沒有待完成事項。</p>
          )}
        </Card>

        <Card title="員工待辦工作" action={<Link href="/staff" className="text-sm text-emerald-700 hover:underline">查看全部</Link>}>
          {openTasks.length ? (
            <ul className="divide-y divide-stone-100">
              {openTasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2.5 text-sm">
                  <div>
                    <div className="font-medium text-stone-800">{t.title}</div>
                    <div className="text-xs text-stone-500">
                      {db.employees.find((e) => e.id === t.employeeId)?.name ?? "—"}・{orchard(t.orchardId)?.nameZh ?? "—"}・期限 {t.dueDate}
                    </div>
                  </div>
                  <Badge tone={t.status === "進行中" ? "blue" : "amber"}>{t.status}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-500">所有工作都已完成。</p>
          )}
        </Card>

        <Card title="近期作業紀錄">
          <ul className="divide-y divide-stone-100">
            {recent.map((r, i) => (
              <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                <Link href={r.href} className="flex items-center gap-2 hover:text-emerald-700">
                  <Badge tone="green">{r.type}</Badge>
                  {orchard(r.orchardId)?.nameZh ?? "—"}
                </Link>
                <span className="text-stone-500">{fmtDT(r.at)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {banned.length > 0 && (
        <Card className="mt-6 border-red-200" title={<span className="flex items-center gap-2 text-red-700"><AlertTriangle size={18} />農藥／肥料禁用期提醒</span>}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {banned.map((m) => (
              <div key={m.id} className="rounded-lg bg-red-50 px-3 py-2 text-sm">
                <div className="font-medium text-stone-800">{m.nameZh}</div>
                <div className="font-semibold text-red-600">{m.bannedPeriod}</div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
