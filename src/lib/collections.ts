import type { Model } from "mongoose";
import type { DB } from "./types";
import { OrchardModel } from "@/models/orchard";
import { BonusModel, EmployeeModel, SalaryModel, TaskModel, WorkerModel } from "@/models/people";
import { MaterialModel, StockModel, SupplierModel } from "@/models/supply";
import {
  BaggingModel,
  BillModel,
  FertilizingModel,
  HarvestModel,
  LaborModel,
  PhenologyModel,
  PropagationModel,
  SprayingModel,
} from "@/models/records";
import { KnowledgeModel } from "@/models/knowledge";
import { PlatformModel } from "@/models/platform";

/** API 路徑 /api/<collection> 對應的 Mongoose model，名稱與前端 DB 的 key 相同。 */
export const COLLECTIONS: Record<keyof DB, Model<unknown>> = {
  orchards: OrchardModel,
  bills: BillModel,
  employees: EmployeeModel,
  workers: WorkerModel,
  suppliers: SupplierModel,
  materials: MaterialModel,
  stock: StockModel,
  bagging: BaggingModel,
  harvests: HarvestModel,
  fertilizing: FertilizingModel,
  spraying: SprayingModel,
  labor: LaborModel,
  phenology: PhenologyModel,
  propagation: PropagationModel,
  tasks: TaskModel,
  salaries: SalaryModel,
  bonuses: BonusModel,
  knowledge: KnowledgeModel,
  platforms: PlatformModel,
};

export type CollectionName = keyof DB;

export const isCollection = (name: string): name is CollectionName => name in COLLECTIONS;

/** 每個集合允許用 query string 篩選的欄位，例如 /api/bills?kind=water&orchardId=o1 */
export const FILTERS: Partial<Record<CollectionName, string[]>> = {
  bills: ["orchardId", "kind"],
  materials: ["category", "supplierId"],
  stock: ["materialId", "category", "kind"],
  bagging: ["orchardId"],
  harvests: ["orchardId"],
  fertilizing: ["orchardId"],
  spraying: ["orchardId"],
  labor: ["orchardId", "kind"],
  phenology: ["orchardId", "kind"],
  propagation: ["orchardId", "kind"],
  tasks: ["employeeId", "orchardId", "status"],
  salaries: ["employeeId"],
  bonuses: ["employeeId"],
  knowledge: ["kind", "category"],
};

/** 刪除果園時會一併刪除的關聯紀錄 */
export const ORCHARD_CHILDREN: CollectionName[] = [
  "bills",
  "bagging",
  "harvests",
  "fertilizing",
  "spraying",
  "labor",
  "phenology",
  "propagation",
  "tasks",
];

/** 列表預設排序（新的在前） */
export const SORT: Partial<Record<CollectionName, Record<string, 1 | -1>>> = {
  bills: { month: -1 },
  stock: { datetime: -1 },
  bagging: { start: -1 },
  harvests: { start: -1 },
  fertilizing: { datetime: -1 },
  spraying: { datetime: -1 },
  labor: { start: -1 },
  phenology: { start: -1 },
  propagation: { date: -1 },
  tasks: { dueDate: 1 },
  salaries: { month: -1 },
  bonuses: { date: -1 },
  knowledge: { date: -1 },
  platforms: { name: 1 },
};
