import { del, get } from "@vercel/blob";
import { HttpError } from "./api";

/**
 * 舊的 Vercel Blob 照片（private store）。新檔案都存到 ll3 主機（見 ll3.ts），
 * 這裡只保留讀取與刪除，等舊照片搬完（scripts/migrate-blob-to-ll3.mjs）就可以拿掉。
 */
const BLOB_URL = /^https:\/\/[a-z0-9-]+\.(public|private)\.blob\.vercel-storage\.com\/chou-platform\//i;

export const isBlobUrl = (v: unknown): v is string => typeof v === "string" && BLOB_URL.test(v);

function token() {
  const t = process.env.BLOB_READ_WRITE_TOKEN;
  if (!t) throw new Error("請在 .env.local 設定 BLOB_READ_WRITE_TOKEN");
  return t;
}

/** 讀取私人照片 */
export async function readBlob(url: string) {
  if (!isBlobUrl(url)) throw new HttpError(400, "不是這個平台的照片網址");
  const result = await get(url, { access: "private", token: token() });
  if (!result || result.statusCode !== 200) throw new HttpError(404, "找不到照片");
  return result;
}

export async function deleteBlobUrls(urls: string[]) {
  if (urls.length) await del(urls, { token: token() });
}
