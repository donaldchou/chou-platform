import { NextResponse, type NextRequest } from "next/server";
import { HttpError, handleError, readJson } from "@/lib/api";
import { assertCode, codeFromHeaders } from "@/lib/codes";
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
    const { name, id } = await paramsOf(ctx);
    return NextResponse.json(await getDoc(name, id));
  } catch (err) {
    return handleError(err);
  }
}

/** PUT /api/<collection>/<id> 整筆儲存（不存在時建立；貨源店家新增／修改要帶 x-verify-code） */
export async function PUT(req: NextRequest, ctx: Ctx) {
  try {
    const { name, id } = await paramsOf(ctx);
    const { doc, created } = await saveDoc(name, id, await readJson(req), {
      beforeCreate: () => assertCode(name, "create", codeFromHeaders(req.headers)),
      beforeUpdate: () => assertCode(name, "update", codeFromHeaders(req.headers)),
    });
    return NextResponse.json(doc, { status: created ? 201 : 200 });
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/<collection>/<id>?cascade=true（貨源店家要帶 x-verify-code） */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    const { name, id } = await paramsOf(ctx);
    assertCode(name, "delete", codeFromHeaders(req.headers));
    await deleteDoc(name, id, req.nextUrl.searchParams.get("cascade") === "true");
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleError(err);
  }
}
