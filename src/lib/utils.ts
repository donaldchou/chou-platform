import type { Attendance, Material, MaterialUnit, Orchard } from "./types";

export const uid = () => Math.random().toString(36).slice(2, 10);

export const BENTO_PRICE = 100;

export const BAG_TYPES = [
  { type: "甜桃", perBox: 10000 },
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
  o.trees.甜桃 + o.trees.水蜜桃 + o.trees.李子 + o.trees.甜柿 + o.trees.other;

export const orchardLabel = (o?: Orchard) =>
  o ? `${o.nameZh}${o.nameEn ? ` (${o.nameEn})` : ""}` : "（已刪除的果園）";

/** Cost of using `amount` (cc / g) of a material, based on its package price. */
export function materialCost(m: Material | undefined, amount: number) {
  if (!m || !m.size) return 0;
  const base = m.unit === "kg" ? m.size * 1000 : m.size;
  return (m.price / base) * amount;
}

export const materialName = (m?: Material) =>
  m ? `${m.nameZh}${m.nameEn ? ` (${m.nameEn})` : ""}` : "（已刪除）";

/** Downscale an image file to a JPEG data URL so it fits in localStorage. */
export function fileToDataUrl(file: File, max = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
