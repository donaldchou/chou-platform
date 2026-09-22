import type { DB, Orchard } from "./types";
import { uid } from "./utils";

export function emptyOrchard(): Orchard {
  return {
    id: uid(),
    nameZh: "",
    nameEn: "",
    photos: [],
    parcels: [{ id: uid(), landNo: "", lat: "", lng: "", landType: "農牧", areaFen: 0 }],
    acquisition: { cost: 0, date: "", name: "", phone: "" },
    contract: { start: "", end: "", photos: [] },
    trees: { 甜桃: 0, 水蜜桃: 0, 李子: 0, 甜柿: 0, otherName: "", other: 0 },
    waterTank: { sizeTon: 0, count: 0 },
    pump: { spec: "", price: 0 },
    sprayPipe: { diameterFen: 0, pricePerRoll: 0, fittings: 0 },
    fence: { has: false, voltage: 0, materialSpec: "", materialPrice: 0, totalCost: 0 },
    todo: {
      graft: { 苦桃苗: 0, 甜柿苗: 0, 李子苗: 0 },
      replant: { 苦桃苗: 0, 甜柿苗: 0, 李子苗: 0 },
    },
    waterPipePhotos: [],
    electricityNo: "",
    electricityPhotos: [],
  };
}

const months = (year: number, upTo: number) =>
  Array.from({ length: upTo }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);

function bills() {
  const out: DB["bills"] = [];
  const plan: [string, number, number][] = [
    ["o1", 820, 1450],
    ["o2", 560, 980],
    ["o3", 430, 760],
  ];
  for (const [orchardId, water, elec] of plan) {
    for (const [year, upTo] of [[2024, 12], [2025, 12], [2026, 8]] as const) {
      months(year, upTo).forEach((month, i) => {
        const season = [5, 6, 7, 8].includes(i + 1) ? 1.6 : 1;
        const drift = year === 2024 ? 0.9 : year === 2025 ? 1 : 1.08;
        out.push({
          id: uid(),
          orchardId,
          kind: "water",
          month,
          amount: Math.round(water * season * drift + ((i * 37) % 120)),
          cycle: "每月",
          photos: [],
          note: "",
        });
        if (i % 2 === 1) {
          out.push({
            id: uid(),
            orchardId,
            kind: "electricity",
            month,
            amount: Math.round(elec * season * drift + ((i * 53) % 200)),
            cycle: "雙月",
            photos: [],
            note: "",
          });
        }
      });
    }
  }
  return out;
}

export function seedDB(): DB {
  const base = emptyOrchard();
  return {
    orchards: [
      {
        ...base,
        id: "o1",
        nameZh: "梨山一號園",
        nameEn: "Lishan No.1",
        parcels: [
          { id: "p1", landNo: "梨山段 123 地號", lat: "24.2536", lng: "121.2485", landType: "農牧", areaFen: 8.5 },
          { id: "p2", landNo: "梨山段 124 地號", lat: "24.2541", lng: "121.2492", landType: "林", areaFen: 3.2 },
        ],
        acquisition: { cost: 3200000, date: "2021-03-15", name: "林大明", phone: "0912-345-678" },
        contract: { start: "2021-04-01", end: "2026-11-30", photos: [] },
        trees: { 甜桃: 180, 水蜜桃: 220, 李子: 60, 甜柿: 90, otherName: "蘋果", other: 20 },
        waterTank: { sizeTon: 10, count: 3 },
        pump: { spec: "2HP 抽水加壓馬達", price: 18500 },
        sprayPipe: { diameterFen: 3, pricePerRoll: 2800, fittings: 24 },
        fence: { has: true, voltage: 8000, materialSpec: "鍍鋅鋼線 2.5mm + 電網主機", materialPrice: 42000, totalCost: 68000 },
        todo: {
          graft: { 苦桃苗: 30, 甜柿苗: 12, 李子苗: 0 },
          replant: { 苦桃苗: 8, 甜柿苗: 0, 李子苗: 5 },
        },
        electricityNo: "07-1234-5678-9",
      },
      {
        ...base,
        id: "o2",
        nameZh: "福壽山果園",
        nameEn: "Fushoushan Orchard",
        parcels: [
          { id: "p3", landNo: "福壽段 58 地號", lat: "24.2330", lng: "121.2440", landType: "原保", areaFen: 6 },
        ],
        acquisition: { cost: 1800000, date: "2019-08-01", name: "王美玲", phone: "0928-111-222" },
        contract: { start: "2019-08-01", end: "2029-07-31", photos: [] },
        trees: { 甜桃: 120, 水蜜桃: 80, 李子: 40, 甜柿: 150, otherName: "", other: 0 },
        waterTank: { sizeTon: 5, count: 2 },
        pump: { spec: "1HP 加壓馬達", price: 9800 },
        sprayPipe: { diameterFen: 2, pricePerRoll: 1900, fittings: 16 },
        fence: { has: false, voltage: 0, materialSpec: "", materialPrice: 0, totalCost: 0 },
        todo: {
          graft: { 苦桃苗: 0, 甜柿苗: 20, 李子苗: 10 },
          replant: { 苦桃苗: 0, 甜柿苗: 6, 李子苗: 0 },
        },
        electricityNo: "07-2233-4455-1",
      },
      {
        ...base,
        id: "o3",
        nameZh: "環山二號園",
        nameEn: "Huanshan No.2",
        parcels: [
          { id: "p4", landNo: "環山段 201 地號", lat: "24.3163", lng: "121.2998", landType: "農牧", areaFen: 4.8 },
        ],
        acquisition: { cost: 950000, date: "2023-01-10", name: "陳志強", phone: "0933-987-654" },
        contract: { start: "2023-01-10", end: "2026-08-31", photos: [] },
        trees: { 甜桃: 60, 水蜜桃: 140, 李子: 0, 甜柿: 30, otherName: "", other: 0 },
        waterTank: { sizeTon: 5, count: 1 },
        pump: { spec: "1HP 加壓馬達", price: 9500 },
        sprayPipe: { diameterFen: 2, pricePerRoll: 1900, fittings: 10 },
        fence: { has: true, voltage: 6000, materialSpec: "鋁合金線 + 太陽能主機", materialPrice: 26000, totalCost: 39000 },
        todo: {
          graft: { 苦桃苗: 15, 甜柿苗: 0, 李子苗: 0 },
          replant: { 苦桃苗: 0, 甜柿苗: 0, 李子苗: 0 },
        },
        electricityNo: "07-9988-7766-5",
      },
    ],
    bills: bills(),
    employees: [
      { id: "e1", name: "周阿福", phone: "0911-000-111", title: "園區主管" },
      { id: "e2", name: "李小華", phone: "0922-000-222", title: "正職員工" },
      { id: "e3", name: "張志明", phone: "0955-000-333", title: "正職員工" },
    ],
    workers: [
      { id: "w1", nameZh: "阿美", nameEn: "Amei", phone: "0966-123-456", lineName: "amei88", photo: "", createdAt: "2025-02-01", dailyRate: 1800 },
      { id: "w2", nameZh: "阿強", nameEn: "Aqiang", phone: "0977-222-333", lineName: "strong_q", photo: "", createdAt: "2025-02-01", dailyRate: 2000 },
      { id: "w3", nameZh: "Nguyen Van An", nameEn: "An", phone: "0988-444-555", lineName: "an.vn", photo: "", createdAt: "2025-06-12", dailyRate: 1800 },
      { id: "w4", nameZh: "秀英", nameEn: "Xiuying", phone: "0919-666-777", lineName: "ying_farm", photo: "", createdAt: "2026-03-05", dailyRate: 1700 },
    ],
    suppliers: [
      { id: "s1", name: "梨山農藥行", phone: "04-2598-1234", address: "台中市和平區梨山里中正路 50 號", cardPhoto: "", note: "週日公休" },
      { id: "s2", name: "東勢農資供應社", phone: "04-2587-5678", address: "台中市東勢區第一橫街 88 號", cardPhoto: "", note: "可送貨上山（滿 5 萬）" },
    ],
    materials: [
      {
        id: "m1", category: "pesticide", nameZh: "亞托敏", nameEn: "Azoxystrobin", createdAt: "2025-01-10", updatedAt: "2026-02-18",
        unit: "ml", size: 500, price: 1350, priceHistory: [{ date: "2025-01-10", price: 1250 }], dilution: "2000",
        targets: "炭疽病、白粉病", properties: ["殺細菌"], usagePeriod: "萌芽期～幼果期", bannedPeriod: "採收前 14 天禁用",
        photo: "", supplierId: "s1",
      },
      {
        id: "m2", category: "pesticide", nameZh: "賜諾殺", nameEn: "Spinosad", createdAt: "2025-01-10", updatedAt: "2025-01-10",
        unit: "ml", size: 250, price: 980, priceHistory: [], dilution: "3000",
        targets: "薊馬、果實蠅", properties: ["殺蟲"], usagePeriod: "開花後～套袋前", bannedPeriod: "採收前 7 天禁用",
        photo: "", supplierId: "s1",
      },
      {
        id: "m3", category: "pesticide", nameZh: "銅劑（氫氧化銅）", nameEn: "Copper Hydroxide", createdAt: "2025-03-02", updatedAt: "2025-03-02",
        unit: "g", size: 1000, price: 620, priceHistory: [], dilution: "800",
        targets: "細菌性穿孔病", properties: ["殺細菌", "病毒"], usagePeriod: "休眠期、採收後", bannedPeriod: "",
        photo: "", supplierId: "s2",
      },
      {
        id: "m4", category: "fertilizer", nameZh: "台肥 43 號複合肥", nameEn: "Taifer No.43", createdAt: "2025-01-15", updatedAt: "2026-01-05",
        unit: "kg", size: 40, price: 880, priceHistory: [{ date: "2025-01-15", price: 820 }], dilution: "",
        targets: "果實肥大", properties: ["營養補充"], usagePeriod: "幼果期～果實肥大期", bannedPeriod: "",
        photo: "", supplierId: "s2",
      },
      {
        id: "m5", category: "fertilizer", nameZh: "有機質肥料", nameEn: "Organic Compost", createdAt: "2025-01-15", updatedAt: "2025-01-15",
        unit: "kg", size: 20, price: 260, priceHistory: [], dilution: "",
        targets: "改善土壤", properties: ["營養補充"], usagePeriod: "採收後、休眠期", bannedPeriod: "",
        photo: "", supplierId: "s2",
      },
      {
        id: "m6", category: "fertilizer", nameZh: "液態鈣肥", nameEn: "Liquid Calcium", createdAt: "2025-04-01", updatedAt: "2025-04-01",
        unit: "ml", size: 1000, price: 450, priceHistory: [], dilution: "1000",
        targets: "裂果、果實硬度", properties: ["營養補充"], usagePeriod: "幼果期", bannedPeriod: "",
        photo: "", supplierId: "s1",
      },
      {
        id: "m7", category: "packaging", nameZh: "甜桃套袋紙袋", nameEn: "Peach Bag", createdAt: "2025-02-01", updatedAt: "2025-02-01",
        unit: "片", size: 10000, price: 4200, priceHistory: [], dilution: "",
        targets: "", properties: ["套袋"], usagePeriod: "幼果期", bannedPeriod: "",
        photo: "", supplierId: "s2",
      },
      {
        id: "m8", category: "packaging", nameZh: "水蜜桃禮盒（12 入）", nameEn: "Gift Box 12", createdAt: "2025-05-20", updatedAt: "2025-05-20",
        unit: "片", size: 50, price: 1750, priceHistory: [], dilution: "",
        targets: "", properties: ["包裝"], usagePeriod: "採收期", bannedPeriod: "",
        photo: "", supplierId: "s2",
      },
    ],
    bagging: [
      {
        id: "b1", orchardId: "o1", start: "2026-04-20", end: "2026-05-03",
        employeeIds: ["e1", "e2"],
        ownBoxes: [{ id: uid(), type: "甜桃", date: "2026-04-20", boxes: 2 }],
        ownRemainingBags: 1200,
        workerIds: ["w1", "w2"],
        attendance: [
          { id: uid(), name: "阿美", in: "2026-04-21T07:00", out: "2026-04-21T16:30" },
          { id: uid(), name: "阿美", in: "2026-04-22T07:00", out: "2026-04-22T16:00" },
          { id: uid(), name: "阿強", in: "2026-04-21T07:30", out: "2026-04-21T17:00" },
        ],
        bentoMode: "便當",
        externalBoxes: [{ id: uid(), type: "水蜜桃", date: "2026-04-21", boxes: 3 }],
        externalRemainingBags: 800,
        pricePerBag: 1.2,
        wages: [
          { id: uid(), name: "阿美", bags: 9200, bentoDays: 2 },
          { id: uid(), name: "阿強", bags: 8000, bentoDays: 1 },
        ],
      },
    ],
    harvests: [
      { id: uid(), orchardId: "o1", fruit: "水蜜桃", start: "2026-06-25", end: "2026-07-20", note: "今年產量佳" },
      { id: uid(), orchardId: "o2", fruit: "甜柿", start: "2025-10-15", end: "2025-11-30", note: "" },
    ],
    fertilizing: [
      {
        id: uid(), orchardId: "o1", datetime: "2026-03-10T08:00",
        items: [{ id: uid(), materialId: "m4", gramsPerTree: 300, litersPerTree: 0, seconds: 0, packs: 4 }],
        targets: ["甜桃", "水蜜桃"], otherTarget: "", employeeIds: ["e2"], photos: [], note: "樹冠外圍環狀施肥",
      },
      {
        id: uid(), orchardId: "o2", datetime: "2026-04-02T09:30",
        items: [{ id: uid(), materialId: "m6", gramsPerTree: 0, litersPerTree: 2, seconds: 15, packs: 3 }],
        targets: ["甜柿"], otherTarget: "", employeeIds: ["e3"], photos: [], note: "",
      },
    ],
    spraying: [
      {
        id: uid(), orchardId: "o1", datetime: "2026-04-12T06:30", waterLiters: 1000,
        items: [
          { id: uid(), materialId: "m1", amount: 500, unit: "cc" },
          { id: uid(), materialId: "m2", amount: 330, unit: "cc" },
        ],
        targets: ["甜桃", "水蜜桃"], otherTarget: "", stage: "幼果期", aiSuggestion: "",
        employeeIds: ["e1", "e2"], note: "",
      },
      {
        id: uid(), orchardId: "o3", datetime: "2026-01-08T07:00", waterLiters: 600,
        items: [{ id: uid(), materialId: "m3", amount: 750, unit: "g" }],
        targets: ["水蜜桃"], otherTarget: "", stage: "休眠期", aiSuggestion: "",
        employeeIds: ["e3"], note: "清園",
      },
    ],
    labor: [
      {
        id: uid(), kind: "pruning", orchardId: "o1", start: "2026-01-05", end: "2026-01-12",
        employeeIds: ["e1"], workers: [{ workerId: "w2", dailyRate: 2000 }, { workerId: "w3", dailyRate: 1800 }],
        attendance: [
          { id: uid(), name: "阿強", in: "2026-01-05T07:00", out: "2026-01-05T16:00" },
          { id: uid(), name: "阿強", in: "2026-01-06T07:00", out: "2026-01-06T16:00" },
          { id: uid(), name: "Nguyen Van An", in: "2026-01-05T07:00", out: "2026-01-05T16:00" },
        ],
        bentoMode: "便當",
        wages: [
          { id: uid(), name: "阿強", days: 2, dailyRate: 2000, bentoDays: 2 },
          { id: uid(), name: "Nguyen Van An", days: 1, dailyRate: 1800, bentoDays: 1 },
        ],
      },
      {
        id: uid(), kind: "weeding", orchardId: "o2", start: "2026-05-18", end: "2026-05-19",
        employeeIds: ["e3"], workers: [{ workerId: "w4", dailyRate: 1700 }],
        attendance: [
          { id: uid(), name: "秀英", in: "2026-05-18T06:30", out: "2026-05-18T15:30" },
          { id: uid(), name: "秀英", in: "2026-05-19T06:30", out: "2026-05-19T12:00" },
        ],
        bentoMode: "餐費補貼",
        wages: [{ id: uid(), name: "秀英", days: 2, dailyRate: 1700, bentoDays: 2 }],
      },
    ],
    tasks: [
      { id: uid(), employeeId: "e2", orchardId: "o1", category: "噴藥", title: "東區甜桃噴殺蟲劑", dueDate: "2026-09-25", status: "待處理", report: "", reportedAt: "" },
      { id: uid(), employeeId: "e3", orchardId: "o2", category: "砍草", title: "甜柿區除草", dueDate: "2026-09-24", status: "進行中", report: "已完成一半，明天繼續", reportedAt: "2026-09-23T17:10" },
      { id: uid(), employeeId: "e1", orchardId: "o3", category: "其他", title: "檢查電網電壓", dueDate: "2026-09-20", status: "已完成", report: "電壓正常 6000V，更換兩處絕緣子", reportedAt: "2026-09-20T15:00" },
    ],
    salaries: [
      { id: uid(), employeeId: "e1", month: "2026-08", amount: 42000, photos: [], note: "" },
      { id: uid(), employeeId: "e2", month: "2026-08", amount: 35000, photos: [], note: "" },
      { id: uid(), employeeId: "e3", month: "2026-08", amount: 34000, photos: [], note: "含加班 2 天" },
    ],
    bonuses: [
      { id: uid(), employeeId: "e1", date: "2026-07-31", amount: 30000, note: "水蜜桃季分紅" },
      { id: uid(), employeeId: "e2", date: "2026-07-31", amount: 15000, note: "水蜜桃季分紅" },
    ],
  };
}
