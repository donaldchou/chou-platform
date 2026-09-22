"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { remove, upsert, useDB } from "@/lib/store";
import { TASK_STATUSES, type Bonus, type Employee, type Salary, type Task, type TaskStatus } from "@/lib/types";
import { fmtDT, money, nowStr, thisMonth, todayStr, uid } from "@/lib/utils";
import {
  Badge,
  Button,
  Card,
  Field,
  Gallery,
  Input,
  Modal,
  NumInput,
  PageHeader,
  PhotoUpload,
  RowActions,
  Select,
  StatCard,
  Table,
  Tabs,
  Td,
  Textarea,
  type Tone,
} from "@/components/ui";

type Tab = "tasks" | "salary" | "bonus" | "employees";
const CATEGORIES = ["噴藥", "施肥", "剪枝", "砍草", "套袋", "採收", "嫁接", "種植", "其他"];
const STATUS_TONE: Record<TaskStatus, Tone> = { 待處理: "amber", 進行中: "blue", 已完成: "green" };

export default function StaffPage() {
  const [tab, setTab] = useState<Tab>("tasks");
  return (
    <>
      <PageHeader title="員工工作回報" desc="指派工作、查看員工回報，並管理薪水與分紅。" />
      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "tasks", label: "工作指派與回報" },
          { value: "salary", label: "薪水管理" },
          { value: "bonus", label: "分紅" },
          { value: "employees", label: "員工名冊" },
        ]}
      />
      {tab === "tasks" && <TasksTab />}
      {tab === "salary" && <SalaryTab />}
      {tab === "bonus" && <BonusTab />}
      {tab === "employees" && <EmployeesTab />}
    </>
  );
}

function useNames() {
  const db = useDB();
  return {
    emp: (id: string) => db.employees.find((e) => e.id === id)?.name ?? "（已刪除）",
    orchard: (id: string) => db.orchards.find((o) => o.id === id)?.nameZh ?? "—",
  };
}

function SaveFooter({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  return (
    <>
      <Button variant="secondary" onClick={onClose}>取消</Button>
      <Button onClick={() => { onSave(); onClose(); }}>儲存</Button>
    </>
  );
}

function EmployeeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const db = useDB();
  return (
    <Field label="員工">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {db.employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </Select>
    </Field>
  );
}

/* ---------------- 工作指派與回報 ---------------- */
function TasksTab() {
  const db = useDB();
  const n = useNames();
  const [filter, setFilter] = useState<TaskStatus | "all">("all");
  const [editing, setEditing] = useState<Task | null>(null);
  const list = db.tasks
    .filter((t) => filter === "all" || t.status === filter)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["all", ...TASK_STATUSES] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1 text-sm ${filter === s ? "bg-emerald-700 text-white" : "bg-white text-stone-600"}`}
            >
              {s === "all" ? "全部" : s}（{db.tasks.filter((t) => s === "all" || t.status === s).length}）
            </button>
          ))}
        </div>
        <Button
          onClick={() =>
            setEditing({
              id: uid(), employeeId: db.employees[0]?.id ?? "", orchardId: db.orchards[0]?.id ?? "", category: "噴藥",
              title: "", dueDate: todayStr(), status: "待處理", report: "", reportedAt: "",
            })
          }
        >
          <Plus size={16} /> 指派工作
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {list.map((t) => (
          <Card key={t.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={STATUS_TONE[t.status]}>{t.status}</Badge>
                <Badge>{t.category}</Badge>
              </div>
              <RowActions onEdit={() => setEditing(t)} onDelete={() => remove("tasks", t.id)} />
            </div>
            <div className="mt-2 font-semibold text-stone-900">{t.title || "（未命名工作）"}</div>
            <div className="text-sm text-stone-500">
              {n.emp(t.employeeId)}・{n.orchard(t.orchardId)}・期限 {t.dueDate}
            </div>
            {t.report ? (
              <div className="mt-3 rounded-lg bg-stone-50 p-3 text-sm">
                <div className="text-xs text-stone-500">員工回報（{fmtDT(t.reportedAt)}）</div>
                <div className="mt-1 text-stone-700">{t.report}</div>
              </div>
            ) : (
              <div className="mt-3 text-sm text-stone-400">尚未回報</div>
            )}
            {t.status !== "已完成" && (
              <div className="mt-3 flex gap-2">
                {TASK_STATUSES.filter((s) => s !== t.status).map((s) => (
                  <Button key={s} size="sm" variant="secondary" onClick={() => upsert("tasks", { ...t, status: s })}>
                    標記為{s}
                  </Button>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
      {editing && <TaskModal task={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function TaskModal({ task, onClose }: { task: Task; onClose: () => void }) {
  const db = useDB();
  const [t, setT] = useState(task);
  return (
    <Modal open onClose={onClose} title="工作指派與回報" footer={<SaveFooter onClose={onClose} onSave={() => upsert("tasks", t)} />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <EmployeeSelect value={t.employeeId} onChange={(v) => setT({ ...t, employeeId: v })} />
        <Field label="果園">
          <Select value={t.orchardId} onChange={(e) => setT({ ...t, orchardId: e.target.value })}>
            {db.orchards.map((o) => <option key={o.id} value={o.id}>{o.nameZh}</option>)}
          </Select>
        </Field>
        <Field label="工作項目">
          <Select value={t.category} onChange={(e) => setT({ ...t, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="期限">
          <Input type="date" value={t.dueDate} onChange={(e) => setT({ ...t, dueDate: e.target.value })} />
        </Field>
        <Field label="工作內容" className="sm:col-span-2">
          <Input value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} placeholder="例：東區甜桃噴殺蟲劑" />
        </Field>
        <Field label="狀態">
          <Select value={t.status} onChange={(e) => setT({ ...t, status: e.target.value as TaskStatus })}>
            {TASK_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="員工回報內容" className="sm:col-span-2">
          <Textarea
            value={t.report}
            onChange={(e) => setT({ ...t, report: e.target.value, reportedAt: nowStr() })}
            placeholder="員工完成後填寫回報"
          />
        </Field>
      </div>
    </Modal>
  );
}

/* ---------------- 薪水管理 ---------------- */
function SalaryTab() {
  const db = useDB();
  const n = useNames();
  const [editing, setEditing] = useState<Salary | null>(null);
  const list = [...db.salaries].sort((a, b) => b.month.localeCompare(a.month));
  const month = list[0]?.month ?? thisMonth();
  const monthTotal = db.salaries.filter((s) => s.month === month).reduce((a, s) => a + s.amount, 0);
  const year = todayStr().slice(0, 4);
  const yearTotal = db.salaries.filter((s) => s.month.startsWith(year)).reduce((a, s) => a + s.amount, 0);

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label={`${month} 薪資合計`} value={money(monthTotal)} />
        <StatCard label={`${year} 年薪資累計`} value={money(yearTotal)} />
      </div>
      <div className="mb-3 flex justify-end">
        <Button
          onClick={() =>
            setEditing({ id: uid(), employeeId: db.employees[0]?.id ?? "", month: thisMonth(), amount: 0, photos: [], note: "" })
          }
        >
          <Plus size={16} /> 新增薪資
        </Button>
      </div>
      <Table head={["月份", "員工", "金額", "薪資單照片", "備註", ""]}>
        {list.map((s) => (
          <tr key={s.id} className="hover:bg-stone-50">
            <Td>{s.month}</Td>
            <Td className="font-medium">{n.emp(s.employeeId)}</Td>
            <Td className="font-semibold">{money(s.amount)}</Td>
            <Td><Gallery photos={s.photos} size="h-10 w-10" /></Td>
            <Td className="text-stone-500">{s.note}</Td>
            <Td><RowActions onEdit={() => setEditing(s)} onDelete={() => remove("salaries", s.id)} /></Td>
          </tr>
        ))}
      </Table>
      {editing && <SalaryModal salary={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function SalaryModal({ salary, onClose }: { salary: Salary; onClose: () => void }) {
  const [s, setS] = useState(salary);
  return (
    <Modal open onClose={onClose} title="薪水管理" footer={<SaveFooter onClose={onClose} onSave={() => upsert("salaries", s)} />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <EmployeeSelect value={s.employeeId} onChange={(v) => setS({ ...s, employeeId: v })} />
        <Field label="月份">
          <Input type="month" value={s.month} onChange={(e) => setS({ ...s, month: e.target.value })} />
        </Field>
        <Field label="金額（NTD）">
          <NumInput value={s.amount} onChange={(v) => setS({ ...s, amount: v })} />
        </Field>
        <Field label="備註">
          <Input value={s.note} onChange={(e) => setS({ ...s, note: e.target.value })} />
        </Field>
        <Field label="照片" group className="sm:col-span-2">
          <PhotoUpload value={s.photos} onChange={(v) => setS({ ...s, photos: v })} />
        </Field>
      </div>
    </Modal>
  );
}

/* ---------------- 分紅 ---------------- */
function BonusTab() {
  const db = useDB();
  const n = useNames();
  const [editing, setEditing] = useState<Bonus | null>(null);
  const list = [...db.bonuses].sort((a, b) => b.date.localeCompare(a.date));
  const byEmp = db.employees.map((e) => ({
    e,
    total: db.bonuses.filter((b) => b.employeeId === e.id).reduce((a, b) => a + b.amount, 0),
  }));

  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {byEmp.map(({ e, total }) => (
          <StatCard key={e.id} label={`${e.name} 累計分紅`} value={money(total)} />
        ))}
      </div>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setEditing({ id: uid(), employeeId: db.employees[0]?.id ?? "", date: todayStr(), amount: 0, note: "" })}>
          <Plus size={16} /> 新增分紅
        </Button>
      </div>
      <Table head={["日期", "員工", "金額（NTD）", "說明", ""]}>
        {list.map((b) => (
          <tr key={b.id} className="hover:bg-stone-50">
            <Td>{b.date}</Td>
            <Td className="font-medium">{n.emp(b.employeeId)}</Td>
            <Td className="font-semibold">{money(b.amount)}</Td>
            <Td className="text-stone-500">{b.note}</Td>
            <Td><RowActions onEdit={() => setEditing(b)} onDelete={() => remove("bonuses", b.id)} /></Td>
          </tr>
        ))}
      </Table>
      {editing && (
        <BonusModal bonus={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function BonusModal({ bonus, onClose }: { bonus: Bonus; onClose: () => void }) {
  const [b, setB] = useState(bonus);
  return (
    <Modal open onClose={onClose} title="分紅" footer={<SaveFooter onClose={onClose} onSave={() => upsert("bonuses", b)} />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <EmployeeSelect value={b.employeeId} onChange={(v) => setB({ ...b, employeeId: v })} />
        <Field label="日期">
          <Input type="date" value={b.date} onChange={(e) => setB({ ...b, date: e.target.value })} />
        </Field>
        <Field label="金額（NTD）">
          <NumInput value={b.amount} onChange={(v) => setB({ ...b, amount: v })} />
        </Field>
        <Field label="說明">
          <Input value={b.note} onChange={(e) => setB({ ...b, note: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

/* ---------------- 員工名冊 ---------------- */
function EmployeesTab() {
  const db = useDB();
  const [editing, setEditing] = useState<Employee | null>(null);
  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button onClick={() => setEditing({ id: uid(), name: "", phone: "", title: "正職員工" })}>
          <Plus size={16} /> 新增員工
        </Button>
      </div>
      <Table head={["姓名", "電話", "職稱", "待辦工作", ""]}>
        {db.employees.map((e) => (
          <tr key={e.id} className="hover:bg-stone-50">
            <Td className="font-medium">{e.name}</Td>
            <Td><a href={`tel:${e.phone}`} className="text-emerald-700">{e.phone}</a></Td>
            <Td>{e.title}</Td>
            <Td>{db.tasks.filter((t) => t.employeeId === e.id && t.status !== "已完成").length} 件</Td>
            <Td><RowActions onEdit={() => setEditing(e)} onDelete={() => remove("employees", e.id)} /></Td>
          </tr>
        ))}
      </Table>
      {editing && <EmployeeModal employee={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function EmployeeModal({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const [e, setE] = useState(employee);
  return (
    <Modal open onClose={onClose} title="員工資料" footer={<SaveFooter onClose={onClose} onSave={() => upsert("employees", e)} />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="姓名">
          <Input value={e.name} onChange={(ev) => setE({ ...e, name: ev.target.value })} />
        </Field>
        <Field label="電話">
          <Input type="tel" value={e.phone} onChange={(ev) => setE({ ...e, phone: ev.target.value })} />
        </Field>
        <Field label="職稱">
          <Input value={e.title} onChange={(ev) => setE({ ...e, title: ev.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
