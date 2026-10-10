import { NextResponse } from "next/server";
import { HttpError, handleError, readJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { assertCode, needsCode, readCode, type CodeAction } from "@/lib/codes";

/**
 * POST /api/verify-code  body: { collection, action: "create" | "update" | "delete", code, category?, kind? }
 * 只檢查驗證碼、不做任何修改，讓畫面在打開新增／編輯表單前先確認。
 * 真正新增／修改／刪除時後端還會再檢查一次。
 */
export async function POST(req: Request) {
  try {
    const user = await requireAdmin(); // 一般使用者不能修改，也就不用試驗證碼
    const body = await readJson(req);
    const { unlocked } = await readCode(req.headers, user.id);
    const collection = String(body.collection ?? "");
    const action = body.action as CodeAction;
    if (!["create", "update", "delete"].includes(action)) throw new HttpError(400, "action 必須是 create、update 或 delete");
    // 資材要帶 category（例如 fertilizer）、剪枝要帶 kind，才知道是否需要驗證碼
    const docs = body.category || body.kind ? [{ category: body.category, kind: body.kind }] : [];
    if (!needsCode(collection, action, docs)) return NextResponse.json({ ok: true, required: false });
    assertCode(collection, action, { code: String(body.code ?? ""), unlocked }, docs);
    return NextResponse.json({ ok: true, required: true });
  } catch (err) {
    return handleError(err);
  }
}
