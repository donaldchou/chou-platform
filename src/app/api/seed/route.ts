import { NextResponse } from "next/server";
import { HttpError, handleError, readJson } from "@/lib/api";
import { loadAll, resetAll } from "@/lib/repo";
import { seedDB } from "@/lib/seed";

/**
 * POST /api/seed  body: { "confirm": "RESET" }
 * 清空所有資料並寫入示範資料。會刪除資料庫內容，所以必須帶確認字串。
 */
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    if (body.confirm !== "RESET") throw new HttpError(400, '請在 body 帶 { "confirm": "RESET" } 確認');
    await resetAll(seedDB());
    return NextResponse.json(await loadAll());
  } catch (err) {
    return handleError(err);
  }
}
