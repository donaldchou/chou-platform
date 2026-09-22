import { NextResponse, type NextRequest } from "next/server";
import { HttpError, handleError, readJson } from "@/lib/api";
import { isCollection } from "@/lib/collections";
import { createDoc, listDocs } from "@/lib/repo";

async function collectionOf(ctx: RouteContext<"/api/[collection]">) {
  const { collection } = await ctx.params;
  if (!isCollection(collection)) throw new HttpError(404, `沒有 ${collection} 這個資料集合`);
  return collection;
}

/** GET /api/<collection>?欄位=值&from=&to= 取得列表 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/[collection]">) {
  try {
    const name = await collectionOf(ctx);
    return NextResponse.json(await listDocs(name, req.nextUrl.searchParams));
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/<collection> 新增一筆 */
export async function POST(req: NextRequest, ctx: RouteContext<"/api/[collection]">) {
  try {
    const name = await collectionOf(ctx);
    return NextResponse.json(await createDoc(name, await readJson(req)), { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
