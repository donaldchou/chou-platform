import { timingSafeEqual } from "node:crypto";
import { HttpError } from "./api";

export type CodeAction = "create" | "update" | "delete";

/** 需要驗證碼的操作：集合 → 驗證碼的環境變數與需要保護的動作 */
const PROTECTED: Partial<Record<string, { env: string; actions: CodeAction[] }>> = {
  suppliers: { env: "SUPPLIER_CODE", actions: ["create", "update", "delete"] },
};

export const CODE_HEADER = "x-verify-code";

const ACTION_LABEL: Record<CodeAction, string> = { create: "新增", update: "修改", delete: "刪除" };

export const needsCode = (collection: string, action: CodeAction) =>
  PROTECTED[collection]?.actions.includes(action) ?? false;

/** 從 header 取出驗證碼（前端用 encodeURIComponent 送出，避免中文無法放進 header） */
export function codeFromHeaders(headers: Headers) {
  try {
    return decodeURIComponent(headers.get(CODE_HEADER) ?? "");
  } catch {
    return "";
  }
}

/** 驗證碼錯誤時丟出 403 */
export function assertCode(collection: string, action: CodeAction, given: string) {
  const rule = PROTECTED[collection];
  if (!rule?.actions.includes(action)) return;
  const expected = process.env[rule.env];
  if (!expected) throw new HttpError(500, `伺服器尚未設定 ${rule.env}`);
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HttpError(403, `驗證碼錯誤，無法${ACTION_LABEL[action]}`);
  }
}
