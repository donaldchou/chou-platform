"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { removeWithCode, upsert, useDB, verifyCode } from "@/lib/store";
import { useCodeGate } from "@/components/code-modal";
import { ALL_YEARS, RecordsToolbar } from "@/components/record-calendar";
import { SortableTable, fruitRank, zh, type GroupDef, type SortCol } from "@/components/sortable-table";
import {
  PHENOLOGY_KINDS,
  type LaborRecord,
  type PhenologyKind,
  type PhenologyRecord,
} from "@/lib/types";
import { daySpan, defaultOrchard, money, todayStr, uid } from "@/lib/utils";
import { LaborModal, laborDesc, laborTotal, newLaborRecord } from "@/components/labor-page";
import { FruitPicker, OrchardSelect, fruitsText } from "@/components/record-parts";
import {
  Badge,
  Button,
  Field,
  Input,
  Modal,
  PageHeader,
  PhotoUpload,
  RowActions,
  SectionTitle,
  Select,
  Tabs,
  Textarea,
  Thumb,
  type Tone,
} from "@/components/ui";

type Kind = "pruning" | PhenologyKind;
type Tab = "all" | Kind;

const PHENOLOGY_LIST = Object.keys(PHENOLOGY_KINDS) as PhenologyKind[];
const KIND_LABEL: Record<Kind, string> = { pruning: "剪枝", ...PHENOLOGY_KINDS };
const KINDS = Object.keys(KIND_LABEL) as Kind[];
const KIND_TONE: Record<Kind, Tone> = { pruning: "green", flowering: "red", fruiting: "amber", thinning: "blue" };

/** 表格裡的一筆紀錄：剪枝存在 labor，開花／結果／疏果存在 phenology */
type Target = { coll: "labor"; record: LaborRecord } | { coll: "phenology"; record: PhenologyRecord };

const targetLabel = (t: Target) => `${KIND_LABEL[t.record.kind as Kind]}紀錄`;

export default function PruningPage() {
  const db = useDB();
  const [tab, setTab] = useState<Tab>("all");
  const [choosing, setChoosing] = useState(false);
  const [editing, setEditing] = useState<(Target & { code: string }) | null>(null);
  const gate = useCodeGate();

  // 新增、修改、刪除都要先輸入驗證碼（後端也會再檢查）
  function edit(t: Target) {
    const isNew = !(db[t.coll] as { id: string }[]).some((x) => x.id === t.record.id);
    const label = targetLabel(t);
    gate.ask({
      title: `${isNew ? "新增" : "修改"}${label}`,
      confirmLabel: "下一步",
      message: isNew ? `新增${label}需要驗證碼。` : <>修改 <b>{t.record.start}</b> 的{label}需要驗證碼。</>,
      submit: async (code) => {
        const res = await verifyCode(t.coll, isNew ? "create" : "update", code, undefined, t.record.kind);
        if (res.ok) setEditing({ ...t, code });
        return res;
      },
    });
  }

  function del(t: Target) {
    const label = targetLabel(t);
    gate.ask({
      title: `刪除${label}`,
      confirmLabel: "確認刪除",
      danger: true,
      message: <>即將刪除 <b>{t.record.start}</b> 的{label}，無法復原。</>,
      submit: (code) => removeWithCode(t.coll, t.record.id, code),
    });
  }

  // 年度：依開始日期；可以選「全部年度」
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const allYears = year === ALL_YEARS;
  const inYear = (start: string) => allYears || start.startsWith(String(year));
  const starts = [...db.labor.filter((r) => r.kind === "pruning").map((r) => r.start), ...db.phenology.map((r) => r.start)];
  const dataYears = starts.map((s) => Number(s.slice(0, 4))).filter(Boolean);
  const years = [...new Set([thisYear, ...(allYears ? [] : [year]), ...dataYears])].sort((a, b) => b - a);

  const count = (k: Kind) =>
    k === "pruning"
      ? db.labor.filter((r) => r.kind === "pruning" && inYear(r.start)).length
      : db.phenology.filter((r) => r.kind === k && inYear(r.start)).length;
  const total = KINDS.reduce((s, k) => s + count(k), 0);
  const tabs: { value: Tab; label: string }[] = [
    { value: "all", label: `全部 (${total})` },
    ...KINDS.map((k) => ({ value: k, label: `${KIND_LABEL[k]} (${count(k)})` })),
  ];

  function create(t: Kind) {
    setChoosing(false);
    setTab(t);
    if (t === "pruning") return edit({ coll: "labor", record: newLaborRecord("pruning", db) });
    edit({
      coll: "phenology",
      record: {
        id: uid(),
        kind: t,
        orchardId: defaultOrchard(db.orchards)?.id ?? "",
        fruits: [],
        variety: "",
        start: todayStr(),
        end: "",
        photos: [],
        note: "",
      },
    });
  }

  return (
    <>
      <PageHeader
        title="剪枝/開花/結果/疏果紀錄"
        desc={
          tab === "all"
            ? "剪枝工期與工資，以及各作物開花、結果、疏果的起訖時間與照片。"
            : tab === "pruning"
              ? laborDesc("pruning", db)
              : `記錄各作物${PHENOLOGY_KINDS[tab]}的起訖時間，並上傳照片記錄當下狀態。`
        }
        action={<Button onClick={() => setChoosing(true)}><Plus size={16} /> 新增剪枝/開花/結果/疏果紀錄</Button>}
      />
      <RecordsToolbar
        years={years}
        year={year}
        setYear={setYear}
        minYear={Math.min(...years)}
        maxYear={Math.max(thisYear, ...dataYears)}
        showViews={false}
        allowAll
        count={`共 ${total} 筆紀錄`}
      />
      <Tabs<Tab> tabs={tabs} value={tab} onChange={setTab} />

      <RecordsTable tab={tab} year={year} onEdit={edit} onDelete={del} />

      {choosing && (
        <Modal open onClose={() => setChoosing(false)} title="要新增哪一種紀錄？">
          <div className="grid grid-cols-2 gap-3">
            {KINDS.map((k) => (
              <Button key={k} variant={k === tab ? "primary" : "secondary"} onClick={() => create(k)}>
                {KIND_LABEL[k]}紀錄
              </Button>
            ))}
          </div>
        </Modal>
      )}
      {gate.dialog}
      {editing?.coll === "labor" && (
        <LaborModal record={editing.record} code={editing.code} onClose={() => setEditing(null)} />
      )}
      {editing?.coll === "phenology" && (
        <PhenologyModal record={editing.record} code={editing.code} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

/** 表格裡的一列：剪枝與開花／結果／疏果整理成同一種格式，方便一起排序、分組 */
interface Row {
  id: string;
  kind: Kind;
  orchardId: string;
  fruits: string[];
  variety: string;
  start: string;
  end: string;
  days: number; // 進行中＝-1
  photos: string[];
  note: string;
  employees: string;
  workers: string;
  wage: number;
  target: Target;
}

function RecordsTable({
  tab,
  year,
  onEdit,
  onDelete,
}: {
  tab: Tab;
  year: number;
  onEdit: (t: Target) => void;
  onDelete: (t: Target) => void;
}) {
  const db = useDB();
  const allYears = year === ALL_YEARS;
  const orchardIndex = (id: string) => {
    const i = db.orchards.findIndex((o) => o.id === id);
    return i < 0 ? db.orchards.length : i;
  };
  const orchard = (id: string) => db.orchards.find((o) => o.id === id);
  const names = (ids: string[]) =>
    ids.map((id) => db.employees.find((e) => e.id === id)?.name).filter(Boolean).join("、");

  const rows: Row[] = [
    ...db.labor
      .filter((r) => r.kind === "pruning")
      .map((r) => ({
        id: r.id, kind: "pruning" as Kind, orchardId: r.orchardId, fruits: r.fruits ?? [], variety: "",
        start: r.start, end: r.end, days: r.end ? daySpan(r.start, r.end) : -1, photos: [], note: r.note ?? "",
        employees: names(r.employeeIds),
        workers: r.workers.map((w) => db.workers.find((x) => x.id === w.workerId)?.nameZh).filter(Boolean).join("、"),
        wage: laborTotal(r),
        target: { coll: "labor" as const, record: r },
      })),
    ...db.phenology.map((r) => ({
      id: r.id, kind: r.kind as Kind, orchardId: r.orchardId, fruits: r.fruits ?? [], variety: r.variety,
      start: r.start, end: r.end, days: r.end ? daySpan(r.start, r.end) : -1, photos: r.photos, note: r.note,
      employees: "", workers: "", wage: 0,
      target: { coll: "phenology" as const, record: r },
    })),
  ].filter((r) => (tab === "all" || r.kind === tab) && (allYears || r.start.startsWith(String(year))));

  const orchardCol: SortCol<Row> = {
    key: "orchard",
    label: "果園",
    sort: (a, b) => orchardIndex(a.orchardId) - orchardIndex(b.orchardId),
    cell: (r) => (
      <>
        <div className="font-medium">{orchard(r.orchardId)?.nameZh ?? "（已刪除）"}</div>
        <div className="text-xs text-stone-500">{orchard(r.orchardId)?.nameEn}</div>
      </>
    ),
  };
  const startCol = (label: string): SortCol<Row> => ({
    key: "start", label, descFirst: true, className: "whitespace-nowrap",
    sort: (a, b) => a.start.localeCompare(b.start), cell: (r) => r.start,
  });
  const endCol = (label: string): SortCol<Row> => ({
    key: "end", label, descFirst: true, className: "whitespace-nowrap",
    sort: (a, b) => (a.end || "9999").localeCompare(b.end || "9999"),
    cell: (r) => r.end || <Badge tone="amber">進行中</Badge>,
  });
  // 作物複選：依最常用的那一種作物排序，再比全部作物與品種
  const fruitCol = (label: string): SortCol<Row> => ({
    key: "fruit", label,
    sort: (a, b) =>
      Math.min(fruitRank(""), ...a.fruits.map(fruitRank)) - Math.min(fruitRank(""), ...b.fruits.map(fruitRank)) ||
      zh(a.fruits.join("、"), b.fruits.join("、")) || zh(a.variety, b.variety),
    cell: (r) => [fruitsText(r.fruits), r.variety].filter(Boolean).join("・") || "—",
  });
  const daysCol = (label: string): SortCol<Row> => ({
    key: "days", label, sort: (a, b) => a.days - b.days, cell: (r) => (r.days >= 0 ? `${r.days} 天` : "—"),
  });

  const cols: SortCol<Row>[] =
    tab === "pruning"
      ? [
          orchardCol,
          fruitCol("作物"),
          startCol("開始日期"),
          endCol("完工日期"),
          daysCol("工期"),
          { key: "employees", label: "自己員工", sort: (a, b) => zh(a.employees, b.employees), cell: (r) => r.employees || "—" },
          { key: "workers", label: "外請工人", sort: (a, b) => zh(a.workers, b.workers), cell: (r) => r.workers || "—" },
          { key: "wage", label: "工資合計", sort: (a, b) => a.wage - b.wage, cell: (r) => money(r.wage), className: "font-semibold" },
          { key: "note", label: "備註", sort: (a, b) => zh(a.note, b.note), cell: (r) => r.note, className: "text-stone-500" },
        ]
      : [
          ...(tab === "all"
            ? [{
                key: "kind", label: "項目",
                sort: (a: Row, b: Row) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind),
                cell: (r: Row) => <Badge tone={KIND_TONE[r.kind]}>{KIND_LABEL[r.kind]}</Badge>,
              }]
            : []),
          orchardCol,
          fruitCol("作物／品種"),
          startCol("開始日期"),
          endCol("結束日期"),
          daysCol("天數"),
          { key: "photos", label: "照片", cell: (r) => (r.photos.length ? <Thumb src={r.photos[0]} photos={r.photos} showCount /> : "—") },
          {
            key: "note", label: "備註", className: "text-stone-500",
            sort: (a, b) => zh(a.note, b.note),
            // 全部：剪枝列沒有照片，備註前面補上工資
            cell: (r) => (r.kind === "pruning" ? [`工資 ${money(r.wage)}`, r.note].filter(Boolean).join("・") : r.note),
          },
        ];

  const groups: GroupDef<Row>[] = [
    // 全部年度時可以依年度分組（新的年度在前）
    ...(allYears
      ? [{
          value: "year", label: "年度",
          of: (r: Row) => {
            const y = r.start.slice(0, 4);
            return { key: y, label: y ? `${y} 年` : "未填日期", rank: [y ? -Number(y) : 0, ""] as [number, string] };
          },
        }]
      : []),
    {
      value: "orchard", label: "果園",
      of: (r) => ({ key: r.orchardId, label: orchard(r.orchardId)?.nameZh ?? "（已刪除）", rank: [orchardIndex(r.orchardId), ""] }),
    },
    // 作物可複選：一筆紀錄會出現在它每一種作物的組裡
    {
      value: "fruit", label: "作物",
      of: (r) =>
        r.fruits.length
          ? r.fruits.map((f) => ({ key: f, label: f, rank: [fruitRank(f), f] as [number, string] }))
          : { key: "", label: "未填作物", rank: [fruitRank(""), ""] },
    },
    // 剪枝沒有品種欄
    ...(tab === "pruning"
      ? []
      : [{
          value: "fruitVariety", label: "作物／品種",
          of: (r: Row) =>
            (r.fruits.length ? r.fruits : [""]).map((f) => ({
              key: `${f}|${r.variety}`,
              label: [f, r.variety].filter(Boolean).join("／") || "未填作物",
              rank: [fruitRank(f), `${f}|${r.variety}`] as [number, string],
            })),
        }]),
    // 只有「全部」才能依項目分組
    ...(tab === "all"
      ? [{
          value: "kind", label: "項目",
          of: (r: Row) => ({ key: r.kind, label: KIND_LABEL[r.kind], rank: [KINDS.indexOf(r.kind), ""] as [number, string] }),
        }]
      : []),
  ];

  return (
    <SortableTable
      rows={rows}
      cols={cols}
      groups={groups}
      rowKey={(r) => r.id}
      actions={(r) => <RowActions confirm={false} onEdit={() => onEdit(r.target)} onDelete={() => onDelete(r.target)} />}
      empty={`${allYears ? "全部年度" : `${year} 年`}尚無${tab === "all" ? "" : KIND_LABEL[tab]}紀錄`}
      summary={tab === "pruning" ? (list) => `工資小計 ${money(list.reduce((s, r) => s + r.wage, 0))}` : undefined}
      defaultSort={{ key: "start", desc: true }}
      tiebreak={(a, b) => b.start.localeCompare(a.start)}
      searchText={(r) =>
        [
          KIND_LABEL[r.kind], orchard(r.orchardId)?.nameZh, orchard(r.orchardId)?.nameEn,
          ...r.fruits, r.variety, r.start, r.end, r.note, r.employees, r.workers,
        ].join(" ")
      }
      searchPlaceholder="關鍵字：果園、作物、品種、日期、人員、備註…"
    />
  );
}

function PhenologyModal({ record, code, onClose }: { record: PhenologyRecord; code: string; onClose: () => void }) {
  const [r, setR] = useState(record);
  const set = <K extends keyof PhenologyRecord>(k: K, v: PhenologyRecord[K]) => setR((p) => ({ ...p, [k]: v }));
  const label = PHENOLOGY_KINDS[r.kind];

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`${label}紀錄`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={() => { upsert("phenology", r, { code }); onClose(); }}>儲存</Button>
        </>
      }
    >
      <SectionTitle>基本資料</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="項目">
          <Select value={r.kind} onChange={(e) => set("kind", e.target.value as PhenologyKind)}>
            {PHENOLOGY_LIST.map((k) => <option key={k} value={k}>{PHENOLOGY_KINDS[k]}</option>)}
          </Select>
        </Field>
        <OrchardSelect value={r.orchardId} onChange={(v) => set("orchardId", v)} />
        <div />
        <div className="sm:col-span-3">
          <FruitPicker value={r.fruits} onChange={(v) => set("fruits", v)} />
        </div>
        <Field label="品種">
          <Input value={r.variety} onChange={(e) => set("variety", e.target.value)} />
        </Field>
        <div className="sm:col-span-2" />
        <Field label={`${label}開始日期`}>
          <Input type="date" value={r.start} onChange={(e) => set("start", e.target.value)} />
        </Field>
        <Field label={`${label}結束日期`}>
          <Input type="date" value={r.end} onChange={(e) => set("end", e.target.value)} />
        </Field>
        <div className="pb-2 text-sm text-stone-500 sm:self-end">
          {r.end ? `共 ${daySpan(r.start, r.end)} 天` : "未填結束日期＝進行中"}
        </div>
      </div>

      <SectionTitle>照片與備註</SectionTitle>
      <div className="space-y-4">
        <PhotoUpload value={r.photos} onChange={(v) => set("photos", v)} max={20} folder="phenology" />
        <Field label="備註">
          <Textarea value={r.note} onChange={(e) => set("note", e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
