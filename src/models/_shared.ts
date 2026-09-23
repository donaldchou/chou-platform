import mongoose, { Schema, type Model } from "mongoose";
import { uid } from "@/lib/utils";

/**
 * 所有文件使用字串 _id（與前端的 id 相同），API 輸出時轉成 `id`。
 * 子文件（地號、進場紀錄…）不另外產生 _id，而是保留前端的 `id` 欄位。
 */
export const idField = { type: String, default: uid };

export const sub = { _id: false } as const;

export const ymd = { type: String, default: "", match: /^$|^\d{4}-\d{2}-\d{2}$/ };
export const ym = { type: String, required: true, match: /^\d{4}-\d{2}$/ };
export const dateTime = { type: String, default: "", match: /^$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/ };
export const money = { type: Number, default: 0, min: 0 };
export const str = { type: String, default: "", trim: true };
export const photos = { type: [String], default: [] };
export const orchardRef = { type: String, ref: "Orchard", required: true, index: true };

export const AttendanceSchema = new Schema(
  { id: idField, name: { type: String, required: true, trim: true }, in: dateTime, out: dateTime },
  sub,
);

export const BoxUsageSchema = new Schema(
  { id: idField, type: { type: String, required: true }, date: ymd, boxes: money },
  sub,
);

export const BENTO_MODES = ["便當", "餐費補貼"] as const;

export function defineModel(name: string, schema: Schema, collection: string): Model<unknown> {
  schema.set("versionKey", false);
  // dev 模式 hot reload 後 schema 可能已經改了，要重新註冊，否則新欄位會被當成未知欄位丟掉
  if (mongoose.models[name]) mongoose.deleteModel(name);
  return mongoose.model(name, schema, collection) as unknown as Model<unknown>;
}
