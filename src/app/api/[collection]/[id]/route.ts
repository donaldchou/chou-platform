import { NextResponse, type NextRequest } from "next/server";
import { HttpError, handleError, readJson } from "@/lib/api";
import { requireAdmin, requireUser } from "@/lib/auth";
import { assertCode, readCode } from "@/lib/codes";
import { isCollection } from "@/lib/collections";
import { deleteDoc, getDoc, saveDoc } from "@/lib/repo";

type Ctx = RouteContext<"/api/[collection]/[id]">;

async function paramsOf(ctx: Ctx) {
  const { collection, id } = await ctx.params;
  if (!isCollection(collection)) throw new HttpError(404, `沒有 ${collection} 這個資料集合`);
  return { name: collection, id };
}

/** GET /api/<collection>/<id> */
export async function GET(_req: NextRequest, ctx: Ctx) {
  try {
    await requireUser();
    const { name, id } = await paramsOf(ctx);
    return NextResponse.json(await getDoc(name, id));
  } catch (err) {
    return handleError(err);
  }
}

/** PUT /api/<collection>/<id> 整筆儲存（不存在時建立；貨源店家、肥料要帶 x-verify-code） */
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireAdmin();
    const { name, id } = await paramsOf(ctx);
    const code = await readCode(req.headers, user.id);
    const { doc, created } = await saveDoc(name, id, await readJson(req), {
      beforeCreate: (data) => assertCode(name, "create", code, [data]),
      beforeUpdate: (existing, data) => assertCode(name, "update", code, [existing, data]),
    });
    return NextResponse.json(doc, { status: created ? 201 : 200 });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/<collection>/<id>?cascade=true（貨源店家、肥料要帶 x-verify-code） */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const user = await requireAdmin();
    const { name, id } = await paramsOf(ctx);
    const code = await readCode(req.headers, user.id);
    await deleteDoc(name, id, req.nextUrl.searchParams.get("cascade") === "true", {
      beforeDelete: (existing) => assertCode(name, "delete", code, [existing]),
    });
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
