import { NextResponse } from "next/server";
import { HttpError, handleError } from "@/lib/api";
import { uploadImage } from "@/lib/blob";

// Vercel 伺服器上傳的 body 上限約 4.5MB；前端會先壓縮成 JPEG（約 100–300KB）
const MAX_BYTES = 4 * 1024 * 1024;

/**
 * POST /api/upload  (multipart/form-data)
 * 欄位：file（圖片）、folder（選填，例如 orchards、bills）
 * 回傳：{ url }，把這個網址存進 MongoDB 的照片欄位
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData().catch(() => {
      throw new HttpError(400, "請用 multipart/form-data 上傳");
    });
    const file = form.get("file");
    if (!(file instanceof Blob)) throw new HttpError(400, "缺少 file 欄位");
    if (!file.type.startsWith("image/")) throw new HttpError(400, "只能上傳圖片");
    if (file.size > MAX_BYTES) throw new HttpError(413, "照片太大（上限 4MB）");

    const folder = String(form.get("folder") ?? "photos").replace(/[^a-z0-9-]/gi, "") || "photos";
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const url = await uploadImage(file, folder, `${new Date().toISOString().slice(0, 10)}.${ext}`);
    return NextResponse.json({ url }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
