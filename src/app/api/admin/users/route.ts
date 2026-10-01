import { NextResponse } from "next/server";
import { HttpError, handleError, readJson } from "@/lib/api";
import { assertPassword, hashPassword, publicUser, requireAdmin } from "@/lib/auth";
import { USER_ROLES, UserModel } from "@/models/user";

/** GET /api/admin/users 所有使用者（管理者在前） */
export async function GET() {
  try {
    await requireAdmin();
    const docs = await UserModel.find().sort({ role: 1, createdAt: 1 }).lean();
    return NextResponse.json(docs.map(publicUser));
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/admin/users { email, password, name?, role? } 新增使用者（預設一般使用者） */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const body = await readJson(req);
    const email = String(body.email ?? "").trim().toLowerCase();
    assertPassword(body.password);
    const role = body.role ?? "user";
    if (!USER_ROLES.includes(role as never)) throw new HttpError(400, "身分只能是管理者或一般使用者");
    if (await UserModel.exists({ email })) throw new HttpError(409, `${email} 已經有帳號了`);
    const doc = await UserModel.create({
      email,
      name: String(body.name ?? ""),
      role,
      passwordHash: await hashPassword(body.password),
    });
    return NextResponse.json(publicUser(doc.toObject()), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
