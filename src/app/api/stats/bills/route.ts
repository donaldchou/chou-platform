import { NextResponse, type NextRequest } from "next/server";
import { HttpError, handleError } from "@/lib/api";
import { connectDB } from "@/lib/mongodb";
import { todayStr } from "@/lib/utils";
import { BillModel } from "@/models/records";

/**
 * GET /api/stats/bills?kind=water|electricity&year=2026&orchardId=o1
 * 水電費統計：年度每月金額、歷年總額、各果園總額。
 */
export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const p = req.nextUrl.searchParams;
    const kind = p.get("kind");
    if (kind !== "water" && kind !== "electricity") throw new HttpError(400, "kind 必須是 water 或 electricity");
    const year = p.get("year") ?? todayStr().slice(0, 4);
    if (!/^\d{4}$/.test(year)) throw new HttpError(400, "year 必須是四位數年份");
    const match: Record<string, string> = { kind };
    if (p.get("orchardId")) match.orchardId = p.get("orchardId")!;

    const [monthly, yearly, byOrchard] = await Promise.all([
      BillModel.aggregate<{ _id: string; total: number }>([
        { $match: { ...match, month: { $regex: `^${year}-` } } },
        { $group: { _id: "$month", total: { $sum: "$amount" } } },
      ]),
      BillModel.aggregate<{ _id: string; total: number }>([
        { $match: match },
        { $group: { _id: { $substrBytes: ["$month", 0, 4] }, total: { $sum: "$amount" } } },
        { $sort: { _id: 1 } },
      ]),
      BillModel.aggregate<{ _id: string; total: number }>([
        { $match: { ...match, month: { $regex: `^${year}-` } } },
        { $group: { _id: "$orchardId", total: { $sum: "$amount" } } },
        { $sort: { total: -1 } },
      ]),
    ]);

    const months = Array.from({ length: 12 }, (_, i) => {
      const m = `${year}-${String(i + 1).padStart(2, "0")}`;
      return { month: m, total: monthly.find((x) => x._id === m)?.total ?? 0 };
    });

    return NextResponse.json({
      kind,
      year,
      total: months.reduce((s, m) => s + m.total, 0),
      monthly: months,
      yearly: yearly.map((y) => ({ year: y._id, total: y.total })),
      byOrchard: byOrchard.map((o) => ({ orchardId: o._id, total: o.total })),
    });
  } catch (err) {
    return handleError(err);
  }
}
