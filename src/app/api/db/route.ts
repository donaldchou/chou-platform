import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { pagesFor } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { COLLECTION_PAGES } from "@/lib/page-access";
import { loadAll } from "@/lib/repo";

/** GET /api/db 一次取得所有資料，前端啟動時使用；一般使用者只拿得到看得到的頁面要用的資料 */
export async function GET() {
  try {
    const user = await requireUser();
    const pages = await pagesFor(user);
    const all = await loadAll();
    for (const [name, need] of Object.entries(COLLECTION_PAGES)) {
      if (need && !need.some((p) => pages.includes(p))) (all as unknown as Record<string, unknown[]>)[name] = [];
    }
    return NextResponse.json(all);
  } catch (err) {
    return handleError(err);
  }
}
