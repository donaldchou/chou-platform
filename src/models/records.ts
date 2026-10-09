import { Schema } from "mongoose";
import {
  AttendanceSchema,
  BENTO_MODES,
  BoxUsageSchema,
  dateTime,
  defineModel,
  idField,
  money,
  orchardRef,
  photos,
  str,
  sub,
  ym,
  ymd,
} from "./_shared";

const ids = { type: [String], default: [] };

/** 水費／電費繳費單 */
const BillSchema = new Schema({
  _id: idField,
  orchardId: orchardRef,
  kind: { type: String, enum: ["water", "electricity"], required: true },
  month: ym, // 繳費月份
  amount: money,
  cycle: str, // 週期
  meterId: str, // 電費：果園裡的哪一個電錶
  photos,
  note: str,
});
BillSchema.index({ kind: 1, month: 1 });

/** 套袋紀錄 */
const BaggingSchema = new Schema({
  _id: idField,
  orchardId: orchardRef,
  start: ymd,
  end: ymd,
  employeeIds: ids, // 自己員工
  ownBoxes: { type: [BoxUsageSchema], default: [] },
  ownRemainingBags: money,
  workerIds: ids, // 年度外請工人
  attendance: { type: [AttendanceSchema], default: [] }, // 進場時間紀錄
  bentoMode: { type: String, enum: BENTO_MODES, default: "便當" },
  externalBoxes: { type: [BoxUsageSchema], default: [] },
  externalRemainingBags: money,
  pricePerBag: money,
  wages: {
    type: [new Schema({ id: idField, name: str, bags: money, bentoDays: money }, sub)],
    default: [],
  },
});

/** 採收紀錄 */
const HarvestSchema = new Schema({
  _id: idField,
  orchardId: orchardRef,
  fruit: str,
  start: ymd,
  end: ymd,
  note: str,
});

/** 施肥紀錄 */
const FertilizingSchema = new Schema({
  _id: idField,
  orchardId: orchardRef,
  datetime: dateTime,
  waterLiters: money, // 水使用總量（公升）
  items: {
    type: [
      new Schema(
        {
          id: idField,
          materialId: { type: String, ref: "Material", required: true },
          gramsPerTree: money,
          litersPerTree: money,
          seconds: money,
          amount: money, // 整體用量：液體 L，其他 kg
        },
        sub,
      ),
    ],
    default: [],
  },
  targets: ids, // 對象
  otherTarget: str,
  employeeIds: ids,
  photos, // 提供給員工的參考照片
  note: str,
});

/** 噴藥紀錄 */
const SprayingSchema = new Schema({
  _id: idField,
  orchardId: orchardRef,
  datetime: dateTime,
  waterLiters: money,
  // 陣列順序就是加入順序
  items: {
    type: [
      new Schema(
        {
          id: idField,
          materialId: { type: String, ref: "Material", required: true },
          amount: money,
          unit: { type: String, enum: ["cc", "g"], default: "cc" },
        },
        sub,
      ),
    ],
    default: [],
  },
  targets: ids,
  otherTarget: str,
  stage: str, // 果樹目前時間點
  aiSuggestion: str,
  employeeIds: ids,
  note: str,
});

/** 剪枝／砍草紀錄（kind 區分） */
const LaborSchema = new Schema({
  _id: idField,
  kind: { type: String, enum: ["pruning", "weeding"], required: true, index: true },
  orchardId: orchardRef,
  start: ymd,
  end: ymd,
  employeeIds: ids,
  workers: {
    type: [new Schema({ workerId: { type: String, ref: "Worker", required: true }, dailyRate: money }, sub)],
    default: [],
  },
  attendance: { type: [AttendanceSchema], default: [] },
  bentoMode: { type: String, enum: BENTO_MODES, default: "便當" },
  wages: {
    type: [new Schema({ id: idField, name: str, days: money, dailyRate: money, bentoDays: money }, sub)],
    default: [],
  },
});

/** 種苗／嫁接／環剝紀錄（kind 區分） */
const PropagationSchema = new Schema({
  _id: idField,
  kind: { type: String, enum: ["planting", "grafting", "girdling"], required: true, index: true },
  orchardId: orchardRef,
  date: ymd,
  fruit: str,
  variety: str, // 種植／接穗品種
  rootstock: str, // 嫁接：砧木
  seedlingSource: str, // 種植：苗木來源
  location: str, // 區塊／位置
  count: money, // 株數
  survived: money, // 成活株數
  checkDate: ymd, // 成活檢查日期
  girdleWidth: money, // 環剝寬度（cm）
  employeeIds: ids,
  photos,
  note: str,
});

export const BillModel = defineModel("Bill", BillSchema, "bills");
export const BaggingModel = defineModel("Bagging", BaggingSchema, "bagging");
export const HarvestModel = defineModel("Harvest", HarvestSchema, "harvests");
export const FertilizingModel = defineModel("Fertilizing", FertilizingSchema, "fertilizing");
export const SprayingModel = defineModel("Spraying", SprayingSchema, "spraying");
export const LaborModel = defineModel("Labor", LaborSchema, "labor");
export const PropagationModel = defineModel("Propagation", PropagationSchema, "propagation");
