"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { remove, upsert, useDB } from "@/lib/store";
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
  Table,
  Tabs,
  Td,
  Textarea,
  Thumb,
} from "@/components/ui";
import { KINDS, KIND_TONE, PropagationCalendar, survivalText } from "@/components/propagation-calendar";
import { RecordsToolbar, type RecordsView } from "@/components/record-calendar";

type Filter = "all" | PropagationKind;

/** 常用砧木（對應果園「待嫁接」的苗種） */
const ROOTSTOCKS = ["苦桃", "甜柿", "李子"];
/** 果樹選項：另外加「砧木」（種下去等嫁接的苗） */
const FRUIT_OPTIONS = [...FRUITS, "砧木"];

export default function PropagationPage() {
  const db = useDB();
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<PropagationRecord | null>(null);
  const orchard = (id: string) => db.orchards.find((o) => o.id === id);

  // 年度（清單、日曆、月曆一起連動）：可以走到最早有資料的年度，往後最多到今年
  const thisYear = new Date().getFullYear();
  const dataYears = db.propagation.map((r) => Number(r.date.slice(0, 4))).filter(Boolean);
  const [year, setYear] = useState(thisYear);
  const years = [...new Set([thisYear, year, ...dataYears])].sort((a, b) => b - a);
  const [view, setView] = useState<RecordsView>("list");

  const yearList = db.propagation.filter((r) => r.date.startsWith(String(year)));
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

  return (
    <>
      <PageHeader
        title="種苗／嫁接／環剝紀錄"
        desc="記錄種苗種植、嫁接與環狀剝皮的時間、株數與成活情況。"
        action={<Button onClick={() => setEditing(create())}><Plus size={16} /> 新增紀錄</Button>}
      />

      <div className="mb-5 grid grid-cols-3 gap-4">
        {KINDS.map((k) => (
          <StatCard key={k} label={`${year} 年${PROPAGATION_KINDS[k]}`} value={`${yearCount(k).toLocaleString()} 株`} />
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
        count={view === "list" && filter !== "all" ? `${PROPAGATION_KINDS[filter]} ${list.length} / ${yearList.length} 筆` : `共 ${yearList.length} 筆紀錄`}
      />

      {view !== "list" ? (
        <PropagationCalendar year={year} layout={view} onEdit={setEditing} />
      ) : (
        <>
          <Tabs<Filter>
            tabs={[{ value: "all", label: "全部" }, ...KINDS.map((k) => ({ value: k, label: PROPAGATION_KINDS[k] }))]}
            value={filter}
            onChange={setFilter}
          />
    
          <Table head={["日期", "項目", "果園", "果樹／品種", "砧木／寬度", "位置", "株數", "成活", "照片", "備註", ""]}>
            {list.map((r) => (
              <tr key={r.id} className="hover:bg-stone-50">
                <Td className="whitespace-nowrap">{r.date}</Td>
                <Td><Badge tone={KIND_TONE[r.kind]}>{PROPAGATION_KINDS[r.kind]}</Badge></Td>
                <Td className="font-medium">{orchard(r.orchardId)?.nameZh ?? "（已刪除）"}</Td>
                <Td>{[r.fruit, r.variety].filter(Boolean).join("・") || "—"}</Td>
                <Td>
                  {r.kind === "grafting" ? r.rootstock || "—" : r.kind === "girdling" && r.girdleWidth ? `${r.girdleWidth} cm` : "—"}
                </Td>
                <Td>{r.location || "—"}</Td>
                <Td>{r.count || "—"}</Td>
                <Td className="whitespace-nowrap">{survivalText(r)}</Td>
                <Td><Thumb src={r.photos[0]} photos={r.photos} showCount /></Td>
                <Td className="text-stone-500">{r.note}</Td>
                <Td><RowActions onEdit={() => setEditing(r)} onDelete={() => remove("propagation", r.id)} /></Td>
              </tr>
            ))}
            {!list.length && (
              <tr><Td colSpan={11} className="py-8 text-center text-stone-400">{year} 年尚無紀錄</Td></tr>
            )}
          </Table>
        </>
      )}
      {editing && <PropagationModal record={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function PropagationModal({ record, onClose }: { record: PropagationRecord; onClose: () => void }) {
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
          <Button onClick={() => { upsert("propagation", r); onClose(); }}>儲存</Button>
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
