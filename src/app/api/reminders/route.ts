import { NextResponse } from "next/server";
import { handleError } from "@/lib/api";
import { connectDB } from "@/lib/mongodb";
import { daysUntil, todayStr } from "@/lib/utils";
import type { Material, Orchard, Task } from "@/lib/types";
import { OrchardModel } from "@/models/orchard";
import { TaskModel } from "@/models/people";
import { MaterialModel } from "@/models/supply";

/**
 * GET /api/reminders?days=90
 * 合約到期提醒（預設 3 個月內）、逾期工作、有禁用期的農藥與待完成事項。
 * 之後可以用排程（cron）呼叫，推播到 LINE 或 Email。
 */
export async function GET(req: Request) {
  try {
    await connectDB();
    const days = Number(new URL(req.url).searchParams.get("days") ?? 90);
    const today = todayStr();
    const limit = new Date(today);
    limit.setDate(limit.getDate() + days);
    const limitStr = limit.toISOString().slice(0, 10);

    const [orchards, tasks, materials] = await Promise.all([
      OrchardModel.find().lean() as unknown as Promise<(Orchard & { _id: string })[]>,
      TaskModel.find({ status: { $ne: "已完成" }, dueDate: { $ne: "", $lt: today } }).lean() as unknown as Promise<
        (Task & { _id: string })[]
      >,
      MaterialModel.find({ bannedPeriod: { $ne: "" } }).lean() as unknown as Promise<(Material & { _id: string })[]>,
    ]);

    const contracts = orchards
      .filter((o) => o.contract?.end && o.contract.end <= limitStr)
      .map((o) => ({
        orchardId: o._id,
        name: o.nameZh,
        end: o.contract.end,
        daysLeft: daysUntil(o.contract.end),
        expired: o.contract.end < today,
      }))
      .sort((a, b) => a.daysLeft - b.daysLeft);

    const sum = (s: object | undefined) => Object.values(s ?? {}).reduce((a, b) => a + (b || 0), 0);
    const todos = orchards
      .map((o) => ({ orchardId: o._id, name: o.nameZh, graft: sum(o.todo?.graft), replant: sum(o.todo?.replant) }))
      .filter((t) => t.graft + t.replant > 0);

    return NextResponse.json({
      today,
      contracts,
      overdueTasks: tasks.map((t) => ({ id: t._id, title: t.title, employeeId: t.employeeId, dueDate: t.dueDate })),
      bannedMaterials: materials.map((m) => ({ id: m._id, name: m.nameZh, bannedPeriod: m.bannedPeriod })),
      todos,
    });
  } catch (err) {
    return handleError(err);
  }
}
