import { Schema } from "mongoose";
import { SUPPLIER_CONTACTS } from "@/lib/types";
import { defineModel, idField, money, photos, str, sub, ymd } from "./_shared";

/** 貨源店家 */
const SupplierSchema = new Schema({
  _id: idField,
  name: { type: String, required: [true, "請填寫店家名稱"], trim: true },
  phone: str, // 店家電話
  contacts: {
    type: [new Schema({ name: str, phone: str }, sub)],
    default: [],
    validate: {
      validator: (v: unknown[]) => v.length <= SUPPLIER_CONTACTS,
      message: `聯絡人最多 ${SUPPLIER_CONTACTS} 組`,
    },
  },
  address: str,
  cardPhotos: photos, // 名片（可多張）
  note: str,
});

/** 農藥／肥料／包材乾貨 */
const MaterialSchema = new Schema({
  _id: idField,
  category: { type: String, enum: ["pesticide", "fertilizer", "packaging"], required: true, index: true },
  nameZh: { type: String, required: [true, "請填寫中文名稱"], trim: true },
  nameEn: str,
  createdAt: ymd, // 登入時間
  updatedAt: ymd, // 資訊異動時間
  unit: { type: String, enum: ["ml", "g", "kg", "片"], required: true },
  size: money, // 每瓶／每包的容量
  price: money,
  priceHistory: { type: [new Schema({ date: ymd, price: money }, sub)], default: [] }, // 保留之前的價格
  dilution: str, // 使用比例（倍數）
  targets: str, // 防治對象
  properties: { type: [String], default: [] }, // 性質
  usagePeriod: str, // 使用時間
  bannedPeriod: str, // 禁用時間（紅字提醒）
  photo: str,
  supplierId: { type: String, ref: "Supplier", default: "", index: true }, // 購買地
});

export const SupplierModel = defineModel("Supplier", SupplierSchema, "suppliers");
export const MaterialModel = defineModel("Material", MaterialSchema, "materials");
