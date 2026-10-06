import type { DB, Material, StockKind, StockTxn } from "./types";
import { bagsPerBox, daysUntil, fertUnit, materialBase, materialCost, nowStr, orchardLabel, todayStr } from "./utils";

/*
 * 庫存計算：庫存不存數字，而是由異動依時間順序算出來。
 *  - 進貨（+）、報廢（−）、盤點（直接設定成實際數量）存在 stock 集合
 *  - 噴藥、施肥、套袋紀錄的用量即時換算成扣帳，改了舊紀錄庫存會自動跟著變
 * 所有數量都用基本單位：cc（ml）、g（g／kg）、片。
 */

export type MoveKind = StockKind | "spraying" | "fertilizing" | "bagging" | "bagReturn";

export const MOVE_LABEL: Record<MoveKind, string> = {
  purchase: "進貨",
  count: "盤點",
  scrap: "報廢",
  spraying: "噴藥",
  fertilizing: "施肥",
  bagging: "套袋領用",
  bagReturn: "套袋結餘",
};

/** 使用量（自動扣帳）的種類 */
const USAGE: MoveKind[] = ["spraying", "fertilizing", "bagging", "bagReturn"];

export interface Move {
  key: string;
  materialId: string;
  kind: MoveKind;
  datetime: string;
  /** 盤點＝實際數量；其他＝增減（基本單位，扣帳為負） */
  qty: number;
  /** 這筆造成的增減（盤點算出差額後才有） */
  delta: number;
  /** 這筆之後的庫存 */
  balance: number;
  /** 還沒發生（排定在未來的紀錄），不算進目前庫存 */
  future: boolean;
  /** 在第一次盤點／進貨之前（還沒開始記庫存），不算進目前庫存 */
  before: boolean;
  label: string;
  href?: string;
  txn?: StockTxn;
}

export interface Batch {
  txn: StockTxn;
  remaining: number;
  days: number; // 距離有效期限幾天（負數＝已過期；沒有期限＝Infinity）
}

export interface StockInfo {
  m: Material;
  onHand: number;
  moves: Move[]; // 依時間由舊到新
  planned: number; // 未來排定的用量
  usage90: number; // 近 90 天用量
  daysLeft: number | null; // 依近 90 天用量推算還能用幾天
  value: number;
  minBase: number; // 安全存量（基本單位）
  /** untracked＝還沒有任何盤點／進貨，不知道實際數量 */
  status: "untracked" | "negative" | "low" | "ok" | "unset";
  batches: Batch[]; // 還有剩的進貨批次（依有效期限排序）
  expiring: Batch[]; // 60 天內到期或已過期
}

export const EXPIRY_WARN_DAYS = 60;

export const baseFactor = (m: Material) => (m.unit === "kg" ? 1000 : 1);
export const baseUnit = (m: Material) => (m.unit === "ml" ? "cc" : m.unit === "kg" ? "g" : m.unit);
/** 每瓶／包（基本單位） */
export const packSize = materialBase;
export const packWord = (m: Material) => (m.unit === "ml" ? "瓶" : m.bagType ? "箱" : "包");

const round = (n: number) => Math.round(n * 100) / 100;

/** 3400 cc → 「3 瓶 400 cc」 */
export function fmtQty(m: Material, q: number) {
  const sign = q < 0 ? "−" : "";
  const abs = Math.abs(round(q));
  const ps = packSize(m);
  // 以公斤計的資材，零頭也用 kg 顯示（內部仍是 g）
  const loose = (n: number) =>
    m.unit === "kg" ? `${(Math.round(n) / 1000).toLocaleString()} kg` : `${n.toLocaleString()} ${baseUnit(m)}`;
  if (!ps) return `${sign}${loose(abs)}`;
  const packs = Math.floor(abs / ps + 1e-9);
  const rest = round(abs - packs * ps);
  if (!packs) return `${sign}${loose(rest)}`;
  return `${sign}${packs.toLocaleString()} ${packWord(m)}${rest ? ` ${loose(rest)}` : ""}`;
}

/** 依時間排序；同一時間點，盤點排在最後（盤點的是做完其他事之後的數量） */
const byTime = (a: Move, b: Move) =>
  a.datetime.localeCompare(b.datetime) || Number(a.kind === "count") - Number(b.kind === "count");

/** 從所有資料整理出每一項資材的異動 */
function collectMoves(db: DB) {
  const map = new Map<string, Move[]>();
  const mat = new Map(db.materials.map((m) => [m.id, m]));
  const orchard = (id: string) => orchardLabel(db.orchards.find((o) => o.id === id));
  const add = (mv: Omit<Move, "delta" | "balance" | "future" | "before">) => {
    // 盤點數量是 0 也要算（代表用完了）
    if (!mat.has(mv.materialId) || (!mv.qty && mv.kind !== "count")) return;
    if (!map.has(mv.materialId)) map.set(mv.materialId, []);
    map.get(mv.materialId)!.push({ ...mv, delta: 0, balance: 0, future: false, before: false });
  };

  for (const t of db.stock) {
    const qty = t.kind === "scrap" ? -t.qty : t.qty;
    add({ key: t.id, materialId: t.materialId, kind: t.kind, datetime: t.datetime, qty, label: t.note, txn: t });
  }

  for (const r of db.spraying) {
    for (const it of r.items) {
      add({
        key: `${r.id}-${it.id}`, materialId: it.materialId, kind: "spraying", datetime: r.datetime, qty: -it.amount,
        label: orchard(r.orchardId), href: "/records/spraying",
      });
    }
  }

  for (const r of db.fertilizing) {
    for (const it of r.items) {
      const m = mat.get(it.materialId);
      if (!m) continue;
      // 整體用量是 L／kg，基本單位是 cc／g
      add({
        key: `${r.id}-${it.id}`, materialId: it.materialId, kind: "fertilizing", datetime: r.datetime,
        qty: -it.amount * 1000, label: `${orchard(r.orchardId)}・${it.amount} ${fertUnit(m)}`, href: "/records/fertilizing",
      });
    }
  }

  // 套袋：紙袋類型對應到設定了 bagType 的包材
  const bagMaterial = (type: string) => db.materials.find((m) => m.category === "packaging" && m.bagType === type);
  for (const r of db.bagging) {
    const sections = [
      { name: "自己員工", boxes: r.ownBoxes, remaining: r.ownRemainingBags },
      { name: "外請工人", boxes: r.externalBoxes, remaining: r.externalRemainingBags },
    ];
    for (const s of sections) {
      const bags = new Map<string, number>();
      for (const b of s.boxes) {
        const m = bagMaterial(b.type);
        const n = b.boxes * bagsPerBox(b.type);
        bags.set(b.type, (bags.get(b.type) ?? 0) + n);
        if (!m) continue;
        add({
          key: `${r.id}-${b.id}`, materialId: m.id, kind: "bagging", datetime: `${b.date || r.start}T00:00`, qty: -n,
          label: `${orchard(r.orchardId)}・${s.name}・${b.boxes} 箱`, href: "/records/bagging",
        });
      }
      // 結餘袋數沒有分類型，算回領用最多的那一種
      const main = [...bags.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
      const m = main ? bagMaterial(main) : undefined;
      if (m && s.remaining > 0) {
        add({
          key: `${r.id}-${s.name}-return`, materialId: m.id, kind: "bagReturn", datetime: `${r.end || r.start}T23:59`,
          qty: s.remaining, label: `${orchard(r.orchardId)}・${s.name}・結餘 ${s.remaining.toLocaleString()} 袋`,
          href: "/records/bagging",
        });
      }
    }
  }
  return map;
}

/** 每一項資材目前的庫存狀況 */
export function stockInfo(db: DB): Map<string, StockInfo> {
  const all = collectMoves(db);
  const now = nowStr();
  const since = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
  const result = new Map<string, StockInfo>();

  for (const m of db.materials) {
    const moves = (all.get(m.id) ?? []).sort(byTime);
    // 從第一次盤點或進貨開始記庫存；之前的用量（例如舊的噴藥紀錄）不扣，否則一開始就是負數
    const start = moves.find((mv) => mv.txn && !(mv.datetime > now));
    let balance = 0;
    let planned = 0;
    for (const mv of moves) {
      mv.future = mv.datetime > now;
      mv.before = !mv.future && (!start || byTime(mv, start) < 0);
      if (mv.before) {
        mv.delta = mv.qty;
        continue;
      }
      if (mv.future) {
        if (mv.kind !== "count") planned -= mv.qty;
        mv.delta = mv.kind === "count" ? 0 : mv.qty;
        mv.balance = balance;
        continue;
      }
      mv.delta = mv.kind === "count" ? mv.qty - balance : mv.qty;
      balance = mv.kind === "count" ? mv.qty : balance + mv.qty;
      mv.balance = balance;
    }
    const onHand = round(balance);
    const usage90 = -moves
      .filter((mv) => !mv.future && USAGE.includes(mv.kind) && mv.datetime.slice(0, 10) >= since)
      .reduce((s, mv) => s + mv.delta, 0);
    const minBase = (m.minStock ?? 0) * packSize(m);

    // 先過期的先用：剩下的庫存算在有效期限最晚的批次
    let left = Math.max(0, onHand);
    const batches: Batch[] = [];
    const purchases = db.stock
      .filter((t) => t.materialId === m.id && t.kind === "purchase" && t.datetime <= now)
      .map((t) => ({ txn: t, remaining: 0, days: t.expiry ? daysUntil(t.expiry) : Infinity }))
      .sort((a, b) => b.days - a.days || b.txn.datetime.localeCompare(a.txn.datetime));
    for (const b of purchases) {
      if (left <= 0) break;
      b.remaining = Math.min(left, b.txn.qty);
      left -= b.remaining;
      batches.push(b);
    }
    batches.sort((a, b) => a.days - b.days);

    result.set(m.id, {
      m,
      onHand,
      moves,
      planned: round(planned),
      usage90: round(usage90),
      daysLeft: start && usage90 > 0 ?Math.max(0, Math.floor(onHand / (usage90 / 90))) : null,
      value: materialCost(m, Math.max(0, onHand)),
      minBase,
      status: !start ? "untracked" : onHand < 0 ? "negative" : !minBase ? "unset" : onHand < minBase ? "low" : "ok",
      batches,
      expiring: batches.filter((b) => b.days <= EXPIRY_WARN_DAYS),
    });
  }
  return result;
}

export const emptyTxn = (m: Material, kind: StockKind): StockTxn => ({
  id: "",
  materialId: m.id,
  category: m.category,
  kind,
  datetime: kind === "count" ? nowStr() : `${todayStr()}T08:00`,
  qty: 0,
  price: 0,
  expiry: "",
  batch: "",
  supplierId: kind === "purchase" ? m.supplierId : "",
  note: "",
});
