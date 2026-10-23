import type { Attendance, Material, MaterialUnit, Orchard, StoredFile } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const BENTO_PRICE = 100;

export const BAG_TYPES = [
  { type: "五月桃", perBox: 10000 },
  { type: "水蜜桃", perBox: 6000 },
  { type: "甜柿", perBox: 6000 },
];

export const bagsPerBox = (type: string) =>
  BAG_TYPES.find((b) => b.type === type)?.perBox ?? 0;

export const UNIT_LABELS: Record<MaterialUnit, string> = {
  ml: "瓶 (毫升 cc)",
  g: "包 (公克 g)",
  kg: "包 (公斤 kg)",
  片: "包 (片)",
};

export const UNIT_SHORT: Record<MaterialUnit, string> = {
  ml: "cc",
  g: "g",
  kg: "kg",
  片: "片",
};

export const money = (n: number) =>
  `NT$ ${Math.round(n || 0).toLocaleString("zh-TW")}`;

export const num = (v: string) => (v === "" ? 0 : Number(v));

function localISO(d: Date) {
  const t = new Date(d);
  t.setMinutes(t.getMinutes() - t.getTimezoneOffset());
  return t.toISOString();
}

export const todayStr = () => localISO(new Date()).slice(0, 10);
export const nowStr = () => localISO(new Date()).slice(0, 16);
export const thisMonth = () => localISO(new Date()).slice(0, 7);

export const fmtDT = (s: string) => (s ? s.replace("T", " ") : "—");

/** YYYY-MM-DDTHH:mm 往後加幾天（時間不變）；格式不對時回傳空字串 */
export function addDays(datetime: string, days: number) {
  const d = new Date(datetime);
  if (!datetime || isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return localISO(d).slice(0, 16);
}

/** 預約下次噴藥用的農藥名稱：配方裡有這項的噴藥紀錄就是預約紀錄 */
export const RESERVE_MATERIAL = "預約紀錄";

/** 資材沒填價格（費用會算成 0）；已刪除的資材、預約紀錄標記不算 */
export const missingPrice = (m?: Material) => !!m && !(m.price > 0) && m.nameZh !== RESERVE_MATERIAL;

export const isReservation =(r: { items: { materialId: string }[] }, materials: Material[]) =>
  r.items.some((i) => materials.find((m) => m.id === i.materialId)?.nameZh === RESERVE_MATERIAL);

export function daysUntil(date: string) {
  if (!date) return Infinity;
  const ms = new Date(date + "T00:00:00").getTime() - new Date(todayStr() + "T00:00:00").getTime();
  return Math.round(ms / 86400000);
}

export function daySpan(start: string, end: string) {
  if (!start || !end) return 0;
  return Math.max(0, daysUntil(end) - daysUntil(start)) + 1;
}

export function hoursBetween(a: string, b: string) {
  if (!a || !b) return 0;
  const h = (new Date(b).getTime() - new Date(a).getTime()) / 3600000;
  return h > 0 ? Math.round(h * 10) / 10 : 0;
}

/** Per person: distinct working days from attendance entries. */
export function attendanceDays(rows: Attendance[]) {
  const map = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.name || !r.in) continue;
    if (!map.has(r.name)) map.set(r.name, new Set());
    map.get(r.name)!.add(r.in.slice(0, 10));
  }
  return [...map.entries()].map(([name, days]) => ({ name, days: days.size }));
}

export function contractStatus(o: Orchard) {
  const d = daysUntil(o.contract.end);
  if (!o.contract.end) return { label: "無合約", tone: "gray" as const, days: d };
  if (d < 0) return { label: "合約已到期", tone: "red" as const, days: d };
  if (d <= 90) return { label: `${d} 天後到期`, tone: "amber" as const, days: d };
  return { label: "合約有效", tone: "green" as const, days: d };
}

export const orchardArea = (o: Orchard) =>
  o.parcels.reduce((s, p) => s + (p.areaFen || 0), 0);

export const orchardTrees = (o: Orchard) =>
  o.trees.五月桃 + o.trees.水蜜桃 + o.trees.李子 + o.trees.甜柿 + o.trees.other;

export const orchardLabel = (o?: Orchard) =>
  o ? `${o.nameZh}${o.nameEn ? ` (${o.nameEn})` : ""}` : "（已刪除的果園）";

/** 新增紀錄時預設帶入的果園：第一個使用中的果園，全部關閉時才用第一個 */
export const defaultOrchard = (orchards: Orchard[]): Orchard | undefined =>
  orchards.find((o) => o.active !== false) ?? orchards[0];

/** 每瓶／包的容量，換算成基本單位（cc／g／片） */
export const materialBase = (m: Material) => (m.size || 0) * (m.unit === "kg" ? 1000 : 1);

/** Cost of using `amount` (cc / g) of a material, based on its package price. */
export function materialCost(m: Material | undefined, amount: number) {
  if (!m || !m.size) return 0;
  return (m.price / materialBase(m)) * amount;
}

/** 施肥的整體用量單位：液體（ml）用公升，其他用公斤 */
export const fertUnit = (m?: Material) => (m?.unit === "ml" ? "L" : "kg");

/** 施肥用量（L／kg）換算成幾包；沒設定每包容量時是 null */
export function fertPacks(m: Material | undefined, amount: number) {
  if (!m || !materialBase(m)) return null;
  return Math.round(((amount * 1000) / materialBase(m)) * 100) / 100;
}

/** 資材 targets 欄位的名稱 */
export const MATERIAL_TARGETS_LABEL = "成分說明";

/** 員工參考卡用的照片：有指定而且還在照片裡就用它，否則用第一張 */
export const cardPhotoOf = (m?: Material) =>
  m?.cardPhoto && m.photos?.includes(m.cardPhoto) ? m.cardPhoto : m?.photos?.[0];

export const materialName = (m?: Material) =>
  m ? `${m.nameZh}${m.nameEn ? ` (${m.nameEn})` : ""}` : "（已刪除）";

/** 在瀏覽器把照片縮小並轉成 JPEG，減少上傳時間與儲存空間 */
export function compressImage(file: File, max = 1600): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const img = new Image();
    img.onerror = () => {
      URL.revokeObjectURL(src);
      reject(new Error("無法讀取這張圖片"));
    };
    img.onload = () => {
      URL.revokeObjectURL(src);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("圖片壓縮失敗"))), "image/jpeg", 0.8);
    };
    img.src = src;
  });
}

/** 照片／檔案存在 ll3 主機（ll3:...）或舊的 Vercel Blob，都不能直接開啟，要經過 /api/photo */
const isStored = (url: string) => url.startsWith("ll3:") || url.includes(".blob.vercel-storage.com/");

/** 把 MongoDB 中的照片網址轉成 <img> 可用的網址 */
export const photoSrc = (url: string) => (isStored(url) ? `/api/photo?url=${encodeURIComponent(url)}` : url);

/** 上傳、下載都分段，每段 3MB（Vercel 請求／回應上限約 4.5MB，同 /api/file 的 FILE_PART） */
const FILE_PART = 3 * 1024 * 1024;

/** 上傳檔案到 ll3 主機（經由 /api/upload，大檔案分段送），回傳要存進 MongoDB 的資料 */
export async function uploadFile(
  file: Blob,
  name: string,
  folder: string,
  onProgress?: (ratio: number) => void,
): Promise<StoredFile> {
  const uploadId = [...crypto.getRandomValues(new Uint8Array(12))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const parts = Math.max(1, Math.ceil(file.size / FILE_PART));
  let data: StoredFile & { error?: string } = { url: "", name, size: file.size, type: file.type };
  for (let i = 0; i < parts; i++) {
    const form = new FormData();
    form.append("file", file.slice(i * FILE_PART, (i + 1) * FILE_PART), "part");
    form.append("uploadId", uploadId);
    form.append("index", String(i));
    form.append("last", i === parts - 1 ? "1" : "0");
    form.append("name", name);
    form.append("size", String(file.size));
    form.append("folder", folder);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? `上傳失敗（HTTP ${res.status}）`);
    onProgress?.((i + 1) / parts);
  }
  return { url: data.url, name: data.name, size: data.size, type: data.type };
}

/** 上傳照片（先在瀏覽器壓縮），回傳照片網址 */
export async function uploadPhoto(file: File, folder = "photos"): Promise<string> {
  return (await uploadFile(await compressImage(file), "photo.jpg", folder)).url;
}

/** 分段讀取 ll3 主機上的檔案，組成一個 Blob */
export async function fetchStoredFile(f: StoredFile): Promise<Blob> {
  const parts: Blob[] = [];
  let got = 0;
  for (let i = 0; ; i++) {
    const res = await fetch(`/api/file?url=${encodeURIComponent(f.url)}&part=${i}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `讀取檔案失敗（HTTP ${res.status}）`);
    }
    const total = Number(res.headers.get("x-file-size") ?? 0);
    const b = await res.blob();
    parts.push(b);
    got += b.size;
    if (!b.size || got >= total) break;
  }
  return new Blob(parts, { type: f.type });
}

/** 開啟檔案：PDF／圖片開新分頁，其他（Excel、Word…）下載 */
export async function openStoredFile(f: StoredFile) {
  const view = f.type === "application/pdf" || f.type.startsWith("image/");
  // 要在點擊當下開視窗，等下載完才開會被擋
  const win = view ? window.open("", "_blank") : null;
  if (win) win.document.title = `讀取中… ${f.name}`;
  try {
    const href = URL.createObjectURL(await fetchStoredFile(f));
    if (win) win.location.href = href;
    else {
      const a = document.createElement("a");
      a.href = href;
      a.download = f.name;
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(href), 60_000);
  } catch (err) {
    win?.close();
    alert(err instanceof Error ? err.message : String(err));
  }
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
