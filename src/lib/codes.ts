import { timingSafeEqual } from "node:crypto";
import { HttpError } from "./api";

export type CodeAction = "create" | "update" | "delete";
type Doc = Record<string, unknown> | null | undefined;

type Rule = {
  env: string; // 驗證碼存放的環境變數
  actions: CodeAction[];
  /** 只有符合條件的資料才需要驗證碼；沒寫就是整個集合都需要 */
  applies?: (doc: Record<string, unknown>) => boolean;
};

/** 需要驗證碼的操作 */
const RULES: Partial<Record<string, Rule[]>> = {
  suppliers: [{ env: "SUPPLIER_CODE", actions: ["create", "update", "delete"] }],
  materials: [
    {
      env: "FERTILIZER_CODE",
      actions: ["create", "update", "delete"],
      applies: (doc) => doc.category === "fertilizer",
    },
  ],
};

export const CODE_HEADER = "x-verify-code";

const ACTION_LABEL: Record<CodeAction, string> = { create: "新增", update: "修改", delete: "刪除" };

/**
 * 找出這次操作要檢查的規則。docs 是相關的資料：
 * 新增 → [新資料]；修改 → [原本的資料, 新資料]（例如農藥改成肥料也要驗證）；刪除 → [原本的資料]
 */
function ruleFor(collection: string, action: CodeAction, docs: Doc[]) {
  return RULES[collection]?.find(
    (r) => r.actions.includes(action) && (!r.applies || docs.some((d) => d && r.applies!(d))),
  );
}

export const needsCode = (collection: string, action: CodeAction, docs: Doc[] = []) =>
  !!ruleFor(collection, action, docs);

/** 從 header 取出驗證碼（前端用 encodeURIComponent 送出，避免中文無法放進 header） */
export function codeFromHeaders(headers: Headers) {
  try {
    return decodeURIComponent(headers.get(CODE_HEADER) ?? "");
  } catch {
    return "";
  }
}

/** 需要驗證碼而且驗證碼錯誤時丟出 403 */
export function assertCode(collection: string, action: CodeAction, given: string, docs: Doc[] = []) {
  const rule = ruleFor(collection, action, docs);
  if (!rule) return;
  const expected = process.env[rule.env];
  if (!expected) throw new HttpError(500, `伺服器尚未設定 ${rule.env}`);
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new HttpError(403, `驗證碼錯誤，無法${ACTION_LABEL[action]}`);
  }
}
