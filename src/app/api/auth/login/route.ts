import { NextResponse, type NextRequest } from "next/server";
import { HttpError, handleError, readJson } from "@/lib/api";
import { checkPassword, publicUser } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { sessionCookie, signSession } from "@/lib/session";
import { UserModel } from "@/models/user";

// 同一個 email 連續輸錯太多次就暫停一下，降低被猜密碼的機會（記在記憶體，重啟後歸零）
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const fails = new Map<string, { count: number; until: number }>();

/** POST /api/auth/login { email, password } → 設定登入 cookie */
export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!email || !password) throw new HttpError(400, "請輸入 email 和密碼");

    const f = fails.get(email);
    if (f && f.count >= MAX_FAILS && f.until > Date.now()) {
      throw new HttpError(429, "輸錯太多次，請 15 分鐘後再試");
    }

    await connectDB();
    const doc = await UserModel.findOne({ email }).lean<{ passwordHash: string; active: boolean }>();
    // 帳號不存在和密碼錯誤回同樣的訊息，不讓人試出哪些 email 有帳號
    if (!doc || !(await checkPassword(password, doc.passwordHash))) {
      const count = f && f.until > Date.now() ? f.count + 1 : 1;
      fails.set(email, { count, until: Date.now() + LOCK_MS });
      throw new HttpError(401, "email 或密碼錯誤");
    }
    if (!doc.active) throw new HttpError(403, "這個帳號已停用，請聯絡管理者");
    fails.delete(email);

    const user = publicUser(doc);
    await UserModel.updateOne({ _id: user.id }, { lastLoginAt: new Date() });
    const res = NextResponse.json(user);
    res.cookies.set(sessionCookie(await signSession({ userId: user.id, email: user.email, role: user.role })));
    return res;
  } catch (err) {
    return handleError(err);
  }
}
