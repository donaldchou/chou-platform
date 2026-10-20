import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { listTrash } from "@/lib/repo";

/** GET /api/admin/trash 已刪除的噴藥／施肥紀錄（最近刪除的在前） */
export async function GET() {
  try {
    await requireAdmin();
    return NextResponse.json(await listTrash());
  } catch (err) {
    return handleError(err);
  }
}
