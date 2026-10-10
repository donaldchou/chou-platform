"use client";

import { Fragment, useState, useSyncExternalStore } from "react";
import { ExternalLink, LayoutGrid, List, Pencil, Play, Plus, Search, Star, Trash2, X } from "lucide-react";
import { removeWithCode, upsert, useDB, verifyCode } from "@/lib/store";
import { useCodeGate } from "@/components/code-modal";
import { KNOWLEDGE_KINDS, type KnowledgeItem, type KnowledgeKind } from "@/lib/types";
import { photoSrc, todayStr, uid } from "@/lib/utils";
import {
  Badge,
  Button,
  ComboInput,
  EditOnly,
  Empty,
  Field,
  Gallery,
  Input,
  Modal,
  PageHeader,
  PhotoUpload,
  SectionTitle,
  Select,
  Table,
  Tabs,
  Td,
  Textarea,
  type Tone,
} from "@/components/ui";

type Filter = "all" | KnowledgeKind;
type Layout = "card" | "list";

/* ---------------- 顯示方式（卡片／清單），記在這台電腦的瀏覽器 ---------------- */
const LAYOUT_KEY = "chou-knowledge-layout";
const layoutListeners = new Set<() => void>();
let memoryLayout: Layout | null = null;

function readLayout(): Layout {
  if (memoryLayout) return memoryLayout;
  try {
    return localStorage.getItem(LAYOUT_KEY) === "list" ? "list" : "card";
  } catch {
    return "card";
  }
}

function writeLayout(v: Layout) {
  try {
    localStorage.setItem(LAYOUT_KEY, v);
  } catch {
    // 無法儲存（例如無痕模式）時，只在這次瀏覽有效
  }
  memoryLayout = v;
  layoutListeners.forEach((l) => l());
}

function useLayout(): [Layout, (v: Layout) => void] {
  const layout = useSyncExternalStore(
    (l) => {
      layoutListeners.add(l);
      return () => layoutListeners.delete(l);
    },
    readLayout,
    () => "card" as Layout,
  );
  return [layout, writeLayout];
}

const KINDS = Object.keys(KNOWLEDGE_KINDS) as KnowledgeKind[];

const KIND_TONE: Record<KnowledgeKind, Tone> = {
  ai: "blue",
  web: "gray",
  video: "red",
  info: "amber",
  experience: "green",
};

/** 常用分類；另外會列出已經用過的分類 */
const DEFAULT_CATEGORIES = ["噴藥", "施肥", "病蟲害", "剪枝", "嫁接", "套袋", "採收", "果園管理", "人員管理", "財務", "機具設備"];

/** 從各種 YouTube 網址取出影片 id 與開始秒數；不是 YouTube 網址回傳 null */
function parseYouTube(url: string): { id: string; start: number } | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  let id = "";
  if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:shorts|embed|live|v)\/([^/]+)/)?.[1] ?? "";
  }
  if (!/^[\w-]{11}$/.test(id)) return null;
  // t=90、t=1m30s、start=90
  const t = u.searchParams.get("t") ?? u.searchParams.get("start") ?? "";
  const m = t.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  const start = m ? Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0) : 0;
  return { id, start };
}

const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

/** 卡片封面：第一張照片，沒有照片就用第一部影片的縮圖 */
function cover(k: KnowledgeItem) {
  if (k.photos[0]) return { src: photoSrc(k.photos[0]), video: false };
  const yt = k.videos.map(parseYouTube).find(Boolean);
  return yt ? { src: ytThumb(yt.id), video: true } : null;
}

export default function KnowledgePage() {
  const db = useDB();
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ item: KnowledgeItem; code: string } | null>(null);
  const [layout, setLayout] = useLayout();
  const gate = useCodeGate();

  // 新增、修改、刪除都要先輸入驗證碼（後端也會再檢查）
  function edit(k: KnowledgeItem) {
    const isNew = !db.knowledge.some((x) => x.id === k.id);
    gate.ask({
      title: isNew ? "新增知識" : "編輯知識",
      confirmLabel: "下一步",
      message: isNew ? "新增知識需要驗證碼。" : <>編輯「<b>{k.title}</b>」需要驗證碼。</>,
      submit: async (code) => {
        const res = await verifyCode("knowledge", isNew ? "create" : "update", code);
        if (res.ok) {
          setViewId(null);
          setEditing({ item: k, code });
        }
        return res;
      },
    });
  }

  function del(k: KnowledgeItem) {
    gate.ask({
      title: "刪除知識",
      confirmLabel: "確認刪除",
      danger: true,
      message: <>即將刪除「<b>{k.title}</b>」，無法復原。</>,
      submit: async (code) => {
        const res = await removeWithCode("knowledge", k.id, code);
        if (res.ok) setViewId(null);
        return res;
      },
    });
  }

  const categories = [...new Set(db.knowledge.map((k) => k.category).filter(Boolean))].sort();
  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list = db.knowledge
    .filter((k) => filter === "all" || k.kind === filter)
    .filter((k) => !category || k.category === category)
    .filter((k) => {
      const text = [k.title, k.category, k.source, k.question, k.content].join(" ").toLowerCase();
      return terms.every((t) => text.includes(t));
    })
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.date.localeCompare(a.date));
  const count = (f: Filter) => (f === "all" ? db.knowledge.length : db.knowledge.filter((k) => k.kind === f).length);
  const viewing = db.knowledge.find((k) => k.id === viewId);

  const create = (): KnowledgeItem => ({
    id: uid(),
    kind: filter === "all" ? "ai" : filter,
    title: "",
    category: category,
    date: todayStr(),
    source: "",
    sourceUrl: "",
    question: "",
    content: "",
    videos: filter === "video" ? [""] : [],
    photos: [],
    pinned: false,
  });

  return (
    <>
      <PageHeader
        title="知識管理"
        desc="備份 AI 問答與網路文章、收藏 YouTube 影片，整理重要資訊與歷年管理經驗。"
        action={<Button onClick={() => edit(create())}><Plus size={16} /> 新增知識</Button>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_14rem_auto]">
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜尋標題、內容、問題、來源…（空白分隔可多個關鍵字）"
            className="pl-9"
          />
        </div>
        <Select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">全部分類</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <div className="flex justify-self-end rounded-lg border border-stone-300 bg-white p-0.5" role="group" aria-label="顯示方式">
          {(
            [
              { v: "list", label: "清單", icon: List },
              { v: "card", label: "卡片", icon: LayoutGrid },
            ] as const
          ).map(({ v, label, icon: Icon }) => (
            <button
              key={v}
              onClick={() => setLayout(v)}
              aria-pressed={layout === v}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                layout === v ? "bg-emerald-700 text-white" : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </div>

      <Tabs<Filter>
        tabs={[
          { value: "all", label: `全部 (${count("all")})` },
          ...KINDS.map((k) => ({ value: k, label: `${KNOWLEDGE_KINDS[k]} (${count(k)})` })),
        ]}
        value={filter}
        onChange={setFilter}
      />

      {!list.length ? (
        <Empty>{db.knowledge.length ? "找不到符合條件的資料" : "還沒有任何知識，按「新增知識」開始建立。"}</Empty>
      ) : layout === "list" ? (
        <KnowledgeTable list={list} onOpen={(k) => setViewId(k.id)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((k) => (
            <KnowledgeCard key={k.id} item={k} onOpen={() => setViewId(k.id)} />
          ))}
        </div>
      )}

      {viewing && (
        <KnowledgeView
          item={viewing}
          onClose={() => setViewId(null)}
          onEdit={() => edit(viewing)}
          onDelete={() => del(viewing)}
        />
      )}
      {gate.dialog}
      {editing && (
        <KnowledgeModal
          item={editing.item}
          code={editing.code}
          categories={[...new Set([...DEFAULT_CATEGORIES, ...categories])]}
          onClose={() => setEditing(null)}
          onSaved={(id) => { setEditing(null); setViewId(id); }}
        />
      )}
    </>
  );
}

function KnowledgeCard({ item: k, onOpen }: { item: KnowledgeItem; onOpen: () => void }) {
  const c = cover(k);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md"
    >
      {c && (
        <div className="relative aspect-video w-full bg-stone-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c.src} alt="" className="h-full w-full object-cover" loading="lazy" />
          {c.video && (
            <span className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-600/90 text-white shadow-lg">
                <Play size={22} fill="currentColor" />
              </span>
            </span>
          )}
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {k.pinned && <Star size={16} className="text-amber-500" fill="currentColor" aria-label="重要" />}
          <Badge tone={KIND_TONE[k.kind]}>{KNOWLEDGE_KINDS[k.kind]}</Badge>
          {k.category && <Badge>{k.category}</Badge>}
        </div>
        <h3 className="line-clamp-2 text-base font-semibold text-stone-900">{k.title}</h3>
        {(k.question || k.content) && (
          <p className="line-clamp-3 text-sm text-stone-500">{plain(k.question || k.content)}</p>
        )}
        <div className="mt-auto pt-1 text-xs text-stone-400">
          {[k.date, k.source].filter(Boolean).join("・")}
          {k.photos.length > 0 && `・${k.photos.length} 張照片`}
          {k.videos.length > 1 && `・${k.videos.length} 部影片`}
        </div>
      </div>
    </button>
  );
}

function KnowledgeTable({ list, onOpen }: { list: KnowledgeItem[]; onOpen: (k: KnowledgeItem) => void }) {
  return (
    <Table head={["", "日期", "類型", "標題", "分類", "來源", "影片／照片"]}>
      {list.map((k) => {
        const c = cover(k);
        return (
          <tr key={k.id} onClick={() => onOpen(k)} className="cursor-pointer hover:bg-stone-50">
            <Td className="w-20">
              {c ? (
                <div className="relative h-10 w-16 overflow-hidden rounded bg-stone-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.src} alt="" className="h-full w-full object-cover" loading="lazy" />
                  {c.video && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <Play size={14} className="text-white drop-shadow" fill="currentColor" />
                    </span>
                  )}
                </div>
              ) : (
                <div className="h-10 w-16 rounded bg-stone-100" />
              )}
            </Td>
            <Td className="whitespace-nowrap text-stone-500">{k.date || "—"}</Td>
            <Td><Badge tone={KIND_TONE[k.kind]}>{KNOWLEDGE_KINDS[k.kind]}</Badge></Td>
            <Td>
              <div className="flex items-center gap-1.5 font-medium text-stone-900">
                {k.pinned && <Star size={14} className="shrink-0 text-amber-500" fill="currentColor" aria-label="重要" />}
                {k.title}
              </div>
              {(k.question || k.content) && (
                <div className="mt-0.5 line-clamp-1 text-xs text-stone-500">{plain(k.question || k.content)}</div>
              )}
            </Td>
            <Td className="whitespace-nowrap">{k.category || "—"}</Td>
            <Td className="whitespace-nowrap text-stone-500">{k.source || "—"}</Td>
            <Td className="whitespace-nowrap text-stone-500">
              {[k.videos.length && `${k.videos.length} 部影片`, k.photos.length && `${k.photos.length} 張照片`]
                .filter(Boolean)
                .join("・") || "—"}
            </Td>
          </tr>
        );
      })}
    </Table>
  );
}

/** 卡片摘要用：拿掉 Markdown 符號 */
const plain = (s: string) => s.replace(/[#*`>|]|[-=_]{3,}/g, "").replace(/\s+/g, " ").trim();

function KnowledgeView({
  item: k,
  onClose,
  onEdit,
  onDelete,
}: {
  item: KnowledgeItem;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const videos = k.videos.map((url) => ({ url, yt: parseYouTube(url) })).filter((v) => v.url);
  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={k.title}
      footer={
        <>
          <EditOnly>
            <Button
              variant="secondary"
              className="mr-auto text-red-600"
              onClick={onDelete}
            >
              <Trash2 size={16} /> 刪除
            </Button>
            <Button variant="secondary" onClick={onEdit}><Pencil size={16} /> 編輯</Button>
          </EditOnly>
          <Button onClick={onClose}>關閉</Button>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-stone-500">
        {k.pinned && <Badge tone="amber">★ 重要</Badge>}
        <Badge tone={KIND_TONE[k.kind]}>{KNOWLEDGE_KINDS[k.kind]}</Badge>
        {k.category && <Badge>{k.category}</Badge>}
        {k.date && <span>{k.date}</span>}
        {k.source && <span>・來源：{k.source}</span>}
        {k.sourceUrl && (
          <a href={k.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-700 hover:underline">
            開啟原文 <ExternalLink size={14} />
          </a>
        )}
      </div>

      {videos.length > 0 && (
        <div className="mb-5 space-y-4">
          {videos.map((v, i) =>
            v.yt ? (
              <div key={i} className="aspect-video w-full overflow-hidden rounded-xl bg-black">
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${v.yt.id}?rel=0${v.yt.start ? `&start=${v.yt.start}` : ""}`}
                  title={`${k.title}（影片 ${i + 1}）`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              </div>
            ) : (
              <a key={i} href={v.url} target="_blank" rel="noreferrer" className="block break-all text-emerald-700 hover:underline">
                {v.url}
              </a>
            ),
          )}
        </div>
      )}

      {k.question && (
        <div className="mb-5 rounded-xl border border-sky-200 bg-sky-50/60 p-4">
          <div className="mb-1 text-xs font-semibold text-sky-700">我的提問</div>
          <div className="whitespace-pre-wrap text-sm text-stone-800">{k.question}</div>
        </div>
      )}

      {k.content && (
        <div className="rounded-xl border border-stone-200 bg-white p-5">
          <RichText text={k.content} />
        </div>
      )}

      {k.photos.length > 0 && (
        <>
          <SectionTitle>照片</SectionTitle>
          <Gallery photos={k.photos} size="h-28 w-28" />
        </>
      )}
    </Modal>
  );
}

/** code：打開前已驗證過的驗證碼，儲存時送給後端 */
function KnowledgeModal({
  item,
  code,
  categories,
  onClose,
  onSaved,
}: {
  item: KnowledgeItem;
  code: string;
  categories: string[];
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const [k, setK] = useState(item);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof KnowledgeItem>(key: K, v: KnowledgeItem[K]) => setK((p) => ({ ...p, [key]: v }));
  const setVideo = (i: number, v: string) => set("videos", k.videos.map((x, j) => (j === i ? v : x)));

  async function save() {
    if (!k.title.trim()) return alert("請填寫標題");
    const videos = k.videos.map((v) => v.trim()).filter(Boolean);
    if (videos.some((v) => !parseYouTube(v)) && !confirm("有影片連結不是 YouTube 網址，無法直接播放，仍要儲存嗎？")) return;
    setSaving(true);
    const ok = await upsert("knowledge", { ...k, title: k.title.trim(), videos }, { code });
    setSaving(false);
    if (ok) onSaved(k.id);
  }

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={item.title ? "編輯知識" : "新增知識"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={save} disabled={saving}>{saving ? "儲存中…" : "儲存"}</Button>
        </>
      }
    >
      <SectionTitle>基本資料</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="類型">
          <Select value={k.kind} onChange={(e) => set("kind", e.target.value as KnowledgeKind)}>
            {KINDS.map((x) => <option key={x} value={x}>{KNOWLEDGE_KINDS[x]}</option>)}
          </Select>
        </Field>
        <Field label="分類">
          <ComboInput value={k.category} options={categories} placeholder="例如：噴藥" onChange={(v) => set("category", v)} />
        </Field>
        <Field label="日期">
          <Input type="date" value={k.date} onChange={(e) => set("date", e.target.value)} />
        </Field>
        <Field label="標題" className="sm:col-span-3">
          <Input value={k.title} onChange={(e) => set("title", e.target.value)} placeholder="一句話說明這篇在講什麼" />
        </Field>
        <Field label={k.kind === "ai" ? "使用的 AI" : "來源／作者"}>
          {k.kind === "ai" ? (
            <ComboInput value={k.source} options={["ChatGPT", "Gemini", "Claude", "Copilot"]} onChange={(v) => set("source", v)} />
          ) : (
            <Input value={k.source} onChange={(e) => set("source", e.target.value)} placeholder="網站、頻道、書名或人名" />
          )}
        </Field>
        <Field label="原文網址" className="sm:col-span-2">
          <Input type="url" value={k.sourceUrl} onChange={(e) => set("sourceUrl", e.target.value)} placeholder="https://…" />
        </Field>
      </div>
      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm text-stone-700">
        <input
          type="checkbox"
          checked={k.pinned}
          onChange={(e) => set("pinned", e.target.checked)}
          className="h-4 w-4 accent-amber-500"
        />
        <Star size={16} className="text-amber-500" fill="currentColor" /> 標為重要（排在最前面）
      </label>

      {k.kind === "ai" && (
        <>
          <SectionTitle>我的提問</SectionTitle>
          <Textarea value={k.question} onChange={(e) => set("question", e.target.value)} placeholder="當時問 AI 的問題" />
        </>
      )}

      <SectionTitle>{k.kind === "ai" ? "AI 回答" : k.kind === "experience" ? "經驗內容" : "內容"}</SectionTitle>
      <Textarea
        rows={14}
        value={k.content}
        onChange={(e) => set("content", e.target.value)}
        placeholder="直接貼上文章或 AI 的回答。支援 # 標題、**粗體**、- 清單、| 表格 |，網址會自動變成連結。"
      />

      <SectionTitle>YouTube 影片</SectionTitle>
      <div className="space-y-2">
        {k.videos.map((v, i) => {
          const yt = v.trim() ? parseYouTube(v) : null;
          return (
            <div key={i} className="flex items-center gap-2">
              {yt ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={ytThumb(yt.id)} alt="" className="h-10 w-16 shrink-0 rounded object-cover" />
              ) : (
                <div className="h-10 w-16 shrink-0 rounded bg-stone-100" />
              )}
              <div className="flex-1">
                <Input value={v} onChange={(e) => setVideo(i, e.target.value)} placeholder="https://www.youtube.com/watch?v=…" />
                {v.trim() && !yt && <p className="mt-1 text-xs text-red-600">無法辨識的 YouTube 連結</p>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label="移除影片"
                onClick={() => set("videos", k.videos.filter((_, j) => j !== i))}
              >
                <X size={16} />
              </Button>
            </div>
          );
        })}
        <Button variant="secondary" size="sm" onClick={() => set("videos", [...k.videos, ""])}>
          <Plus size={14} /> 新增影片連結
        </Button>
      </div>

      <SectionTitle>照片</SectionTitle>
      <PhotoUpload value={k.photos} onChange={(v) => set("photos", v)} max={20} folder="knowledge" />
    </Modal>
  );
}

/* ---------------- 簡易 Markdown 顯示（AI 回答常見的格式） ---------------- */

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|https?:\/\/[^\s)）」，。]+)/g;

function inline(text: string) {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return <code key={i} className="rounded bg-stone-100 px-1 text-[0.9em]">{part.slice(1, -1)}</code>;
    if (/^https?:\/\//.test(part))
      return <a key={i} href={part} target="_blank" rel="noreferrer" className="break-all text-emerald-700 hover:underline">{part}</a>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

const cells = (line: string) => line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());

function RichText({ text }: { text: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: React.ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const key = out.length;
    // 程式碼區塊
    if (line.trim().startsWith("```")) {
      const code: string[] = [];
      while (++i < lines.length && !lines[i].trim().startsWith("```")) code.push(lines[i]);
      out.push(<pre key={key} className="overflow-x-auto rounded-lg bg-stone-100 p-3 text-xs">{code.join("\n")}</pre>);
      continue;
    }
    // 表格：連續以 | 開頭的行
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      for (; i < lines.length && lines[i].trim().startsWith("|"); i++) {
        if (!/^\|?[\s:|-]+\|?$/.test(lines[i].trim())) rows.push(cells(lines[i]));
      }
      i--;
      if (!rows.length) continue;
      const [head, ...body] = rows;
      out.push(
        <div key={key} className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>{head.map((c, j) => <th key={j} className="border border-stone-200 bg-stone-50 px-3 py-1.5 text-left font-semibold">{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri}>{r.map((c, j) => <td key={j} className="border border-stone-200 px-3 py-1.5 align-top">{inline(c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const size = h[1].length === 1 ? "text-xl" : h[1].length === 2 ? "text-lg" : "text-base";
      out.push(<div key={key} className={`${size} mt-2 font-bold text-stone-900`}>{inline(h[2])}</div>);
      continue;
    }
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      out.push(<hr key={key} className="border-stone-200" />);
      continue;
    }
    const li = line.match(/^(\s*)([-*•]|\d+[.)、])\s+(.*)$/);
    if (li) {
      const bullet = /\d/.test(li[2]) ? li[2] : "•";
      out.push(
        <div key={key} className="flex gap-2" style={{ paddingLeft: `${Math.min(li[1].length, 8) * 0.5}rem` }}>
          <span className="shrink-0 text-stone-400">{bullet}</span>
          <span>{inline(li[3])}</span>
        </div>,
      );
      continue;
    }
    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      out.push(<div key={key} className="border-l-4 border-stone-300 pl-3 text-stone-600">{inline(quote[1])}</div>);
      continue;
    }
    out.push(line.trim() ? <p key={key}>{inline(line)}</p> : <div key={key} className="h-2" />);
  }
  return <div className="space-y-1.5 text-sm leading-relaxed text-stone-800">{out}</div>;
}
