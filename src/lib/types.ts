export type ID = string;

export const FRUITS = ["甜桃", "水蜜桃", "李子", "甜柿"] as const;
export type Fruit = (typeof FRUITS)[number];

/** 果樹英文名稱（員工參考卡給外籍員工看） */
export const FRUIT_EN: Record<Fruit, string> = {
  甜桃: "Nectarine",
  水蜜桃: "Peach",
  李子: "Plum",
  甜柿: "Persimmon",
};

export const LAND_TYPES = ["原保", "林", "農牧", "住"] as const;
export type LandType = (typeof LAND_TYPES)[number];

export interface Parcel {
  id: ID;
  landNo: string;
  lat: string;
  lng: string;
  landType: LandType;
  areaFen: number;
}

export interface Seedlings {
  苦桃苗: number;
  甜柿苗: number;
  李子苗: number;
}

export interface Orchard {
  id: ID;
  nameZh: string;
  nameEn: string;
  active: boolean; // 果園啟用／關閉
  closedReason: string; // 關閉原因
  photos: string[];
  parcels: Parcel[];
  acquisition: { cost: number; date: string; name: string; phone: string };
  contract: { start: string; end: string; photos: string[] };
  trees: Record<Fruit, number> & { otherName: string; other: number };
  waterTank: { sizeTon: number; count: number };
  pump: { spec: string; price: number };
  sprayPipe: { diameterFen: number; pricePerRoll: number; fittings: number };
  fence: {
    has: boolean;
    voltage: number;
    materialSpec: string;
    materialPrice: number;
    totalCost: number;
  };
  todo: { graft: Seedlings; replant: Seedlings };
  waterPipePhotos: string[];
  meters: Meter[]; // 電錶（至少一個）
}

/** 電錶：電錶號碼＋照片，電費繳費單會綁定到電錶 */
export interface Meter {
  id: ID;
  no: string;
  photos: string[];
}

export type BillKind = "water" | "electricity";

export interface Bill {
  id: ID;
  orchardId: ID;
  kind: BillKind;
  month: string; // YYYY-MM
  amount: number;
  cycle: string;
  meterId: ID; // 電費：哪一個電錶（水費為空）
  photos: string[];
  note: string;
}

export interface Employee {
  id: ID;
  name: string;
  phone: string;
  title: string;
}

export interface Worker {
  id: ID;
  nameZh: string;
  nameEn: string;
  phone: string;
  lineName: string;
  photo: string;
  createdAt: string;
  dailyRate: number;
}

export const SUPPLIER_CONTACTS = 3;

export interface SupplierContact {
  name: string;
  phone: string;
}

export interface Supplier {
  id: ID;
  name: string;
  phone: string; // 店家電話
  contacts: SupplierContact[]; // 聯絡人，最多 3 組
  address: string;
  cardPhotos: string[]; // 名片（可多張）
  note: string;
}

export type MaterialCategory = "pesticide" | "fertilizer" | "packaging";
export type MaterialUnit = "ml" | "g" | "kg" | "片";

export interface Material {
  id: ID;
  category: MaterialCategory;
  nameZh: string;
  nameEn: string;
  /** 製造廠商（目前只有農藥頁面使用；舊資料可能沒有這個欄位） */
  manufacturer?: string;
  createdAt: string;
  updatedAt: string;
  unit: MaterialUnit;
  size: number;
  price: number;
  priceHistory: { date: string; price: number }[];
  dilution: string;
  targets: string; // 成分說明
  properties: string[];
  usagePeriod: string;
  bannedPeriod: string;
  photos: string[];
  /** 員工參考卡要顯示的照片（photos 其中一張）；空白＝用第一張 */
  cardPhoto?: string;
  supplierId: ID;
  /** 安全存量（瓶／包數），低於時在庫存頁顯示不足；0 或沒有＝未設定 */
  minStock?: number;
  /** 包材：對應套袋紀錄的紙袋類型（BAG_TYPES），套袋用的紙袋會自動從這項扣庫存 */
  bagType?: string;
}

/** 庫存異動：進貨、盤點（填實際數量）、報廢；使用量由噴藥／施肥／套袋紀錄自動計算，不存在這裡 */
export type StockKind = "purchase" | "count" | "scrap";

export interface StockTxn {
  id: ID;
  materialId: ID;
  category: MaterialCategory; // 跟資材相同，用來決定驗證碼
  kind: StockKind;
  datetime: string; // YYYY-MM-DDTHH:mm
  /** 基本單位（cc／g／片）。進貨、報廢＝數量；盤點＝當時實際的庫存總量 */
  qty: number;
  price: number; // 進貨總金額
  expiry: string; // 有效期限 YYYY-MM-DD（進貨）
  batch: string; // 批號
  supplierId: ID;
  note: string;
}

export interface Attendance {
  id: ID;
  name: string;
  in: string; // datetime-local
  out: string;
}

export interface BoxUsage {
  id: ID;
  type: string;
  date: string;
  boxes: number;
}

export type BentoMode = "便當" | "餐費補貼";

export interface BaggingWage {
  id: ID;
  name: string;
  bags: number;
  bentoDays: number;
}

export interface BaggingRecord {
  id: ID;
  orchardId: ID;
  start: string;
  end: string;
  employeeIds: ID[];
  ownBoxes: BoxUsage[];
  ownRemainingBags: number;
  workerIds: ID[];
  attendance: Attendance[];
  bentoMode: BentoMode;
  externalBoxes: BoxUsage[];
  externalRemainingBags: number;
  pricePerBag: number;
  wages: BaggingWage[];
}

export interface HarvestRecord {
  id: ID;
  orchardId: ID;
  fruit: string;
  start: string;
  end: string;
  note: string;
}

export interface FertItem {
  id: ID;
  materialId: ID;
  gramsPerTree: number;
  litersPerTree: number;
  seconds: number;
  /** 整體用量：液體（ml）是公升，其他是公斤 */
  amount: number;
}

export interface FertilizingRecord {
  id: ID;
  orchardId: ID;
  datetime: string;
  waterLiters: number; // 水使用總量（公升）
  items: FertItem[];
  targets: string[];
  otherTarget: string;
  employeeIds: ID[];
  photos: string[];
  note: string;
}

export interface SprayItem {
  id: ID;
  materialId: ID;
  amount: number;
  unit: "cc" | "g";
}

export interface SprayingRecord {
  id: ID;
  orchardId: ID;
  datetime: string;
  waterLiters: number;
  items: SprayItem[];
  targets: string[];
  otherTarget: string;
  stage: string;
  aiSuggestion: string;
  employeeIds: ID[];
  note: string;
}

export type LaborKind = "pruning" | "weeding";

export interface LaborWage {
  id: ID;
  name: string;
  days: number;
  dailyRate: number;
  bentoDays: number;
}

export interface LaborRecord {
  id: ID;
  kind: LaborKind;
  orchardId: ID;
  start: string;
  end: string;
  employeeIds: ID[];
  workers: { workerId: ID; dailyRate: number }[];
  attendance: Attendance[];
  bentoMode: BentoMode;
  wages: LaborWage[];
}

export const TASK_STATUSES = ["待處理", "進行中", "已完成"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface Task {
  id: ID;
  employeeId: ID;
  orchardId: ID;
  category: string;
  title: string;
  dueDate: string;
  status: TaskStatus;
  report: string;
  reportedAt: string;
}

export interface Salary {
  id: ID;
  employeeId: ID;
  month: string;
  amount: number;
  photos: string[];
  note: string;
}

export interface Bonus {
  id: ID;
  employeeId: ID;
  date: string;
  amount: number;
  note: string;
}

export interface DB {
  orchards: Orchard[];
  bills: Bill[];
  employees: Employee[];
  workers: Worker[];
  suppliers: Supplier[];
  materials: Material[];
  stock: StockTxn[];
  bagging: BaggingRecord[];
  harvests: HarvestRecord[];
  fertilizing: FertilizingRecord[];
  spraying: SprayingRecord[];
  labor: LaborRecord[];
  tasks: Task[];
  salaries: Salary[];
  bonuses: Bonus[];
}
