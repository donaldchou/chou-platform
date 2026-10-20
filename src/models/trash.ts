import { Schema } from "mongoose";
import { defineModel, idField, str } from "./_shared";

/** 可以還原的集合：刪除時先備份到 trash，後台可以查看、還原或永久刪除 */
export const TRASH_COLLECTIONS = ["spraying", "fertilizing"] as const;
export type TrashCollection = (typeof TRASH_COLLECTIONS)[number];

/** 已刪除紀錄的備份；data 是刪除前的整筆資料（含 _id），還原時原樣寫回 */
const TrashSchema = new Schema({
  _id: idField,
  collectionName: { type: String, enum: TRASH_COLLECTIONS, required: true, index: true },
  docId: { type: String, required: true },
  data: { type: Schema.Types.Mixed, required: true },
  deletedAt: { type: Date, default: Date.now, index: true },
  deletedBy: str, // 刪除者的 email
});

export const TrashModel = defineModel("Trash", TrashSchema, "trash");
