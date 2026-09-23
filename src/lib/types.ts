export type ID = string;

export const FRUITS = ["甜桃", "水蜜桃", "李子", "甜柿"] as const;
export type Fruit = (typeof FRUITS)[number];

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
  electricityNo: string;
  electricityPhotos: string[];
}

export type BillKind = "water" | "electricity";

export interface Bill {
  id: ID;
  orchardId: ID;
  kind: BillKind;
  month: string; // YYYY-MM
  amount: number;
  cycle: string;
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
  createdAt: string;
  updatedAt: string;
  unit: MaterialUnit;
  size: number;
  price: number;
  priceHistory: { date: string; price: number }[];
  dilution: string;
  targets: string;
  properties: string[];
  usagePeriod: string;
  bannedPeriod: string;
  photo: string;
  supplierId: ID;
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
  packs: number;
}

export interface FertilizingRecord {
  id: ID;
  orchardId: ID;
  datetime: string;
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
  bagging: BaggingRecord[];
  harvests: HarvestRecord[];
  fertilizing: FertilizingRecord[];
  spraying: SprayingRecord[];
  labor: LaborRecord[];
  tasks: Task[];
  salaries: Salary[];
  bonuses: Bonus[];
}
