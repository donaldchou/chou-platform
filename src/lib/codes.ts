import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { HttpError } from "./api";
import { UNLOCK_COOKIE, verifyUnlock } from "./session";

export type CodeAction = "create" | "update" | "delete";
type Doc = Record<string, unknown> | null | undefined;

type Rule = {
  env: string; // 驗證碼存放的環境變數
  actions: CodeAction[];
  /** 只有符合條件的資料才需要驗證碼；沒寫就是整個集合都需要 */
  applies?: (doc: Record<string, unknown>) => boolean;
  /** 修改時只動到這些欄位就不需要驗證碼 */
  freeFields?: string[];
};

/** 修改前後只有 fields 裡的欄位不同（updatedAt 等系統欄位不算） */
export function onlyChanged(before: Doc, after: Doc, fields: string[]) {
  if (!before || !after) return false;
  const skip = new Set([...fields, "_id", "id", "__v", "createdAt", "updatedAt"]);
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].every((k) => skip.has(k) || canon(before[k]) === canon(after[k]));
}

/** 不受欄位順序影響的 JSON（比較資料庫和前端送來的資料用） */
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

/** 農藥／肥料／包材各自的驗證碼，依資料的 category 決定 */
const MATERIAL_RULES: Rule[] = [
  {
    env: "FERTILIZER_CODE",
    actions: ["create", "update", "delete"],
    applies: (doc) => doc.category === "fertilizer",
  },
  {
    env: "PESTICIDE_CODE",
    actions: ["create", "update", "delete"],
    applies: (doc) => doc.category === "pesticide",
  },
  {
    env: "PACKAGING_CODE",
    actions: ["create", "update", "delete"],
    applies: (doc) => doc.category === "packaging",
  },
];

const STAFF_RULES: Rule[] = [{ env: "STAFF_CODE", actions: ["create", "update", "delete"] }];

/** 需要驗證碼的操作 */
const RULES: Partial<Record<string, Rule[]>> = {
  orchards: [
    {
      env: "ORCHARD_CODE",
      actions: ["create", "update", "delete"],
      // 水費頁面會直接改水塔管線照片
      freeFields: ["waterPipePhotos"],
    },
  ],
  suppliers: [{ env: "SUPPLIER_CODE", actions: ["create", "update", "delete"] }],
  spraying: [{ env: "SPRAYING_CODE", actions: ["create", "update", "delete"] }],
  fertilizing: [{ env: "FERTILIZING_CODE", actions: ["create", "update", "delete"] }],
  // 剪枝／開花／結果／疏果頁面共用一組驗證碼；labor 裡的砍草不需要
  labor: [{ env: "PRUNING_CODE", actions: ["create", "update", "delete"], applies: (doc) => doc.kind === "pruning" }],
  phenology: [{ env: "PRUNING_CODE", actions: ["create", "update", "delete"] }],
  propagation: [{ env: "PROPAGATION_CODE", actions: ["create", "update", "delete"] }],
  knowledge: [{ env: "KNOWLEDGE_CODE", actions: ["create", "update", "delete"] }],
  workers: [{ env: "WORKER_CODE", actions: ["create", "update", "delete"] }],
  // 員工管理／指派頁面：工作指派、薪水、分紅、員工名冊共用一組
  tasks: STAFF_RULES,
  salaries: STAFF_RULES,
  bonuses: STAFF_RULES,
  employees: STAFF_RULES,
  // 後台管理（使用者管理、所有資料的刪除），不是資料集合
  admin: [{ env: "ADMIN_CODE", actions: ["create", "update", "delete"] }],
  materials: MATERIAL_RULES,
  // 庫存異動（進貨／盤點／報廢）用同一類資材的驗證碼
  stock: MATERIAL_RULES,
};

export const CODE_HEADER = "x-verify-code";

const ACTION_LABEL: Record<CodeAction, string> = { create: "新增", update: "修改", delete: "刪除" };

/**
 * 找出這次操作要檢查的規則。docs 是相關的資料：
 * 新增 → [新資料]；修改 → [原本的資料, 新資料]（例如農藥改成肥料也要驗證）；刪除 → [原本的資料]
 */
function ruleFor(collection: string, action: CodeAction, docs: Doc[]) {
  return RULES[collection]?.find(
    (r) =>
      r.actions.includes(action) &&
      (!r.applies || docs.some((d) => d && r.applies!(d))) &&
      !(action === "update" && r.freeFields && docs.length === 2 && onlyChanged(docs[0], docs[1], r.freeFields)),
  );
}

export const needsCode = (collection: string, action: CodeAction, docs: Doc[] = []) =>
  !!ruleFor(collection, action, docs);

/** 這次請求帶的驗證碼，以及是否在後台解鎖的 1 小時內 */
export type CodeInput = { code: string; unlocked: boolean };

/** 從 header 取出驗證碼（前端用 encodeURIComponent 送出，避免中文無法放進 header），並檢查解鎖 cookie */
export async function readCode(headers: Headers, userId: string): Promise<CodeInput> {
  let code: string;
  try {
    code = decodeURIComponent(headers.get(CODE_HEADER) ?? "");
  } catch {
    code = "";
  }
  const unlocked = (await verifyUnlock((await cookies()).get(UNLOCK_COOKIE)?.value, userId)) !== null;
  return { code, unlocked };
}

function sameCode(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** 需要驗證碼而且驗證碼錯誤時丟出 403；後台解鎖期間直接通過 */
export function assertCode(collection: string, action: CodeAction, given: CodeInput, docs: Doc[] = []) {
  const rule = ruleFor(collection, action, docs);
  if (!rule || given.unlocked) return;
  const expected = process.env[rule.env];
  if (!expected) throw new HttpError(500, `伺服器尚未設定 ${rule.env}`);
  if (!sameCode(given.code, expected)) throw new HttpError(403, `驗證碼錯誤，無法${ACTION_LABEL[action]}`);
}

/**
 * 後台解鎖用：驗證碼必須和所有頁面的驗證碼都相符，
 * 解鎖後才不會比原本個別輸入擁有更多權限。
 */
export function assertUnlockCode(given: string) {
  const envs = [...new Set(Object.values(RULES).flatMap((rules) => rules!.map((r) => r.env)))];
  for (const env of envs) {
    const expected = process.env[env];
    if (!expected) throw new HttpError(500, `伺服器尚未設定 ${env}`);
    if (!sameCode(given, expected)) throw new HttpError(403, "驗證碼錯誤，無法解鎖");
  }
}
