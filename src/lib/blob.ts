import { del, get, put } from "@vercel/blob";
import { HttpError } from "./api";

// 你的 Blob store 是 private：網址不能直接公開開啟，要經過 /api/photo 讀取
const BLOB_URL = /^https:\/\/[a-z0-9-]+\.(public|private)\.blob\.vercel-storage\.com\/chou-platform\//i;

export const isBlobUrl = (v: unknown): v is string => typeof v === "string" && BLOB_URL.test(v);

function token() {
  const t = process.env.BLOB_READ_WRITE_TOKEN;
  if (!t) throw new Error("請在 .env.local 設定 BLOB_READ_WRITE_TOKEN");
  return t;
}

/** 上傳照片到 Vercel Blob，回傳檔案網址（存進 MongoDB） */
export async function uploadImage(file: Blob, folder: string, name: string) {
  const blob = await put(`chou-platform/${folder}/${name}`, file, {
    access: "private",
    addRandomSuffix: true,
    contentType: file.type || "image/jpeg",
    token: token(),
  });
  return blob.url;
}

/** 讀取私人照片（給 /api/photo 使用） */
export async function readImage(url: string) {
  if (!isBlobUrl(url)) throw new HttpError(400, "不是這個平台的照片網址");
  const result = await get(url, { access: "private", token: token() });
  if (!result || result.statusCode !== 200) throw new HttpError(404, "找不到照片");
  return result;
}

/** 找出資料中所有 Blob 照片網址（包含巢狀欄位，例如 contract.photos） */
export function collectBlobUrls(value: unknown, out = new Set<string>()): Set<string> {
  if (isBlobUrl(value)) out.add(value);
  else if (Array.isArray(value)) value.forEach((v) => collectBlobUrls(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectBlobUrls(v, out));
  return out;
}

/** 刪除不再使用的照片。失敗只記錄，不影響資料庫操作。 */
export async function deleteBlobs(urls: Iterable<string>) {
  const list = [...urls];
  if (!list.length) return;
  try {
    await del(list, { token: token() });
  } catch (err) {
    console.warn("刪除 Blob 照片失敗：", err);
  }
}

/** 拒絕 base64 照片，確保 MongoDB 只存網址 */
export function assertNoInlineImages(value: unknown): void {
  if (typeof value === "string" && value.startsWith("data:")) {
    throw new HttpError(400, "照片必須先上傳到 /api/upload，資料中只能存網址");
  }
  if (Array.isArray(value)) value.forEach(assertNoInlineImages);
  else if (value && typeof value === "object") Object.values(value).forEach(assertNoInlineImages);
}
