import type { Orchard } from "./types";
import { uid } from "./utils";

/** 新增果園表單的空白資料 */
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
