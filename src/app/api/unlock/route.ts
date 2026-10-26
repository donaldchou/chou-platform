import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { HttpError, handleError, readJson } from "@/lib/api";
import { requireAdmin, requireUser } from "@/lib/auth";
import { assertUnlockCode } from "@/lib/codes";
import { UNLOCK_COOKIE, UNLOCK_HOURS, signUnlock, unlockCookie, verifyUnlock } from "@/lib/session";

/**
 * 驗證碼解鎖：後台輸入一次驗證碼，選定的時數內（1–12 小時，預設 1）所有需要驗證碼的操作都不用再輸入。
 * 解鎖憑證存在 HttpOnly cookie，綁定目前登入的使用者；登出時一併清掉。
 */

/** GET /api/unlock → { expiresAt }：解鎖中回傳到期時間（毫秒），否則 null */
export async function GET() {
  try {
    const user = await requireUser();
    const expiresAt = await verifyUnlock((await cookies()).get(UNLOCK_COOKIE)?.value, user.id);
    return NextResponse.json({ expiresAt });
  } catch (err) {
    return handleError(err);
  }
}

/** POST /api/unlock  body: { code, hours? } 驗證碼正確就解鎖 hours 小時（預設 1，1–12） */
export async function POST(req: Request) {
  try {
    const user = await requireAdmin();
    const body = await readJson(req);
    const hours = Number(body.hours ?? UNLOCK_HOURS.default);
    if (!Number.isInteger(hours) || hours < UNLOCK_HOURS.min || hours > UNLOCK_HOURS.max) {
      throw new HttpError(400, `解鎖時數需為 ${UNLOCK_HOURS.min}–${UNLOCK_HOURS.max} 小時`);
    }
    assertUnlockCode(String(body.code ?? ""));
    const { token, expiresAt } = await signUnlock(user.id, hours);
    const res = NextResponse.json({ expiresAt });
    res.cookies.set(unlockCookie(token, hours));
    return res;
  } catch (err) {
    return handleError(err);
  }
}

/** DELETE /api/unlock 提前鎖定 */
export async function DELETE() {
  const res = new NextResponse(null, { status: 204 });
  res.cookies.delete(UNLOCK_COOKIE);
  return res;
}
