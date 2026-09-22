"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Axe,
  Apple,
  Boxes,
  ClipboardList,
  Droplets,
  FlaskConical,
  LayoutDashboard,
  Leaf,
  Menu,
  Package,
  RotateCcw,
  Scissors,
  ShoppingBasket,
  SprayCan,
  Sprout,
  Store,
  Trees,
  UserRound,
  Users,
  X,
  Zap,
} from "lucide-react";
import { resetDemo } from "@/lib/store";

const NAV = [
  {
    group: "總覽",
    items: [{ href: "/", label: "儀表板", icon: LayoutDashboard }],
  },
  {
    group: "果園管理",
    items: [
      { href: "/orchards", label: "果園列表", icon: Trees },
      { href: "/records/water", label: "水費紀錄", icon: Droplets },
      { href: "/records/electricity", label: "電費紀錄", icon: Zap },
      { href: "/records/bagging", label: "套袋紀錄", icon: ShoppingBasket },
      { href: "/records/harvest", label: "採收紀錄", icon: Apple },
      { href: "/records/fertilizing", label: "施肥紀錄", icon: Sprout },
      { href: "/records/spraying", label: "噴藥紀錄", icon: SprayCan },
      { href: "/records/pruning", label: "剪枝紀錄", icon: Scissors },
      { href: "/records/weeding", label: "砍草紀錄", icon: Axe },
    ],
  },
  {
    group: "進貨與資材",
    items: [
      { href: "/suppliers", label: "貨源店家", icon: Store },
      { href: "/materials/pesticides", label: "農藥", icon: FlaskConical },
      { href: "/materials/fertilizers", label: "肥料", icon: Leaf },
      { href: "/materials/packaging", label: "包材 / 乾貨", icon: Package },
    ],
  },
  {
    group: "人員",
    items: [
      { href: "/staff", label: "員工工作回報", icon: ClipboardList },
      { href: "/workers", label: "外請工人", icon: Users },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  const nav = (
    <nav className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white">
          <Boxes size={20} />
        </div>
        <div>
          <div className="font-bold leading-tight text-white">CHOU 農場平台</div>
          <div className="text-xs text-emerald-200/80">果園管理系統</div>
        </div>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-emerald-300/70">
              {g.group}
            </div>
            {g.items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive(it.href)
                    ? "bg-emerald-700 font-medium text-white"
                    : "text-emerald-50/85 hover:bg-emerald-800/70"
                }`}
              >
                <it.icon size={18} />
                {it.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-emerald-800 p-3">
        <div className="mb-2 flex items-center gap-2 px-2 text-sm text-emerald-100">
          <UserRound size={16} /> 農場管理者
        </div>
        <button
          onClick={() => {
            if (confirm("要清除所有變更，還原成示範資料嗎？")) resetDemo();
          }}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-emerald-200/80 hover:bg-emerald-800/70"
        >
          <RotateCcw size={14} /> 重設示範資料
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-stone-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 bg-emerald-950 lg:block print:hidden">{nav}</aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-emerald-950">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-5 text-emerald-100"
              aria-label="關閉選單"
            >
              <X size={20} />
            </button>
            {nav}
          </aside>
        </div>
      )}

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-stone-200 bg-white/90 px-4 py-3 backdrop-blur lg:hidden print:hidden">
          <button onClick={() => setOpen(true)} aria-label="開啟選單" className="text-stone-700">
            <Menu size={22} />
          </button>
          <span className="font-semibold text-stone-800">CHOU 農場平台</span>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
