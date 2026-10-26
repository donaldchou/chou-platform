/**
 * 一般使用者的頁面權限（前後端共用）。
 * 帳號看得到的頁面 ＝ 後台「① 一般使用者可以看的頁面」有勾，且「② 個別帳號再隱藏」沒勾；管理者永遠看得到全部。
 * 後台管理、常用平台只給管理者，不在這裡。
 */
export const USER_PAGES = [
  { key: "dashboard", label: "儀表板", group: "總覽", href: "/" },
  { key: "orchards", label: "果園列表", group: "果園管理", href: "/orchards" },
  { key: "water", label: "水費紀錄", group: "果園管理", href: "/records/water" },
  { key: "electricity", label: "電費紀錄", group: "果園管理", href: "/records/electricity" },
  { key: "bagging", label: "套袋紀錄", group: "果園管理", href: "/records/bagging" },
  { key: "harvest", label: "採收紀錄", group: "果園管理", href: "/records/harvest" },
  { key: "fertilizing", label: "施肥紀錄", group: "果園管理", href: "/records/fertilizing" },
  { key: "spraying", label: "噴藥紀錄", group: "果園管理", href: "/records/spraying" },
  { key: "pruning", label: "剪枝/開花/結果/疏果紀錄", group: "果園管理", href: "/records/pruning" },
  { key: "weeding", label: "砍草紀錄", group: "果園管理", href: "/records/weeding" },
  { key: "propagation", label: "種苗/嫁接/環剝", group: "果園管理", href: "/records/propagation" },
  { key: "suppliers", label: "貨源店家", group: "進貨與資材", href: "/suppliers" },
  { key: "pesticides", label: "農藥", group: "進貨與資材", href: "/materials/pesticides" },
  { key: "fertilizers", label: "肥料", group: "進貨與資材", href: "/materials/fertilizers" },
  { key: "packaging", label: "包材 / 乾貨", group: "進貨與資材", href: "/materials/packaging" },
  { key: "stock", label: "庫存數量", group: "進貨與資材", href: "/materials/stock" },
  { key: "staff", label: "員工管理/指派", group: "人員", href: "/staff" },
  { key: "workers", label: "外請工人", group: "人員", href: "/workers" },
  { key: "knowledge", label: "知識管理", group: "人員", href: "/knowledge" },
] as const;

export type PageKey = (typeof USER_PAGES)[number]["key"];
export const PAGE_KEYS: PageKey[] = USER_PAGES.map((p) => p.key);
export const isPageKey = (v: unknown): v is PageKey => PAGE_KEYS.includes(v as PageKey);
export const pageLabel = (k: PageKey) => USER_PAGES.find((p) => p.key === k)!.label;
export const pageHref = (k: PageKey) => USER_PAGES.find((p) => p.key === k)!.href;

/** 網址屬於哪個頁面；不屬於任何一個（登入、後台、常用平台）回 null */
export function pageOfPath(path: string): PageKey | null {
  if (path === "/") return "dashboard";
  // 長的先比，例如 /records/water 不會被 /records 吃掉
  const hit = USER_PAGES.filter((p) => p.href !== "/" && (path === p.href || path.startsWith(p.href + "/"))).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
  return hit?.key ?? null;
}

/**
 * /api/db、/api/<collection> 的資料：有其中一個頁面的權限才給。
 * 列的是實際會用到這份資料的頁面（例如儀表板、果園詳細頁會彙整各種紀錄）；沒列的集合（果園）都給。
 * 空陣列＝只有管理者（常用平台）。
 */
export const COLLECTION_PAGES: Partial<Record<string, PageKey[]>> = {
  bills: ["water", "electricity", "orchards", "dashboard"],
  bagging: ["bagging", "orchards", "workers", "stock", "dashboard"],
  harvests: ["harvest", "orchards", "dashboard"],
  fertilizing: ["fertilizing", "spraying", "orchards", "stock", "dashboard"],
  spraying: ["spraying", "fertilizing", "orchards", "stock", "dashboard"],
  labor: ["pruning", "weeding", "orchards", "workers", "dashboard"],
  phenology: ["pruning", "orchards", "dashboard"],
  propagation: ["propagation", "orchards", "dashboard"],
  suppliers: ["suppliers", "pesticides", "fertilizers", "packaging", "stock"],
  materials: ["pesticides", "fertilizers", "packaging", "stock", "spraying", "fertilizing", "suppliers", "dashboard"],
  stock: ["stock"],
  // 儀表板的「員工待辦」只在看得到員工管理時顯示，所以待辦與員工資料不因儀表板而給
  employees: ["staff", "spraying", "fertilizing", "pruning", "weeding", "propagation", "bagging"],
  workers: ["workers", "bagging", "pruning", "weeding"],
  tasks: ["staff"],
  salaries: ["staff"],
  bonuses: ["staff"],
  knowledge: ["knowledge"],
  platforms: [],
};

export type PageAccessSettings = {
  /** ① 一般使用者可以看的頁面 */
  allowed: PageKey[];
  /** 一般使用者帳號與各自另外隱藏的頁面 */
  users: { id: string; email: string; name: string; active: boolean; hiddenPages: PageKey[] }[];
};
