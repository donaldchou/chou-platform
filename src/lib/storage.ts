import { randomBytes } from "node:crypto";
import { HttpError } from "./api";
import { LL3_PREFIX, isLl3Url, ll3Delete, ll3Get } from "./ll3";

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

/** 刪除不再使用的照片／檔案。失敗只記錄，不影響資料庫操作。 */
export async function deleteFiles(urls: Iterable<string>) {
  const list = [...urls];
  if (!list.length) return;
  const results = await Promise.allSettled(list.map((u) => ll3Delete(u.slice(LL3_PREFIX.length))));
  for (const r of results) if (r.status === "rejected") console.warn("刪除檔案失敗：", r.reason);
}

/** 拒絕 base64 照片，確保 MongoDB 只存網址 */
export function assertNoInlineImages(value: unknown): void {
  if (typeof value === "string" && value.startsWith("data:")) {
    throw new HttpError(400, "照片必須先上傳到 /api/upload，資料中只能存網址");
  }
  if (Array.isArray(value)) value.forEach(assertNoInlineImages);
  else if (value && typeof value === "object") Object.values(value).forEach(assertNoInlineImages);
}
