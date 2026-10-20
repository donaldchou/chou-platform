import type { Model } from "mongoose";
import { connectDB } from "./mongodb";
import { COLLECTIONS, FILTERS, ORCHARD_CHILDREN, SORT, type CollectionName } from "./collections";
import { HttpError, fromClient, toClient } from "./api";
import { todayStr, uid } from "./utils";
import { assertNoInlineImages, collectBlobUrls, deleteBlobs } from "./blob";
import type { DB } from "./types";
import { OrchardModel } from "@/models/orchard";
import { EmployeeModel } from "@/models/people";
import { MaterialModel, StockModel } from "@/models/supply";
import { TRASH_COLLECTIONS, TrashModel, type TrashCollection } from "@/models/trash";
import { onlyChanged } from "./codes";

type Data = Record<string, unknown>;

/** 寫入前確認關聯的果園／員工存在 */
const REFS: Partial<Record<CollectionName, { field: string; model: Model<unknown>; label: string }[]>> = {
  ...Object.fromEntries(
    ORCHARD_CHILDREN.map((c) => [c, [{ field: "orchardId", model: OrchardModel, label: "果園" }]]),
  ),
  tasks: [
    { field: "orchardId", model: OrchardModel, label: "果園" },
    { field: "employeeId", model: EmployeeModel, label: "員工" },
  ],
  salaries: [{ field: "employeeId", model: EmployeeModel, label: "員工" }],
  bonuses: [{ field: "employeeId", model: EmployeeModel, label: "員工" }],
  stock: [{ field: "materialId", model: MaterialModel, label: "資材" }],
};

async function checkRefs(name: CollectionName, data: Data) {
  for (const ref of REFS[name] ?? []) {
    const value = data[ref.field];
    if (typeof value === "string" && value && !(await ref.model.exists({ _id: value }))) {
      throw new HttpError(400, `找不到${ref.label}（${value}）`);
    }
  }
  // 庫存異動的類別一律跟資材相同（驗證碼依類別決定，不能由前端指定）
  if (name === "stock") {
    const m = (await MaterialModel.findById(data.materialId).lean()) as Data | null;
    if (m) data.category = m.category;
  }
}

/** 資材：自動維護登入／異動時間，價格變動時保留舊價格 */
function applyMaterialRules(data: Data, existing: Data | null) {
  const today = todayStr();
  if (!existing) {
    data.createdAt = data.createdAt || today;
    data.updatedAt = today;
    data.priceHistory = data.priceHistory ?? [];
    return;
  }
  data.createdAt = existing.createdAt;
  // 只在庫存頁改安全存量，不算資材資訊異動（只比較前端有送的欄位：舊資料缺的欄位會被補成預設值）
  const sent = Object.fromEntries(Object.keys(data).map((k) => [k, existing[k]]));
  data.updatedAt = onlyChanged(sent, data, ["minStock"]) ? existing.updatedAt : today;
  const history = (existing.priceHistory as { date: string; price: number }[]) ?? [];
  // 原價格是 0（通常是新增時還沒填價格）就不記錄，避免出現「前次 NT$ 0」
  const oldPrice = Number(existing.price);
  data.priceHistory =
    Number(data.price) !== oldPrice && oldPrice > 0
      ? [...history, { date: existing.updatedAt, price: oldPrice }]
      : history;
}

export async function listDocs(name: CollectionName, params: URLSearchParams) {
  await connectDB();
  const query: Data = {};
  for (const f of FILTERS[name] ?? []) {
    const v = params.get(f);
    if (v) query[f] = v;
  }
  // 日期區間篩選：?from=2026-01-01&to=2026-12-31（依各集合的主要日期欄位）
  const dateField = Object.keys(SORT[name] ?? {})[0];
  const from = params.get("from");
  const to = params.get("to");
  if (dateField && (from || to)) {
    query[dateField] = { ...(from && { $gte: from }), ...(to && { $lte: to + "￿" }) };
  }
  const docs = await COLLECTIONS[name].find(query).sort(SORT[name] ?? {}).lean();
  return docs.map((d) => toClient(d));
}

export async function getDoc(name: CollectionName, id: string) {
  await connectDB();
  const doc = await COLLECTIONS[name].findById(id).lean();
  if (!doc) throw new HttpError(404, "找不到資料");
  return toClient(doc);
}

export async function createDoc(name: CollectionName, body: Data) {
  await connectDB();
  const Model = COLLECTIONS[name];
  const id = typeof body.id === "string" && body.id ? body.id : uid();
  if (await Model.exists({ _id: id })) throw new HttpError(409, "這個 id 已經存在");
  const data = fromClient(body);
  assertNoInlineImages(data);
  await checkRefs(name, data);
  if (name === "materials") applyMaterialRules(data, null);
  const doc = await Model.create({ ...data, _id: id });
  return toClient(doc.toObject());
}

/** PUT：存在就整筆覆寫，不存在就建立（前端的新增與編輯共用） */
export async function saveDoc(
  name: CollectionName,
  id: string,
  body: Data,
  opts: { beforeCreate?: (data: Data) => void; beforeUpdate?: (existing: Data, data: Data) => void } = {},
) {
  await connectDB();
  const Model = COLLECTIONS[name];
  const data = fromClient(body);
  assertNoInlineImages(data);
  await checkRefs(name, data);
  const doc = await Model.findById(id);
  if (name === "materials") applyMaterialRules(data, doc ? (doc.toObject() as Data) : null);
  if (!doc) {
    opts.beforeCreate?.(data); // 例如檢查新增用的驗證碼
    const created = await Model.create({ ...data, _id: id });
    return { doc: toClient(created.toObject()), created: true };
  }
  opts.beforeUpdate?.(doc.toObject() as Data, data); // 例如檢查修改用的驗證碼
  const before = collectBlobUrls(doc.toObject());
  doc.overwrite(data);
  await doc.save();
  // 刪掉這次編輯移除的照片
  const after = collectBlobUrls(data);
  await deleteBlobs([...before].filter((u) => !after.has(u)));
  return { doc: toClient(doc.toObject()), created: false };
}

const isTrashCollection = (name: string): name is TrashCollection => (TRASH_COLLECTIONS as readonly string[]).includes(name);

/**
 * 刪除。果園底下還有紀錄時回 409，帶 cascade=true 才會一併刪除。
 * 噴藥／施肥紀錄會先備份到 trash（照片也先保留），後台可以還原。
 */
export async function deleteDoc(
  name: CollectionName,
  id: string,
  cascade: boolean,
  opts: { beforeDelete?: (existing: Data) => void; deletedBy?: string } = {},
) {
  await connectDB();
  const Model = COLLECTIONS[name];
  const existing = await Model.findById(id).lean();
  if (!existing) throw new HttpError(404, "找不到資料");
  opts.beforeDelete?.(existing as Data); // 例如檢查刪除用的驗證碼
  const backup = isTrashCollection(name);
  if (backup) await TrashModel.create({ collectionName: name, docId: id, data: existing, deletedBy: opts.deletedBy ?? "" });
  const photos = backup ? new Set<string>() : collectBlobUrls(existing);

  if (name === "orchards") {
    const counts = Object.fromEntries(
      await Promise.all(
        ORCHARD_CHILDREN.map(async (c) => [c, await COLLECTIONS[c].countDocuments({ orchardId: id })] as const),
      ),
    );
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    if (total > 0 && !cascade) {
      throw new HttpError(409, `這個果園還有 ${total} 筆相關紀錄，確定要一併刪除嗎？`, {
        needsCascade: true,
        counts,
      });
    }
    for (const c of ORCHARD_CHILDREN) {
      collectBlobUrls(await COLLECTIONS[c].find({ orchardId: id }).lean(), photos);
    }
    await Promise.all(ORCHARD_CHILDREN.map((c) => COLLECTIONS[c].deleteMany({ orchardId: id })));
  }
  // 資材刪掉後，它的進貨／盤點／報廢紀錄也沒有意義了
  if (name === "materials") await StockModel.deleteMany({ materialId: id });

  await Model.deleteOne({ _id: id });
  await deleteBlobs(photos);
}

/* ---------------- 已刪除紀錄（trash） ---------------- */

/** 已刪除的噴藥／施肥紀錄，最近刪除的在前 */
export async function listTrash() {
  await connectDB();
  const docs = (await TrashModel.find().sort({ deletedAt: -1 }).lean()) as Data[];
  return docs.map((d) => ({ ...toClient(d), data: toClient(d.data) }));
}

async function findTrash(id: string) {
  const t = (await TrashModel.findById(id).lean()) as (Data & { collectionName: TrashCollection; docId: string; data: Data }) | null;
  if (!t) throw new HttpError(404, "找不到這筆已刪除的紀錄");
  return t;
}

/** 還原：原樣寫回原本的集合（id 不變），成功後移除備份 */
export async function restoreTrash(id: string) {
  await connectDB();
  const t = await findTrash(id);
  const Model = COLLECTIONS[t.collectionName];
  if (await Model.exists({ _id: t.docId })) throw new HttpError(409, "這筆紀錄已經存在，不需要還原");
  const data = fromClient(t.data);
  await checkRefs(t.collectionName, data); // 果園被刪掉時無法還原
  await Model.create({ ...data, _id: t.docId });
  await TrashModel.deleteOne({ _id: id });
}

/** 永久刪除備份，這時才刪掉照片 */
export async function purgeTrash(id: string) {
  await connectDB();
  const t = await findTrash(id);
  await TrashModel.deleteOne({ _id: id });
  await deleteBlobs(collectBlobUrls(t.data));
}

/** 一次取得全部資料（前端啟動時載入） */
export async function loadAll(): Promise<DB> {
  await connectDB();
  const entries = await Promise.all(
    (Object.keys(COLLECTIONS) as CollectionName[]).map(async (name) => {
      const docs = await COLLECTIONS[name].find().sort(SORT[name] ?? {}).lean();
      return [name, docs.map((d) => toClient(d))] as const;
    }),
  );
  return Object.fromEntries(entries) as unknown as DB;
}
