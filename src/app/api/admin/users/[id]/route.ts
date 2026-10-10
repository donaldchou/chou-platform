import { NextResponse, type NextRequest } from "next/server";
import { HttpError, handleError, readJson } from "@/lib/api";
import { assertPassword, hashPassword, publicUser, requireAdmin } from "@/lib/auth";
import { assertCode, readCode } from "@/lib/codes";
import { USER_ROLES, UserModel } from "@/models/user";

/** 新增、修改、刪除使用者都需要後台驗證碼（ADMIN_CODE，header x-verify-code 或後台解鎖期間） */

type Ctx = RouteContext<"/api/admin/users/[id]">;

/** 自己不能把自己降級、停用或刪除，避免把唯一的管理者鎖在外面 */
function assertNotSelf(adminId: string, id: string, what: string) {
  if (adminId === id) throw new HttpError(400, `不能${what}自己的帳號`);
}

/** PATCH /api/admin/users/<id> { name?, role?, active?, password? } */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    const admin = await requireAdmin();
    assertCode("admin", "update", await readCode(req.headers, admin.id));
    const { id } = await ctx.params;
    const body = await readJson(req);
    const user = await UserModel.findById(id);
    if (!user) throw new HttpError(404, "找不到這個使用者");

    const set: Record<string, unknown> = {};
    if (body.name !== undefined) set.name = String(body.name);
    if (body.role !== undefined) {
      if (!USER_ROLES.includes(body.role as never)) throw new HttpError(400, "身分只能是管理者或一般使用者");
      if (body.role !== "admin") assertNotSelf(admin.id, id, "降級");
      set.role = body.role;
    }
    if (body.active !== undefined) {
      if (!body.active) assertNotSelf(admin.id, id, "停用");
      set.active = !!body.active;
    }
    if (body.password !== undefined) {
      assertPassword(body.password);
      set.passwordHash = await hashPassword(body.password);
    }
    user.set(set);
    await user.save();
    return NextResponse.json(publicUser(user.toObject()));
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/admin/users/<id> */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const admin = await requireAdmin();
    assertCode("admin", "delete", await readCode(req.headers, admin.id));
    const { id } = await ctx.params;
    assertNotSelf(admin.id, id, "刪除");
    const res = await UserModel.deleteOne({ _id: id });
    if (!res.deletedCount) throw new HttpError(404, "找不到這個使用者");
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
