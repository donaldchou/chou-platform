"use client";

import { Fragment, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus } from "lucide-react";
import { remove, upsert, useDB } from "@/lib/store";
import {
  FRUITS,
  PHENOLOGY_KINDS,
  type LaborRecord,
  type PhenologyKind,
  type PhenologyRecord,
} from "@/lib/types";
import { daySpan, defaultOrchard, money, todayStr, uid } from "@/lib/utils";
import { LaborModal, laborDesc, laborTotal, newLaborRecord } from "@/components/labor-page";
import { OrchardSelect } from "@/components/record-parts";
import {
  Badge,
  Button,
  ComboInput,
  Field,
  Input,
  Modal,
  PageHeader,
  PhotoUpload,
  RowActions,
  SectionTitle,
  Select,
  Table,
  Tabs,
  Td,
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

export default function PruningPage() {
  const db = useDB();
  const [tab, setTab] = useState<Tab>("all");
  const [choosing, setChoosing] = useState(false);
  const [labor, setLabor] = useState<LaborRecord | null>(null);
  const [phenology, setPhenology] = useState<PhenologyRecord | null>(null);

  const count = (k: Kind) =>
    k === "pruning" ? db.labor.filter((r) => r.kind === "pruning").length : db.phenology.filter((r) => r.kind === k).length;
  const tabs: { value: Tab; label: string }[] = [
    { value: "all", label: `全部 (${KINDS.reduce((s, k) => s + count(k), 0)})` },
    ...KINDS.map((k) => ({ value: k, label: `${KIND_LABEL[k]} (${count(k)})` })),
  ];

  function create(t: Kind) {
    setChoosing(false);
    setTab(t);
    if (t === "pruning") return setLabor(newLaborRecord("pruning", db));
    setPhenology({
      id: uid(),
      kind: t,
      orchardId: defaultOrchard(db.orchards)?.id ?? "",
      fruit: FRUITS[0],
      variety: "",
      start: todayStr(),
      end: "",
      photos: [],
      note: "",
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
      <Tabs<Tab> tabs={tabs} value={tab} onChange={setTab} />

      <RecordsTable tab={tab} onEditLabor={setLabor} onEditPhenology={setPhenology} />

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
      {labor && <LaborModal record={labor} onClose={() => setLabor(null)} />}
      {phenology && <PhenologyModal record={phenology} onClose={() => setPhenology(null)} />}
    </>
  );
}

/** 表格裡的一列：剪枝與開花／結果／疏果整理成同一種格式，方便一起排序、分組 */
interface Row {
  id: string;
  kind: Kind;
  orchardId: string;
  fruit: string;
  variety: string;
  start: string;
  end: string;
  days: number; // 進行中＝-1
  photos: string[];
  note: string;
  employees: string;
  workers: string;
  wage: number;
  edit: () => void;
  del: () => void;
}

type SortKey = "kind" | "orchard" | "fruit" | "start" | "end" | "days" | "employees" | "workers" | "wage" | "note";
type GroupKey = "none" | "orchard" | "fruit" | "fruitVariety" | "kind";

interface Col {
  label: string;
  sort?: SortKey;
  cell: (r: Row) => ReactNode;
  className?: string;
}

const GROUP_LABEL: Record<GroupKey, string> = {
  none: "不分組",
  orchard: "果園",
  fruit: "作物",
  fruitVariety: "作物／品種",
  kind: "項目",
};

/** 作物依常用順序，其他的排後面 */
const fruitRank = (f: string) => {
  const i = (FRUITS as readonly string[]).indexOf(f);
  return i < 0 ? (f ? FRUITS.length : FRUITS.length + 1) : i;
};
const zh = (a: string, b: string) => a.localeCompare(b, "zh-Hant");

function RecordsTable({
  tab,
  onEditLabor,
  onEditPhenology,
}: {
  tab: Tab;
  onEditLabor: (r: LaborRecord) => void;
  onEditPhenology: (r: PhenologyRecord) => void;
}) {
  const db = useDB();
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "start", desc: true });
  const [group, setGroup] = useState<GroupKey>("none");

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
        id: r.id, kind: "pruning" as Kind, orchardId: r.orchardId, fruit: "", variety: "",
        start: r.start, end: r.end, days: r.end ? daySpan(r.start, r.end) : -1, photos: [], note: r.note ?? "",
        employees: names(r.employeeIds),
        workers: r.workers.map((w) => db.workers.find((x) => x.id === w.workerId)?.nameZh).filter(Boolean).join("、"),
        wage: laborTotal(r),
        edit: () => onEditLabor(r), del: () => remove("labor", r.id),
      })),
    ...db.phenology.map((r) => ({
      id: r.id, kind: r.kind as Kind, orchardId: r.orchardId, fruit: r.fruit, variety: r.variety,
      start: r.start, end: r.end, days: r.end ? daySpan(r.start, r.end) : -1, photos: r.photos, note: r.note,
      employees: "", workers: "", wage: 0,
      edit: () => onEditPhenology(r), del: () => remove("phenology", r.id),
    })),
  ].filter((r) => tab === "all" || r.kind === tab);

  // 排序：相同時用開始日期（新到舊）當第二順序
  const cmp = (a: Row, b: Row): number => {
    switch (sort.key) {
      case "kind": return KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind);
      case "orchard": return orchardIndex(a.orchardId) - orchardIndex(b.orchardId);
      case "fruit": return fruitRank(a.fruit) - fruitRank(b.fruit) || zh(a.fruit, b.fruit) || zh(a.variety, b.variety);
      case "start": return a.start.localeCompare(b.start);
      case "end": return (a.end || "9999").localeCompare(b.end || "9999");
      case "days": return a.days - b.days;
      case "employees": return zh(a.employees, b.employees);
      case "workers": return zh(a.workers, b.workers);
      case "wage": return a.wage - b.wage;
      case "note": return zh(a.note, b.note);
    }
  };
  const sorted = [...rows].sort((a, b) => (sort.desc ? -cmp(a, b) : cmp(a, b)) || b.start.localeCompare(a.start));

  // 剪枝沒有作物欄，不提供依作物分組；只有「全部」才能依項目分組
  const groupOptions = (Object.keys(GROUP_LABEL) as GroupKey[]).filter(
    (g) => !(tab === "pruning" && (g === "fruit" || g === "fruitVariety")) && !(g === "kind" && tab !== "all"),
  );
  const activeGroup = groupOptions.includes(group) ? group : "none";
  // 分組：組的順序固定（果園照果園列表、作物照常用順序），組內照目前的排序
  const groupOf = (r: Row): { key: string; label: string; rank: [number, string] } => {
    switch (activeGroup) {
      case "orchard":
        return { key: r.orchardId, label: orchard(r.orchardId)?.nameZh ?? "（已刪除）", rank: [orchardIndex(r.orchardId), ""] };
      case "fruit":
        return { key: r.fruit, label: r.fruit || "未填作物", rank: [fruitRank(r.fruit), r.fruit] };
      case "fruitVariety": {
        const label = [r.fruit, r.variety].filter(Boolean).join("／");
        return { key: `${r.fruit}|${r.variety}`, label: label || "未填作物", rank: [fruitRank(r.fruit), `${r.fruit}|${r.variety}`] };
      }
      case "kind":
        return { key: r.kind, label: KIND_LABEL[r.kind], rank: [KINDS.indexOf(r.kind), ""] };
      default:
        return { key: "", label: "", rank: [0, ""] };
    }
  };
  const groups: { key: string; label: string; rank: [number, string]; rows: Row[] }[] = [];
  for (const r of sorted) {
    const g = groupOf(r);
    const found = groups.find((x) => x.key === g.key);
    if (found) found.rows.push(r);
    else groups.push({ ...g, rows: [r] });
  }
  groups.sort((a, b) => a.rank[0] - b.rank[0] || zh(a.rank[1], b.rank[1]));

  const orchardCell = (r: Row) => (
    <>
      <div className="font-medium">{orchard(r.orchardId)?.nameZh ?? "（已刪除）"}</div>
      <div className="text-xs text-stone-500">{orchard(r.orchardId)?.nameEn}</div>
    </>
  );
  const fruitCell = (r: Row) => [r.fruit, r.variety].filter(Boolean).join("・") || "—";
  const endCell = (r: Row) => r.end || <Badge tone="amber">進行中</Badge>;
  const daysCell = (r: Row) => (r.days >= 0 ? `${r.days} 天` : "—");
  const photoCell = (r: Row) => (r.photos.length ? <Thumb src={r.photos[0]} photos={r.photos} showCount /> : "—");

  const cols: Col[] =
    tab === "pruning"
      ? [
          { label: "果園", sort: "orchard", cell: orchardCell },
          { label: "開始日期", sort: "start", cell: (r) => r.start, className: "whitespace-nowrap" },
          { label: "完工日期", sort: "end", cell: endCell, className: "whitespace-nowrap" },
          { label: "工期", sort: "days", cell: daysCell },
          { label: "自己員工", sort: "employees", cell: (r) => r.employees || "—" },
          { label: "外請工人", sort: "workers", cell: (r) => r.workers || "—" },
          { label: "工資合計", sort: "wage", cell: (r) => money(r.wage), className: "font-semibold" },
          { label: "備註", sort: "note", cell: (r) => r.note, className: "text-stone-500" },
        ]
      : [
          ...(tab === "all"
            ? [{ label: "項目", sort: "kind" as SortKey, cell: (r: Row) => <Badge tone={KIND_TONE[r.kind]}>{KIND_LABEL[r.kind]}</Badge> }]
            : []),
          { label: "果園", sort: "orchard", cell: orchardCell },
          { label: "作物／品種", sort: "fruit", cell: fruitCell },
          { label: "開始日期", sort: "start", cell: (r) => r.start, className: "whitespace-nowrap" },
          { label: "結束日期", sort: "end", cell: endCell, className: "whitespace-nowrap" },
          { label: "天數", sort: "days", cell: daysCell },
          { label: "照片", cell: photoCell },
          {
            label: "備註",
            sort: "note",
            // 全部：剪枝列沒有照片，備註前面補上工資
            cell: (r) => (r.kind === "pruning" ? [`工資 ${money(r.wage)}`, r.note].filter(Boolean).join("・") : r.note),
            className: "text-stone-500",
          },
        ];


  const head = [
    ...cols.map((c) =>
      c.sort ? (
        <button
          key={c.label}
          type="button"
          className={`inline-flex items-center gap-1 hover:text-stone-800 ${sort.key === c.sort ? "text-stone-800" : ""}`}
          onClick={() =>
            setSort((s) =>
              s.key === c.sort ? { key: c.sort, desc: !s.desc } : { key: c.sort!, desc: c.sort === "start" || c.sort === "end" },
            )
          }
        >
          {c.label}
          {sort.key === c.sort ? (sort.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ArrowUpDown size={12} className="opacity-40" />}
        </button>
      ) : (
        c.label
      ),
    ),
    "",
  ];

  const rowEl = (r: Row) => (
    <tr key={r.id} className="hover:bg-stone-50">
      {cols.map((c) => <Td key={c.label} className={c.className}>{c.cell(r)}</Td>)}
      <Td><RowActions onEdit={r.edit} onDelete={r.del} /></Td>
    </tr>
  );

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-stone-500">分組</span>
        <div className="flex gap-1 rounded-lg bg-stone-200/60 p-1">
          {groupOptions.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              className={`rounded-md px-3 py-1 ${activeGroup === g ? "bg-white font-medium text-stone-800 shadow-sm" : "text-stone-500 hover:text-stone-800"}`}
            >
              {GROUP_LABEL[g]}
            </button>
          ))}
        </div>
        <span className="text-xs text-stone-400">點表格標題可排序，再點一次反向</span>
      </div>
      <Table head={head}>
        {groups.map((g) =>
          activeGroup === "none" ? (
            g.rows.map(rowEl)
          ) : (
            <Fragment key={g.key}>
              <tr className="bg-stone-100">
                <td colSpan={cols.length + 1} className="px-4 py-2 text-sm font-semibold text-stone-700">
                  {g.label}
                  <span className="ml-2 text-xs font-normal text-stone-500">
                    {g.rows.length} 筆
                    {tab === "pruning" && `・工資小計 ${money(g.rows.reduce((s, r) => s + r.wage, 0))}`}
                  </span>
                </td>
              </tr>
              {g.rows.map(rowEl)}
            </Fragment>
          ),
        )}
        {!rows.length && (
          <tr>
            <Td colSpan={cols.length + 1} className="py-8 text-center text-stone-400">
              尚無{tab === "all" ? "" : KIND_LABEL[tab]}紀錄
            </Td>
          </tr>
        )}
      </Table>
    </>
  );
}

function PhenologyModal({ record, onClose }: { record: PhenologyRecord; onClose: () => void }) {
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
          <Button onClick={() => { upsert("phenology", r); onClose(); }}>儲存</Button>
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
        <Field label="作物">
          <ComboInput value={r.fruit} options={[...FRUITS]} onChange={(v) => set("fruit", v)} />
        </Field>
        <Field label="品種">
          <Input value={r.variety} onChange={(e) => set("variety", e.target.value)} />
        </Field>
        <div />
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
