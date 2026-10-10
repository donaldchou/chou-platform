"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import {
  Axe,
  Apple,
  BookOpen,
  Boxes,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  Droplets,
  FlaskConical,
  Globe,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Package,
  Scissors,
  ShieldCheck,
  ShoppingBasket,
  Shovel,
  SprayCan,
  Sprout,
  Store,
  Trees,
  UserRound,
  Users,
  Warehouse,
  X,
  Zap,
} from "lucide-react";
import { logout, reload, useDBStatus, useMe } from "@/lib/store";

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
      { href: "/records/pruning", label: "剪枝/開花/結果/疏果紀錄", icon: Scissors },
      { href: "/records/weeding", label: "砍草紀錄", icon: Axe },
      { href: "/records/propagation", label: "種苗/嫁接/環剝", icon: Shovel },
    ],
  },
  {
    group: "進貨與資材",
    items: [
      { href: "/suppliers", label: "貨源店家", icon: Store },
      { href: "/materials/pesticides", label: "農藥", icon: FlaskConical },
      { href: "/materials/fertilizers", label: "肥料", icon: Leaf },
      { href: "/materials/packaging", label: "包材 / 乾貨", icon: Package },
      { href: "/materials/stock", label: "庫存數量", icon: Warehouse },
    ],
  },
  {
    group: "人員",
    items: [
      { href: "/staff", label: "員工管理/指派", icon: ClipboardList },
      { href: "/workers", label: "外請工人", icon: Users },
      { href: "/knowledge", label: "知識管理", icon: BookOpen },
    ],
  },
];

/** 只有管理者看得到的選單 */
const ADMIN_NAV = {
  group: "系統",
  items: [
    { href: "/admin", label: "後台管理", icon: ShieldCheck },
    { href: "/platforms", label: "常用平台", icon: Globe },
  ],
};

/** 不套用側邊選單的頁面 */
const BARE_PAGES = ["/login"];

/* ---------------- 側邊選單收合狀態，記在這台電腦的瀏覽器 ---------------- */
const COLLAPSE_KEY = "chou-sidebar-collapsed";
const collapseListeners = new Set<() => void>();
let memoryCollapsed: boolean | null = null;

function readCollapsed() {
  if (memoryCollapsed !== null) return memoryCollapsed;
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeCollapsed(v: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
  } catch {
    // 無法儲存（例如無痕模式）時，只在這次瀏覽有效
  }
  memoryCollapsed = v;
  collapseListeners.forEach((l) => l());
}

function useCollapsed(): [boolean, (v: boolean) => void] {
  const collapsed = useSyncExternalStore(
    (l) => {
      collapseListeners.add(l);
      return () => collapseListeners.delete(l);
    },
    readCollapsed,
    () => false,
  );
  return [collapsed, writeCollapsed];
}

/* ---------------- 選單分組的展開／收合，記在這台電腦的瀏覽器 ---------------- */
const GROUPS_KEY = "chou-nav-closed-groups";
const groupListeners = new Set<() => void>();
let memoryGroups: string | null = null; // JSON 字串，讓 useSyncExternalStore 拿到穩定的值

function readClosedGroups(): string {
  if (memoryGroups !== null) return memoryGroups;
  try {
    return localStorage.getItem(GROUPS_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function saveClosedGroups(closed: Set<string>) {
  memoryGroups = JSON.stringify([...closed]);
  try {
    localStorage.setItem(GROUPS_KEY, memoryGroups);
  } catch {
    // 無法儲存（例如無痕模式）時，只在這次瀏覽有效
  }
  groupListeners.forEach((l) => l());
}

function useClosedGroups(): [Set<string>, (group: string) => void, (groups: string[]) => void] {
  const raw = useSyncExternalStore(
    (l) => {
      groupListeners.add(l);
      return () => groupListeners.delete(l);
    },
    readClosedGroups,
    () => "[]",
  );
  let closed: Set<string>;
  try {
    closed = new Set(JSON.parse(raw) as string[]);
  } catch {
    closed = new Set();
  }
  const toggle = (group: string) => {
    const next = new Set(closed);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    saveClosedGroups(next);
  };
  // 全部收合；已經全部收合時改成全部展開
  const toggleAll = (groups: string[]) =>
    saveClosedGroups(groups.every((g) => closed.has(g)) ? new Set() : new Set(groups));
  return [closed, toggle, toggleAll];
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (BARE_PAGES.includes(pathname)) return <>{children}</>;
  return <Shell pathname={pathname}>{children}</Shell>;
}

function Shell({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  // 只有桌機的浮動選單會收合；手機仍用抽屜
  const [collapsed, setCollapsed] = useCollapsed();
  const [closedGroups, toggleGroup, toggleAllGroups] = useClosedGroups();
  const me = useMe();
  const groups = me?.role === "admin" ? [...NAV, ADMIN_NAV] : NAV;
  const roleLabel = me ? (me.role === "admin" ? "管理者" : "一般使用者（唯讀）") : "";
  const allClosed = groups.every((g) => closedGroups.has(g.group));

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");

  const nav = (mini: boolean) => (
    <nav className="flex h-full flex-col">
      <div className={`flex items-center gap-2 py-5 ${mini ? "justify-center px-2" : "px-5"}`}>
        {/* 點圖示：全部分組展開／收合（只剩圖示的窄選單沒有分組，改成展開選單） */}
        <button
          type="button"
          onClick={() => (mini ? setCollapsed(false) : toggleAllGroups(groups.map((g) => g.group)))}
          title={mini ? "展開選單" : allClosed ? "全部展開" : "全部收合"}
          aria-label={mini ? "展開選單" : allClosed ? "全部展開" : "全部收合"}
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-emerald-600 text-white transition-colors hover:bg-emerald-500"
        >
          <Boxes size={22} />
        </button>
        {!mini && (
          <div className="min-w-0">
            <div className="truncate text-lg font-bold leading-tight text-white">CHOU 農場平台</div>
            <div className="text-sm text-emerald-200/80">果園管理系統</div>
          </div>
        )}
      </div>
      <div
        className={`flex-1 space-y-4 overflow-y-auto overflow-x-hidden pb-4 ${mini ? "px-2" : "px-3"}`}
        style={{ scrollbarWidth: "thin", scrollbarColor: "#047857 transparent" }}
      >
        {groups.map((g) => {
          // 只剩圖示的窄選單不分組收合；收合的分組裡如果有目前頁面，標題會亮起來提示
          const open = mini || !closedGroups.has(g.group);
          const hasActive = g.items.some((it) => isActive(it.href));
          return (
            <div key={g.group}>
              {mini ? (
                <div className="mx-2 mb-2 border-t border-emerald-800" />
              ) : (
                <button
                  type="button"
                  onClick={() => toggleGroup(g.group)}
                  aria-expanded={open}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-md px-2 pb-1 pt-0.5 text-sm font-semibold tracking-wider hover:text-emerald-100 ${
                    !open && hasActive ? "text-emerald-100" : "text-emerald-300/70"
                  }`}
                >
                  <span>{g.group}</span>
                  <span className="flex items-center gap-1.5">
                    {!open && <span className="text-xs font-normal">{g.items.length}</span>}
                    <ChevronDown size={16} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
                  </span>
                </button>
              )}
              {open && g.items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  title={mini ? it.label : undefined}
                  aria-label={mini ? it.label : undefined}
                  className={`flex items-center gap-3 rounded-lg py-2.5 text-base transition-colors ${
                    mini ? "justify-center px-0" : "px-3"
                  } ${isActive(it.href) ? "bg-emerald-700 font-medium text-white" : "text-emerald-50/85 hover:bg-emerald-800/70"}`}
                >
                  <it.icon size={20} className="shrink-0" />
                  {!mini && <span className="truncate">{it.label}</span>}
                </Link>
              ))}
            </div>
          );
        })}
      </div>
      <div className="space-y-1 border-t border-emerald-800 p-3">
        <div
          className={`flex items-center gap-2 text-base text-emerald-100 ${mini ? "justify-center" : "px-2"}`}
          title={me ? `${me.email}（${roleLabel}）` : undefined}
        >
          <UserRound size={18} className="shrink-0" />
          {!mini && (
            <div className="min-w-0">
              <div className="truncate">{me?.name || me?.email || "…"}</div>
              <div className="text-sm text-emerald-300/80">{roleLabel}</div>
            </div>
          )}
        </div>
        <button
          onClick={() => void logout()}
          title={mini ? "登出" : undefined}
          aria-label="登出"
          className={`flex w-full cursor-pointer items-center gap-3 rounded-lg py-2 text-base text-emerald-50/85 hover:bg-emerald-800/70 ${
            mini ? "justify-center px-0" : "px-3"
          }`}
        >
          <LogOut size={18} className="shrink-0" /> {!mini && "登出"}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-stone-100">
      {/* 桌機：浮動、圓角的選單，可收合成只剩圖示 */}
      <aside
        className={`fixed inset-y-3 left-3 z-30 hidden rounded-2xl bg-emerald-950 shadow-xl transition-[width] duration-200 lg:block print:hidden ${
          collapsed ? "w-18" : "w-64"
        }`}
      >
        {nav(collapsed)}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3.5 top-7 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-md hover:text-emerald-700"
          aria-label={collapsed ? "展開選單" : "收合選單"}
          title={collapsed ? "展開選單" : "收合選單"}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-emerald-950">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-3 top-6 text-emerald-100"
              aria-label="關閉選單"
            >
              <X size={22} />
            </button>
            {nav(false)}
          </aside>
        </div>
      )}

      <div className={`transition-[padding] duration-200 ${collapsed ? "lg:pl-24" : "lg:pl-70"} print:pl-0`}>
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-stone-200 bg-white/90 px-3 py-3 backdrop-blur lg:hidden print:hidden">
          <button onClick={() => setOpen(true)} aria-label="開啟選單" className="text-stone-700">
            <Menu size={24} />
          </button>
          <span className="text-lg font-semibold text-stone-800">CHOU 農場平台</span>
        </header>
        {/* 內容用滿寬度，左右只留少量空白 */}
        <main className="px-3 py-4 sm:px-4 lg:py-5 lg:pr-5">
          <DBStatusBanner />
          {children}
        </main>
      </div>
    </div>
  );
}

function DBStatusBanner() {
  const { status, error } = useDBStatus();
  if (status === "loading" || status === "idle") {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-white px-4 py-3 text-sm text-stone-500 shadow-sm">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
        正在從資料庫載入資料…
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        <span>無法連線到資料庫：{error}</span>
        <button onClick={() => void reload()} className="rounded-md bg-red-600 px-3 py-1 text-white hover:bg-red-700">
          重試
        </button>
      </div>
    );
  }
  return null;
}
