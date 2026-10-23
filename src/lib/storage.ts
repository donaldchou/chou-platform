import { randomBytes } from "node:crypto";
import { TrashModel } from "@/models/trash";
import { HttpError } from "./api";
import { COLLECTIONS } from "./collections";
import { LL3_PREFIX, isLl3Url, ll3Delete, ll3Get, ll3List } from "./ll3";
import { connectDB } from "./mongodb";

/** 照片與檔案都存在 ll3 主機，MongoDB 存 "ll3:<folder>/<name>" */
export const isStoredUrl = isLl3Url;

/** 可以上傳的副檔名與 Content-Type（要跟 file_api.asp 的 ContentTypeOf 一致） */
export const FILE_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  csv: "text/csv",
  txt: "text/plain",
  zip: "application/zip",
};

export const extOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

/** 新檔案在主機上的路徑：folder/日期-亂數.副檔名（原始檔名另外存在資料裡） */
export function newFilePath(folder: string, ext: string) {
  const d = new Date(Date.now() + 8 * 3600_000).toISOString().slice(0, 10).replace(/-/g, "");
  return `${folder}/${d}-${randomBytes(6).toString("hex")}.${ext}`;
}

/** 讀檔，給 /api/photo、/api/file 使用 */
export async function readStored(url: string, range?: { offset: number; length: number }) {
  if (!isLl3Url(url)) throw new HttpError(400, "不是這個平台的檔案網址");
  const path = url.slice(LL3_PREFIX.length);
  const res = await ll3Get(path, range);
  return {
    body: res.body!,
    contentType: FILE_TYPES[extOf(path)] ?? "application/octet-stream",
    length: Number(res.headers.get("content-length") ?? 0),
    total: Number(res.headers.get("x-file-size") ?? 0),
  };
}

/** 找出資料中所有照片／檔案網址（包含巢狀欄位，例如 contract.photos、contract.files[].url） */
export function collectFileUrls(value: unknown, out = new Set<string>()): Set<string> {
  if (isStoredUrl(value)) out.add(value);
  else if (Array.isArray(value)) value.forEach((v) => collectFileUrls(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectFileUrls(v, out));
  return out;
}

/** 刪除不再使用的照片／檔案。失敗只記錄，不影響資料庫操作；回傳刪除失敗的數量。 */
export async function deleteFiles(urls: Iterable<string>) {
  const list = [...urls];
  if (!list.length) return 0;
  const results = await Promise.allSettled(list.map((u) => ll3Delete(u.slice(LL3_PREFIX.length))));
  const failed = results.filter((r) => r.status === "rejected");
  for (const r of failed) console.warn("刪除檔案失敗：", r.reason);
  return failed.length;
}

/**
 * 已儲存的資料用到的所有照片／檔案網址。資料量小，直接掃全部集合（照片欄位很多、又有巢狀），
 * 包含已刪除紀錄（trash）——那些照片要等永久刪除時才刪。
 */
async function referencedFiles() {
  await connectDB();
  const used = new Set<string>();
  for (const model of [...Object.values(COLLECTIONS), TrashModel]) collectFileUrls(await model.find().lean(), used);
  return used;
}

/** 已儲存的資料是否用到這個檔案 */
export async function isFileReferenced(url: string) {
  return (await referencedFiles()).has(url);
}

/** 上傳後這麼久還沒被資料用到，才算「未使用」（避免刪到還在填寫中的表單剛上傳的檔案） */
export const UNUSED_AFTER_HOURS = 24;

export type HostFile = { url: string; size: number; time: string; used: boolean; recent: boolean };

/** 比對 ll3 主機上的檔案和資料庫：先列主機再查資料庫，列出之後才存進資料的檔案也會算使用中 */
export async function scanFiles(): Promise<HostFile[]> {
  const files = await ll3List();
  const used = await referencedFiles();
  const limit = Date.now() / 1000 - UNUSED_AFTER_HOURS * 3600;
  return files.map((f) => ({
    url: LL3_PREFIX + f.p,
    size: f.size,
    time: new Date(f.t * 1000).toISOString(),
    used: used.has(LL3_PREFIX + f.p),
    recent: f.t > limit,
  }));
}

/** 拒絕 base64 照片，確保 MongoDB 只存網址 */
export function assertNoInlineImages(value: unknown): void {
  if (typeof value === "string" && value.startsWith("data:")) {
    throw new HttpError(400, "照片必須先上傳到 /api/upload，資料中只能存網址");
  }
  if (Array.isArray(value)) value.forEach(assertNoInlineImages);
  else if (value && typeof value === "object") Object.values(value).forEach(assertNoInlineImages);
}
