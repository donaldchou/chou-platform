import { Schema } from "mongoose";
import { KNOWLEDGE_KINDS } from "@/lib/types";
import { defineModel, idField, photos, str, ymd } from "./_shared";

/** 知識管理：文章、AI 問答備份、YouTube 影片、重要資訊與管理經驗 */
const KnowledgeSchema = new Schema({
  _id: idField,
  kind: { type: String, enum: Object.keys(KNOWLEDGE_KINDS), required: true, index: true },
  title: { type: String, required: [true, "請填寫標題"], trim: true },
  category: { ...str, index: true },
  date: ymd,
  source: str, // AI 名稱、網站、作者
  sourceUrl: str,
  question: str, // AI 問答：問的問題
  content: str,
  videos: { type: [String], default: [] }, // YouTube 連結
  photos,
  pinned: { type: Boolean, default: false },
});

export const KnowledgeModel = defineModel("Knowledge", KnowledgeSchema, "knowledge");
