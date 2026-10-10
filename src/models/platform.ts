import { Schema } from "mongoose";
import { defineModel, idField, str } from "./_shared";

/** 常用平台：常用網站的名稱、網址與說明 */
const PlatformSchema = new Schema({
  _id: idField,
  name: { type: String, required: [true, "請填寫網站名稱"], trim: true },
  url: {
    type: String,
    required: [true, "請填寫網站網址"],
    trim: true,
    // 只接受 http／https，避免 javascript: 這類連結被點開
    match: [/^https?:\/\/\S+$/i, "網站網址要以 http:// 或 https:// 開頭"],
  },
  description: str,
});

export const PlatformModel = defineModel("Platform", PlatformSchema, "platforms");
