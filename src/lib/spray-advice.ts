import type { Material } from "./types";
import { materialTargetsLabel } from "./utils";

export const STAGES = ["休眠期", "萌芽期", "開花期", "幼果期", "套袋前", "果實肥大期", "採收前", "採收後"];

const TIPS: Record<string, string> = {
  休眠期: "以清園為主，建議使用銅劑或石灰硫磺合劑，降低越冬病原菌與介殼蟲密度。",
  萌芽期: "注意縮葉病與蚜蟲，可搭配殺菌劑預防，避免在低溫下噴藥以免藥害。",
  開花期: "盡量避免使用殺蟲劑以保護授粉昆蟲；如需防治灰黴病，選擇對蜂類低毒的藥劑。",
  幼果期: "防治炭疽病、細菌性穿孔病與薊馬；可同時補充鈣肥降低日後裂果。",
  套袋前: "套袋前 1～2 天全面噴一次殺菌＋殺蟲劑，待藥液乾後再套袋。",
  果實肥大期: "以營養補充為主（鉀肥、鈣肥），病蟲害以監測為主、必要時再施藥。",
  採收前: "嚴格遵守各藥劑的安全採收期，避免使用禁用期內的藥品。",
  採收後: "恢復樹勢：施用有機質肥料，並針對葉部病害做一次保護性噴藥。",
};

/** 沒有設定 GEMINI_API_KEY 或 AI 呼叫失敗時使用的固定建議 */
export function fallbackAdvice(stage: string, targets: string, materials: Material[]) {
  const banned = materials.filter((m) => m.bannedPeriod);
  return [
    `【${stage}・${targets}】`,
    TIPS[stage] ?? "請選擇果樹目前的生長階段。",
    materials.length
      ? `本次配方：${materials.map((m) => m.nameZh).join(" → ")}。建議依「水 → 可濕性粉劑 → 乳劑 → 葉面肥」的順序加入。`
      : "",
    banned.length ? `⚠ 注意禁用期：${banned.map((m) => `${m.nameZh}（${m.bannedPeriod}）`).join("；")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function advicePrompt(stage: string, targets: string, waterLiters: number, materials: Material[]) {
  const recipe = materials.length
    ? materials
        .map(
          (m, i) =>
            `${i + 1}. ${m.nameZh}${m.nameEn ? `（${m.nameEn}）` : ""}：稀釋 ${m.dilution || "未填"} 倍，` +
            `${materialTargetsLabel(m.category)} ${m.targets || "未填"}，性質 ${m.properties.join("、") || "未填"}，` +
            `使用時間 ${m.usagePeriod || "未填"}，禁用時間 ${m.bannedPeriod || "無"}`,
        )
        .join("\n")
    : "（尚未選擇藥品）";
  return `你是台灣高山果園（甜桃、水蜜桃、李子、甜柿）的植物保護顧問。
果樹目前時間點：${stage}
噴藥對象：${targets}
預計用水量：${waterLiters} 公升
目前預計使用的藥品／肥料（依加入順序）：
${recipe}

請用繁體中文，以條列方式給出 4～6 點簡短建議，內容包含：
- 這個時間點該注意的主要病蟲害
- 目前配方是否合適、是否缺少或多餘
- 藥品加入順序是否需要調整
- 禁用期與安全採收期的提醒
不要使用 Markdown 標題，每點一行，總字數 250 字以內。`;
}
