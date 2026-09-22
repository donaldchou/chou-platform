import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

/** GET /api/health 檢查資料庫連線 */
export async function GET() {
  try {
    const conn = await connectDB();
    await conn.connection.db?.admin().ping();
    return NextResponse.json({ ok: true, db: conn.connection.name });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 503 },
    );
  }
}
