import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { requireUser } from "@/lib/auth";

/** GET /api/auth/me 目前登入的使用者（沒登入回 401） */
export async function GET() {
  try {
    return NextResponse.json(await requireUser());
  } catch (err) {
    return handleError(err);
  }
}
