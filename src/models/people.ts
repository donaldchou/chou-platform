import { Schema } from "mongoose";
import { TASK_STATUSES } from "@/lib/types";
import { dateTime, defineModel, idField, money, photos, str, ym, ymd } from "./_shared";

/** 自己員工 */
const EmployeeSchema = new Schema({
  _id: idField,
  name: { type: String, required: [true, "請填寫員工姓名"], trim: true },
  phone: str,
  title: str,
});

/** 外請工人 */
const WorkerSchema = new Schema({
  _id: idField,
  nameZh: { type: String, required: [true, "請填寫工人中文姓名"], trim: true },
  nameEn: str,
  phone: str,
  lineName: str,
  photo: str,
  createdAt: ymd, // 登入時間
  dailyRate: money, // 預設日薪
});

/** 工作指派與回報 */
const TaskSchema = new Schema({
  _id: idField,
  employeeId: { type: String, ref: "Employee", required: true, index: true },
  orchardId: { type: String, ref: "Orchard", default: "", index: true },
  category: str, // 工作項目
  title: str,
  dueDate: ymd,
  status: { type: String, enum: TASK_STATUSES, default: "待處理", index: true },
  report: str, // 員工回報
  reportedAt: dateTime,
});

/** 薪水 */
const SalarySchema = new Schema({
  _id: idField,
  employeeId: { type: String, ref: "Employee", required: true, index: true },
  month: ym,
  amount: money,
  photos,
  note: str,
});

/** 分紅 */
const BonusSchema = new Schema({
  _id: idField,
  employeeId: { type: String, ref: "Employee", required: true, index: true },
  date: { ...ymd, required: true },
  amount: money,
  note: str,
});

export const EmployeeModel = defineModel("Employee", EmployeeSchema, "employees");
export const WorkerModel = defineModel("Worker", WorkerSchema, "workers");
export const TaskModel = defineModel("Task", TaskSchema, "tasks");
export const SalaryModel = defineModel("Salary", SalarySchema, "salaries");
export const BonusModel = defineModel("Bonus", BonusSchema, "bonuses");
