import { NextResponse } from "next/server";
import { handleError, readJson } from "@/lib/api";
import { connectDB } from "@/lib/mongodb";
import { advicePrompt, fallbackAdvice } from "@/lib/spray-advice";
import type { Material } from "@/lib/types";
import { MaterialModel } from "@/models/supply";

// 先用 3.6-flash，忙碌或失敗時改用較穩定的 3.5-flash-lite
const MODELS = ["gemini-3.6-flash", "gemini-3.5-flash-lite"];

async function askGemini(prompt: string, apiKey: string) {
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (!res.ok) {
        console.warn(`Gemini ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`);
        continue;
      }
      const data = await res.json();
      const text: string | undefined = data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("")
        .trim();
      if (text) return { text, model };
    } catch (err) {
      console.warn(`Gemini ${model} failed:`, err);
    }
  }
  return null;
}

/**
 * POST /api/ai/spray-advice
 * body: { stage, targets: string, waterLiters, materialIds: string[] }
 * 有設定 GEMINI_API_KEY 時由 AI 產生建議，否則回傳固定的示範建議。
 */
export async function POST(req: Request) {
  try {
    const body = await readJson(req);
    const stage = String(body.stage ?? "");
    const targets = String(body.targets ?? "—");
    const waterLiters = Number(body.waterLiters ?? 0);
    const ids = Array.isArray(body.materialIds) ? body.materialIds.map(String) : [];

    await connectDB();
    const found = (await MaterialModel.find({ _id: { $in: ids } }).lean()) as unknown as (Material & { _id: string })[];
    // 保持前端傳來的加入順序
    const materials = ids.map((id) => found.find((m) => m._id === id)).filter((m): m is Material & { _id: string } => !!m);

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      const ai = await askGemini(advicePrompt(stage, targets, waterLiters, materials), apiKey);
      if (ai) return NextResponse.json({ advice: ai.text, source: "ai", model: ai.model });
    }
    return NextResponse.json({
      advice: fallbackAdvice(stage, targets, materials),
      source: "fallback",
      reason: apiKey ? "AI 暫時無法回應，改用內建建議" : "尚未設定 GEMINI_API_KEY，使用內建建議",
    });
  } catch (err) {
    return handleError(err);
  }
}
