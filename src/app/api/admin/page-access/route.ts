import { NextResponse, type NextRequest } from "next/server";
import { handleError, readJson } from "@/lib/api";
import { getPageAccess, savePageAccess } from "@/lib/access";
import { requireAdmin } from "@/lib/auth";
import { assertCode, readCode } from "@/lib/codes";

/** GET /api/admin/page-access → { allowed, users[] }：一般使用者可以看的頁面與各帳號另外隱藏的頁面 */
export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await getPageAccess());
  } catch (err) {
    return handleError(err);
  }
}

/** PUT /api/admin/page-access { allowed: PageKey[], hidden: { 帳號 id: PageKey[] } }（後台驗證碼 ADMIN_CODE 或解鎖期間） */
export async function PUT(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    assertCode("admin", "update", await readCode(req.headers, admin.id));
    return NextResponse.json(await savePageAccess(await readJson(req)));
  } catch (err) {
    return handleError(err);
  }
}
