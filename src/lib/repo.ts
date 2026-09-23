import type { Model } from "mongoose";
import { connectDB } from "./mongodb";
import { COLLECTIONS, FILTERS, ORCHARD_CHILDREN, SORT, type CollectionName } from "./collections";
import { HttpError, fromClient, toClient } from "./api";
import { todayStr, uid } from "./utils";
import { assertNoInlineImages, collectBlobUrls, deleteBlobs } from "./blob";
import type { DB } from "./types";
import { OrchardModel } from "@/models/orchard";
import { EmployeeModel } from "@/models/people";

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
};

async function checkRefs(name: CollectionName, data: Data) {
  for (const ref of REFS[name] ?? []) {
    const value = data[ref.field];
    if (typeof value === "string" && value && !(await ref.model.exists({ _id: value }))) {
      throw new HttpError(400, `找不到${ref.label}（${value}）`);
    }
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
  data.updatedAt = today;
  const history = (existing.priceHistory as { date: string; price: number }[]) ?? [];
  data.priceHistory =
    Number(data.price) !== Number(existing.price)
      ? [...history, { date: existing.updatedAt, price: existing.price }]
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
  opts: { beforeCreate?: () => void; beforeUpdate?: () => void } = {},
) {
  await connectDB();
  const Model = COLLECTIONS[name];
  const data = fromClient(body);
  assertNoInlineImages(data);
  await checkRefs(name, data);
  const doc = await Model.findById(id);
  if (name === "materials") applyMaterialRules(data, doc ? (doc.toObject() as Data) : null);
  if (!doc) {
    opts.beforeCreate?.(); // 例如檢查新增用的驗證碼
    const created = await Model.create({ ...data, _id: id });
    return { doc: toClient(created.toObject()), created: true };
  }
  opts.beforeUpdate?.(); // 例如檢查修改用的驗證碼
  const before = collectBlobUrls(doc.toObject());
  doc.overwrite(data);
  await doc.save();
  // 刪掉這次編輯移除的照片
  const after = collectBlobUrls(data);
  await deleteBlobs([...before].filter((u) => !after.has(u)));
  return { doc: toClient(doc.toObject()), created: false };
}

/** 刪除。果園底下還有紀錄時回 409，帶 cascade=true 才會一併刪除 */
export async function deleteDoc(name: CollectionName, id: string, cascade: boolean) {
  await connectDB();
  const Model = COLLECTIONS[name];
  const existing = await Model.findById(id).lean();
  if (!existing) throw new HttpError(404, "找不到資料");
  const photos = collectBlobUrls(existing);

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

  await Model.deleteOne({ _id: id });
  await deleteBlobs(photos);
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
