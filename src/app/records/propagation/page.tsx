"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { removeWithCode, upsert, useDB, verifyCode } from "@/lib/store";
import { useCodeGate } from "@/components/code-modal";
import { SortableTable, fruitRank, zh, type GroupDef, type SortCol } from "@/components/sortable-table";
import { FRUITS, PROPAGATION_KINDS, type PropagationKind, type PropagationRecord } from "@/lib/types";
import { defaultOrchard, orchardLabel, todayStr, uid } from "@/lib/utils";
import { EmployeePicker, OrchardSelect } from "@/components/record-parts";
import {
  Badge,
  Button,
  ComboInput,
  Field,
  Input,
  Modal,
  NumInput,
  PageHeader,
  PhotoUpload,
  RowActions,
  SectionTitle,
  Select,
  StatCard,
  Tabs,
  Textarea,
  Thumb,
} from "@/components/ui";
import { KINDS, KIND_TONE, PropagationCalendar, survivalText } from "@/components/propagation-calendar";
import { ALL_YEARS, RecordsToolbar, type RecordsView } from "@/components/record-calendar";

type Filter = "all" | PropagationKind;

/** 常用砧木（對應果園「待嫁接」的苗種） */
const ROOTSTOCKS = ["苦桃", "甜柿", "李子"];
/** 果樹選項：另外加「砧木」（種下去等嫁接的苗） */
const FRUIT_OPTIONS = [...FRUITS, "砧木"];

export default function PropagationPage() {
  const db = useDB();
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<{ record: PropagationRecord; code: string } | null>(null);
  const gate = useCodeGate();

  // 年度（清單、日曆、月曆一起連動）：可以走到最早有資料的年度，往後最多到今年
  const thisYear = new Date().getFullYear();
  const dataYears = db.propagation.map((r) => Number(r.date.slice(0, 4))).filter(Boolean);
  const [year, setYearState] = useState(thisYear);
  const allYears = year === ALL_YEARS;
  const years = [...new Set([thisYear, ...(allYears ? [] : [year]), ...dataYears])].sort((a, b) => b - a);
  const [view, setViewState] = useState<RecordsView>("list");
  // 日曆、月曆一次只能看一個年度：選「全部年度」時切回清單；在全部年度切到日曆時改看今年
  const setYear = (y: number) => {
    setYearState(y);
    if (y === ALL_YEARS) setViewState("list");
  };
  const setView = (v: RecordsView) => {
    setViewState(v);
    if (v !== "list" && allYears) setYearState(thisYear);
  };
  const yearLabel = allYears ? "全部年度" : `${year} 年`;

  const yearList = db.propagation.filter((r) => allYears || r.date.startsWith(String(year)));
  const list = yearList
    .filter((r) => filter === "all" || r.kind === filter)
    .sort((a, b) => b.date.localeCompare(a.date));
  const yearCount = (k: PropagationKind) => yearList.filter((r) => r.kind === k).reduce((s, r) => s + r.count, 0);

  const create = (): PropagationRecord => ({
    id: uid(),
    kind: filter === "all" ? "planting" : filter,
    orchardId: defaultOrchard(db.orchards)?.id ?? "",
    date: todayStr(),
    fruit: FRUITS[0],
    variety: "",
    rootstock: "",
    seedlingSource: "",
    location: "",
    count: 0,
    survived: 0,
    checkDate: "",
    girdleWidth: 0,
    employeeIds: [],
    photos: [],
    note: "",
  });

  // 新增、修改、刪除都要先輸入驗證碼（後端也會再檢查）
  function edit(r: PropagationRecord) {
    const isNew = !db.propagation.some((x) => x.id === r.id);
    const label = `${PROPAGATION_KINDS[r.kind]}紀錄`;
    gate.ask({
      title: isNew ? "新增種苗／嫁接／環剝紀錄" : `修改${label}`,
      confirmLabel: "下一步",
      message: isNew ? "新增種苗／嫁接／環剝紀錄需要驗證碼。" : <>修改 <b>{r.date}</b> 的{label}需要驗證碼。</>,
      submit: async (code) => {
        const res = await verifyCode("propagation", isNew ? "create" : "update", code);
        if (res.ok) setEditing({ record: r, code });
        return res;
      },
    });
  }

  function del(r: PropagationRecord) {
    const label = `${PROPAGATION_KINDS[r.kind]}紀錄`;
    gate.ask({
      title: `刪除${label}`,
      confirmLabel: "確認刪除",
      danger: true,
      message: <>即將刪除 <b>{r.date}</b> 的{label}，無法復原。</>,
      submit: (code) => removeWithCode("propagation", r.id, code),
    });
  }

  return (
    <>
      <PageHeader
        title="種苗／嫁接／環剝紀錄"
        desc="記錄種苗種植、嫁接與環狀剝皮的時間、株數與成活情況。"
        action={<Button onClick={() => edit(create())}><Plus size={16} /> 新增紀錄</Button>}
      />

      <div className="mb-5 grid grid-cols-3 gap-4">
        {KINDS.map((k) => (
          <StatCard key={k} label={`${yearLabel}${PROPAGATION_KINDS[k]}`} value={`${yearCount(k).toLocaleString()} 株`} />
        ))}
      </div>

      <RecordsToolbar
        years={years}
        year={year}
        setYear={setYear}
        minYear={Math.min(...years)}
        maxYear={Math.max(thisYear, ...dataYears)}
        view={view}
        setView={setView}
        allowAll
        count={view === "list" && filter !== "all" ? `${PROPAGATION_KINDS[filter]} ${list.length} / ${yearList.length} 筆` : `共 ${yearList.length} 筆紀錄`}
      />

      {view !== "list" ? (
        <PropagationCalendar year={year} layout={view} onEdit={edit} />
      ) : (
        <>
          <Tabs<Filter>
            tabs={[
              { value: "all", label: `全部 (${yearList.length})` },
              ...KINDS.map((k) => ({
                value: k,
                label: `${PROPAGATION_KINDS[k]} (${yearList.filter((r) => r.kind === k).length})`,
              })),
            ]}
            value={filter}
            onChange={setFilter}
          />
    
          <PropagationTable
            rows={list}
            showKind={filter === "all"}
            allYears={allYears}
            empty={`${yearLabel}尚無${filter === "all" ? "" : PROPAGATION_KINDS[filter]}紀錄`}
            onEdit={edit}
            onDelete={del}
          />
        </>
      )}
      {gate.dialog}
      {editing && <PropagationModal record={editing.record} code={editing.code} onClose={() => setEditing(null)} />}
    </>
  );
}

/** 成活率（沒有成活資料的排最後） */
const survivalRate = (r: PropagationRecord) =>
  r.kind === "girdling" || !r.survived || !r.count ? -1 : r.survived / r.count;
const extraText = (r: PropagationRecord) =>
  r.kind === "grafting" ? r.rootstock : r.kind === "girdling" && r.girdleWidth ? `${r.girdleWidth} cm` : "";

function PropagationTable({
  rows,
  showKind,
  allYears,
  empty,
  onEdit,
  onDelete,
}: {
  rows: PropagationRecord[];
  showKind: boolean;
  allYears: boolean;
  empty: string;
  onEdit: (r: PropagationRecord) => void;
  onDelete: (r: PropagationRecord) => void;
}) {
  const db = useDB();
  const orchardIndex = (id: string) => {
    const i = db.orchards.findIndex((o) => o.id === id);
    return i < 0 ? db.orchards.length : i;
  };
  const orchardName = (id: string) => db.orchards.find((o) => o.id === id)?.nameZh ?? "（已刪除）";
  const kindIndex = (r: PropagationRecord) => KINDS.indexOf(r.kind);
  const rank = (n: number, s = ""): [number, string] => [n, s];

  const cols: SortCol<PropagationRecord>[] = [
    {
      key: "date", label: "日期", descFirst: true, className: "whitespace-nowrap",
      sort: (a, b) => a.date.localeCompare(b.date), cell: (r) => r.date,
    },
    ...(showKind
      ? [{
          key: "kind", label: "項目",
          sort: (a: PropagationRecord, b: PropagationRecord) => kindIndex(a) - kindIndex(b),
          cell: (r: PropagationRecord) => <Badge tone={KIND_TONE[r.kind]}>{PROPAGATION_KINDS[r.kind]}</Badge>,
        }]
      : []),
    {
      key: "orchard", label: "果園", className: "font-medium",
      sort: (a, b) => orchardIndex(a.orchardId) - orchardIndex(b.orchardId), cell: (r) => orchardName(r.orchardId),
    },
    {
      key: "fruit", label: "果樹／品種",
      sort: (a, b) => fruitRank(a.fruit) - fruitRank(b.fruit) || zh(a.fruit, b.fruit) || zh(a.variety, b.variety),
      cell: (r) => [r.fruit, r.variety].filter(Boolean).join("・") || "—",
    },
    { key: "extra", label: "砧木／寬度", sort: (a, b) => zh(extraText(a), extraText(b)), cell: (r) => extraText(r) || "—" },
    { key: "location", label: "位置", sort: (a, b) => zh(a.location, b.location), cell: (r) => r.location || "—" },
    { key: "count", label: "株數", descFirst: true, sort: (a, b) => a.count - b.count, cell: (r) => r.count || "—" },
    {
      key: "survival", label: "成活", descFirst: true, className: "whitespace-nowrap",
      sort: (a, b) => survivalRate(a) - survivalRate(b), cell: survivalText,
    },
    { key: "photos", label: "照片", cell: (r) => <Thumb src={r.photos[0]} photos={r.photos} showCount /> },
    { key: "note", label: "備註", className: "text-stone-500", sort: (a, b) => zh(a.note, b.note), cell: (r) => r.note },
  ];

  const groups: GroupDef<PropagationRecord>[] = [
    // 全部年度時可以依年度分組（新的年度在前）
    ...(allYears
      ? [{
          value: "year", label: "年度",
          of: (r: PropagationRecord) => {
            const y = r.date.slice(0, 4);
            return { key: y, label: y ? `${y} 年` : "未填日期", rank: rank(y ? -Number(y) : 0) };
          },
        }]
      : []),
    { value: "orchard", label: "果園", of: (r) => ({ key: r.orchardId, label: orchardName(r.orchardId), rank: rank(orchardIndex(r.orchardId)) }) },
    { value: "fruit", label: "果樹", of: (r) => ({ key: r.fruit, label: r.fruit || "未填果樹", rank: rank(fruitRank(r.fruit), r.fruit) }) },
    {
      value: "fruitVariety", label: "果樹／品種",
      of: (r) => ({
        key: `${r.fruit}|${r.variety}`,
        label: [r.fruit, r.variety].filter(Boolean).join("／") || "未填果樹",
        rank: rank(fruitRank(r.fruit), `${r.fruit}|${r.variety}`),
      }),
    },
    { value: "location", label: "位置", of: (r) => ({ key: r.location, label: r.location || "未填位置", rank: rank(r.location ? 0 : 1, r.location) }) },
    // 只有「全部」才能依項目分組
    ...(showKind
      ? [{
          value: "kind", label: "項目",
          of: (r: PropagationRecord) => ({ key: r.kind, label: PROPAGATION_KINDS[r.kind], rank: rank(kindIndex(r)) }),
        }]
      : []),
  ];

  return (
    <SortableTable
      rows={rows}
      cols={cols}
      groups={groups}
      rowKey={(r) => r.id}
      actions={(r) => <RowActions confirm={false} onEdit={() => onEdit(r)} onDelete={() => onDelete(r)} />}
      empty={empty}
      summary={(list) => `${list.reduce((s, r) => s + r.count, 0).toLocaleString()} 株`}
      defaultSort={{ key: "date", desc: true }}
      tiebreak={(a, b) => b.date.localeCompare(a.date)}
      searchText={(r) =>
        [
          PROPAGATION_KINDS[r.kind], orchardName(r.orchardId), r.fruit, r.variety, r.rootstock, r.seedlingSource,
          r.location, r.date, r.checkDate, extraText(r), r.note,
          ...r.employeeIds.map((id) => db.employees.find((e) => e.id === id)?.name),
        ].join(" ")
      }
      searchPlaceholder="關鍵字：果園、果樹、品種、砧木、位置、日期、人員、備註…"
    />
  );
}

function PropagationModal({ record, code, onClose }: { record: PropagationRecord; code: string; onClose: () => void }) {
  const db = useDB();
  const [r, setR] = useState(record);
  const set = <K extends keyof PropagationRecord>(k: K, v: PropagationRecord[K]) => setR((p) => ({ ...p, [k]: v }));
  const label = PROPAGATION_KINDS[r.kind];

  // 參考過去同項目的紀錄：選果園＋年份＋日期後，把內容帶入目前表單（不會存進資料庫）
  const [refOrchard, setRefOrchard] = useState(record.orchardId || defaultOrchard(db.orchards)?.id || "");
  const [refId, setRefId] = useState("");
  const [refYear, setRefYear] = useState(""); // YYYY，空白＝全部
  const orchardRecords = db.propagation.filter(
    (x) => x.orchardId === refOrchard && x.kind === r.kind && x.id !== record.id,
  );
  const refYears = [...new Set(orchardRecords.map((x) => x.date.slice(0, 4)).filter(Boolean))].sort().reverse();
  const refRecords = orchardRecords
    .filter((x) => x.date.startsWith(refYear))
    .sort((a, b) => b.date.localeCompare(a.date));

  function applyRef() {
    const src = refRecords.find((x) => x.id === refId);
    if (!src) return;
    if ((r.variety || r.count || r.note) && !window.confirm("要用參考紀錄的內容取代目前已填的內容嗎？")) return;
    // 照片與成活結果是那一次作業自己的，不帶入
    setR((p) => ({
      ...p,
      fruit: src.fruit,
      variety: src.variety,
      rootstock: src.rootstock,
      seedlingSource: src.seedlingSource,
      location: src.location,
      count: src.count,
      girdleWidth: src.girdleWidth,
      employeeIds: [...src.employeeIds],
      note: src.note,
    }));
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={`${label}紀錄`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={() => { upsert("propagation", r, { code }); onClose(); }}>儲存</Button>
        </>
      }
    >
      <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1.5fr_auto]">
          <Field label="參考果園">
            <Select value={refOrchard} onChange={(e) => { setRefOrchard(e.target.value); setRefYear(""); setRefId(""); }}>
              {db.orchards.map((o) => <option key={o.id} value={o.id}>{orchardLabel(o)}</option>)}
            </Select>
          </Field>
          <Field label="年份">
            <Select value={refYear} onChange={(e) => { setRefYear(e.target.value); setRefId(""); }}>
              <option value="">全部</option>
              {refYears.map((y) => <option key={y} value={y}>{y} 年</option>)}
            </Select>
          </Field>
          <Field label="參考日期">
            <Select value={refId} onChange={(e) => setRefId(e.target.value)} disabled={!refRecords.length}>
              <option value="">
                {refRecords.length
                  ? `請選擇要參考的${label}紀錄`
                  : refYear ? `這個年份沒有${label}紀錄` : `此果園尚無${label}紀錄`}
              </option>
              {refRecords.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.date}・{[x.fruit, x.variety].filter(Boolean).join(" ") || "未填果樹"}
                  {x.count ? `・${x.count} 株` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Button variant="secondary" onClick={applyRef} disabled={!refId}>帶入</Button>
        </div>
        <p className="mt-2 text-xs text-stone-500">
          帶入果樹、品種、{r.kind === "grafting" ? "砧木、" : r.kind === "planting" ? "苗木來源、" : "環剝寬度、"}
          位置、株數、人員與備註，帶入後可再手動調整；果園、日期、成活結果與照片不會被覆蓋。
        </p>
      </div>

      <SectionTitle>基本資料</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="項目">
          <Select
            value={r.kind}
            onChange={(e) => { set("kind", e.target.value as PropagationKind); setRefYear(""); setRefId(""); }}
          >
            {KINDS.map((k) => <option key={k} value={k}>{PROPAGATION_KINDS[k]}</option>)}
          </Select>
        </Field>
        <OrchardSelect value={r.orchardId} onChange={(v) => set("orchardId", v)} />
        <Field label={`${label}日期`}>
          <Input type="date" value={r.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
        <Field label="果樹">
          <ComboInput value={r.fruit} options={FRUIT_OPTIONS} onChange={(v) => set("fruit", v)} />
        </Field>
        <Field label={r.kind === "grafting" ? "接穗品種" : "品種"}>
          <Input value={r.variety} onChange={(e) => set("variety", e.target.value)} />
        </Field>
        <Field label="區塊／位置">
          <Input value={r.location} placeholder="例如：上方第 3 排" onChange={(e) => set("location", e.target.value)} />
        </Field>
      </div>

      <SectionTitle>{label}內容</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="株數">
          <NumInput value={r.count} onChange={(v) => set("count", v)} />
        </Field>
        {r.kind === "planting" && (
          <Field label="苗木來源">
            <Input value={r.seedlingSource} placeholder="苗圃／店家" onChange={(e) => set("seedlingSource", e.target.value)} />
          </Field>
        )}
        {r.kind === "grafting" && (
          <Field label="砧木">
            <ComboInput value={r.rootstock} options={ROOTSTOCKS} onChange={(v) => set("rootstock", v)} />
          </Field>
        )}
        {r.kind === "girdling" && (
          <Field label="環剝寬度（cm）">
            <NumInput value={r.girdleWidth} onChange={(v) => set("girdleWidth", v)} />
          </Field>
        )}
        {r.kind !== "girdling" && (
          <>
            <Field label="成活檢查日期">
              <Input type="date" value={r.checkDate} onChange={(e) => set("checkDate", e.target.value)} />
            </Field>
            <Field label="成活株數">
              <NumInput value={r.survived} onChange={(v) => set("survived", v)} />
            </Field>
            <div className="pb-2 text-sm text-stone-500 sm:self-end">成活率：{survivalText(r)}</div>
          </>
        )}
      </div>

      <div className="mt-4">
        <EmployeePicker value={r.employeeIds} onChange={(v) => set("employeeIds", v)} />
      </div>

      <SectionTitle>照片與備註</SectionTitle>
      <div className="space-y-4">
        <PhotoUpload value={r.photos} onChange={(v) => set("photos", v)} folder="propagation" />
        <Field label="備註">
          <Textarea value={r.note} onChange={(e) => set("note", e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
