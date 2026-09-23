import type { NextRequest } from "next/server";
import { HttpError, handleError } from "@/lib/api";
import { readImage } from "@/lib/blob";

/**
 * GET /api/photo?url=<Blob 檔案網址>
 * Blob store 是 private，瀏覽器不能直接開啟照片網址，由這裡用 token 讀取後回傳。
 */
export async function GET(req: NextRequest) {
  try {
    const url = req.nextUrl.searchParams.get("url");
    if (!url) throw new HttpError(400, "缺少 url");
    const { stream, blob } = await readImage(url);
    return new Response(stream, {
      headers: {
        "Content-Type": blob.contentType,
        "Content-Length": String(blob.size),
        // 檔名含隨機碼，內容不會改變，可以長期快取在瀏覽器（private：不讓 CDN 共用）
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
