import { NextResponse, type NextRequest } from "next/server";
import { handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { assertCode, readCode } from "@/lib/codes";
import { purgeTrash, restoreTrash } from "@/lib/repo";

/** 還原、永久刪除都需要後台驗證碼（ADMIN_CODE，header x-verify-code 或後台解鎖期間） */

type Ctx = RouteContext<"/api/admin/trash/[id]">;

/** POST /api/admin/trash/<id> 還原到原本的噴藥／施肥紀錄 */
export async function POST(req: NextRequest, ctx: Ctx) {
  try {
    const admin = await requireAdmin();
    assertCode("admin", "create", await readCode(req.headers, admin.id));
    await restoreTrash((await ctx.params).id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/admin/trash/<id> 永久刪除備份（連同照片） */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const admin = await requireAdmin();
    assertCode("admin", "delete", await readCode(req.headers, admin.id));
    await purgeTrash((await ctx.params).id);
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
