import { randomBytes } from "node:crypto";
import { HttpError } from "./api";
import { deleteBlobUrls, isBlobUrl, readBlob } from "./blob";
import { LL3_PREFIX, isLl3Url, ll3Delete, ll3Get } from "./ll3";

/**
 * 照片與檔案的存放位置：新的存在 ll3 主機（"ll3:<folder>/<name>"），
 * 舊的還在 Vercel Blob（https://...blob.vercel-storage.com/...）。兩種網址這裡都認得。
 */
export const isStoredUrl = (v: unknown): v is string => isBlobUrl(v) || isLl3Url(v);

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

/** 讀檔，給 /api/photo、/api/file 使用。range 只支援 ll3 的檔案 */
export async function readStored(url: string, range?: { offset: number; length: number }) {
  if (isLl3Url(url)) {
    const res = await ll3Get(url.slice(LL3_PREFIX.length), range);
    const path = url.slice(LL3_PREFIX.length);
    return {
      body: res.body!,
      contentType: FILE_TYPES[extOf(path)] ?? "application/octet-stream",
      length: Number(res.headers.get("content-length") ?? 0),
      total: Number(res.headers.get("x-file-size") ?? 0),
    };
  }
  if (isBlobUrl(url)) {
    const { stream, blob } = await readBlob(url);
    return { body: stream, contentType: blob.contentType, length: blob.size, total: blob.size };
  }
  throw new HttpError(400, "不是這個平台的檔案網址");
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
  const results = await Promise.allSettled([
    deleteBlobUrls(list.filter(isBlobUrl)),
    ...list.filter(isLl3Url).map((u) => ll3Delete(u.slice(LL3_PREFIX.length))),
  ]);
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
