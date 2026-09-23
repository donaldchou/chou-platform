import { NextResponse } from "next/server";
import { HttpError, handleError, readJson } from "@/lib/api";
import { assertCode, needsCode, type CodeAction } from "@/lib/codes";

/**
 * POST /api/verify-code  body: { collection, action: "create" | "update" | "delete", code, category? }
 * 只檢查驗證碼、不做任何修改，讓畫面在打開新增／編輯表單前先確認。
 * 真正新增／修改／刪除時後端還會再檢查一次。
 */
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const collection = String(body.collection ?? "");
    const action = body.action as CodeAction;
    if (!["create", "update", "delete"].includes(action)) throw new HttpError(400, "action 必須是 create、update 或 delete");
    // 資材要帶 category（例如 fertilizer），才知道是否需要驗證碼
    const docs = body.category ? [{ category: body.category }] : [];
    if (!needsCode(collection, action, docs)) return NextResponse.json({ ok: true, required: false });
    assertCode(collection, action, String(body.code ?? ""), docs);
    return NextResponse.json({ ok: true, required: true });
  } catch (err) {
    return handleError(err);
  }
}
