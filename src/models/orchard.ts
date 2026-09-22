import { Schema } from "mongoose";
import { LAND_TYPES } from "@/lib/types";
import { defineModel, idField, money, photos, str, sub, ymd } from "./_shared";

const ParcelSchema = new Schema(
  {
    id: idField,
    landNo: str, // 地號
    lat: str, // 緯度
    lng: str, // 經度
    landType: { type: String, enum: LAND_TYPES, default: "農牧" }, // 地目
    areaFen: money, // 面積（分）
  },
  sub,
);

const SeedlingsSchema = new Schema(
  { 苦桃苗: money, 甜柿苗: money, 李子苗: money },
  sub,
);

const OrchardSchema = new Schema({
  _id: idField,
  nameZh: { type: String, required: [true, "請填寫果園中文名稱"], trim: true },
  nameEn: str,
  photos,
  parcels: { type: [ParcelSchema], default: [] },
  acquisition: {
    cost: money, // 取得成本
    date: ymd,
    name: str, // 對象姓名
    phone: str,
  },
  contract: {
    start: ymd,
    end: { ...ymd, index: true }, // 到期提醒會用這個欄位查詢
    photos,
  },
  trees: {
    甜桃: money,
    水蜜桃: money,
    李子: money,
    甜柿: money,
    otherName: str,
    other: money,
  },
  waterTank: { sizeTon: money, count: money },
  pump: { spec: str, price: money },
  sprayPipe: { diameterFen: money, pricePerRoll: money, fittings: money },
  fence: {
    has: { type: Boolean, default: false },
    voltage: money,
    materialSpec: str,
    materialPrice: money,
    totalCost: money,
  },
  todo: {
    graft: { type: SeedlingsSchema, default: () => ({}) }, // 待嫁接
    replant: { type: SeedlingsSchema, default: () => ({}) }, // 待重新種植
  },
  waterPipePhotos: photos, // 水塔管線照片
  electricityNo: str, // 電號
  electricityPhotos: photos,
});

export const OrchardModel = defineModel("Orchard", OrchardSchema, "orchards");
