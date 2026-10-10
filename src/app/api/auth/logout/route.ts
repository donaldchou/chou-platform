import { NextResponse } from "next/server";
import { SESSION_COOKIE, UNLOCK_COOKIE } from "@/lib/session";

/** POST /api/auth/logout 清掉登入 cookie（驗證碼解鎖也一起失效） */
export async function POST() {
  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(UNLOCK_COOKIE);
  return res;
}
