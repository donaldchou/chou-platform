"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Pencil, Trash2, X } from "lucide-react";
import { Lightbox } from "./lightbox";
import { photoSrc, uploadPhoto } from "@/lib/utils";

export { Lightbox };

export const inputCls =
  "w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 placeholder:text-stone-400 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/20 disabled:bg-stone-100";

export function PageHeader({
  title,
  desc,
  action,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{title}</h1>
        {desc && <p className="mt-1 text-sm text-stone-500">{desc}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-stone-200 bg-white p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold text-stone-800">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

type BtnVariant = "primary" | "secondary" | "danger" | "ghost";
const btnStyles: Record<BtnVariant, string> = {
  primary: "bg-emerald-700 text-white hover:bg-emerald-800",
  secondary: "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
  ghost: "text-stone-600 hover:bg-stone-100",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: BtnVariant;
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50 ${
        size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-4 py-2 text-sm"
      } ${btnStyles[variant]} ${className}`}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
  className = "",
  group = false,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Render as a div (for chip groups / multiple controls) instead of a <label>. */
  group?: boolean;
}) {
  const Tag = group ? "div" : "label";
  return (
    <Tag className={`block ${className}`}>
      <span className="mb-1 block text-sm font-medium text-stone-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-500">{hint}</span>}
    </Tag>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function NumInput({
  value,
  onChange,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      min={0}
      {...props}
      value={value === 0 ? "" : value}
      placeholder={props.placeholder ?? "0"}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      className={`${inputCls} ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${inputCls} ${props.className ?? ""}`} />;
}

const tones = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  amber: "bg-amber-50 text-amber-800 ring-amber-600/30",
  red: "bg-red-50 text-red-700 ring-red-600/20",
  gray: "bg-stone-100 text-stone-600 ring-stone-500/20",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
};
export type Tone = keyof typeof tones;

export function Badge({ tone = "gray", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div
        className={`flex max-h-[95vh] w-full flex-col rounded-t-2xl bg-stone-50 shadow-xl sm:rounded-2xl ${
          wide ? "sm:max-w-4xl" : "sm:max-w-xl"
        }`}
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-stone-500 hover:bg-stone-200" aria-label="關閉">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-stone-200 px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
}

export function ChipSelect({
  options,
  value,
  onChange,
  empty = "尚無可選項目",
}: {
  options: { value: string; label: string }[];
  value: string[];
  onChange: (v: string[]) => void;
  empty?: string;
}) {
  if (!options.length) return <p className="text-sm text-stone-400">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={`rounded-full border px-3 py-1 text-sm transition-colors ${
              on
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-stone-300 bg-white text-stone-700 hover:border-emerald-500"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="mb-5 flex gap-1 overflow-x-auto rounded-xl bg-stone-200/60 p-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          onClick={() => onChange(t.value)}
          className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            value === t.value ? "bg-white text-emerald-800 shadow-sm" : "text-stone-600 hover:text-stone-900"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-sm text-stone-500">
        {label}
        {icon && <span className="text-emerald-700">{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-bold text-stone-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-stone-500">{sub}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-white/60 p-10 text-center text-sm text-stone-500">
      {children}
    </div>
  );
}

export function PhotoUpload({
  value,
  onChange,
  max = 8,
  folder = "photos",
}: {
  value: string[];
  onChange: (v: string[]) => void;
  max?: number;
  /** Vercel Blob 裡的資料夾名稱，例如 orchards、bills */
  folder?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    const results = await Promise.allSettled(
      [...files].slice(0, max - value.length).map((f) => uploadPhoto(f, folder)),
    );
    setBusy(false);
    const urls = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    if (urls.length) onChange([...value, ...urls]);
    if (failed.length) alert(`${failed.length} 張照片上傳失敗：${failed[0].reason?.message ?? failed[0].reason}`);
    if (ref.current) ref.current.value = "";
  }

  return (
    <div className="flex flex-wrap gap-2">
      {value.map((src, i) => (
        <div key={i} className="group relative h-20 w-20 overflow-hidden rounded-lg border border-stone-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoSrc(src)} alt="" className="h-full w-full cursor-zoom-in object-cover" onClick={() => setPreview(i)} />
          <button
            type="button"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
            aria-label="移除照片"
          >
            <X size={14} />
          </button>
        </div>
      ))}
      {value.length < max && (
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={busy}
          className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-stone-300 text-xs text-stone-500 hover:border-emerald-500 hover:text-emerald-700 disabled:cursor-wait disabled:opacity-60"
        >
          <ImagePlus size={20} />
          {busy ? "上傳中…" : "上傳照片"}
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple={max > 1}
        hidden
        onChange={(e) => onFiles(e.target.files)}
      />
      {preview !== null && <Lightbox photos={value} start={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}

/**
 * 縮圖，點了放大。傳入 photos（同一組的所有照片）時，放大後可以切換到其他照片；
 * 有多張時右下角顯示張數。
 */
export function Thumb({
  src,
  photos,
  className = "h-10 w-10",
  showCount = false,
}: {
  src?: string;
  photos?: string[];
  className?: string;
  showCount?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!src) return <div className={`${className} rounded-md bg-stone-100`} />;
  const list = photos?.length ? photos : [src];
  const start = Math.max(0, list.indexOf(src));
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="relative block shrink-0 cursor-zoom-in"
        aria-label={list.length > 1 ? `檢視照片（共 ${list.length} 張）` : "檢視照片"}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoSrc(src)} alt="" className={`${className} rounded-md object-cover`} />
        {showCount && list.length > 1 && (
          <span className="absolute -bottom-1 -right-1 rounded-full bg-stone-700 px-1 text-[10px] leading-4 text-white">
            {list.length}
          </span>
        )}
      </button>
      {open && <Lightbox photos={list} start={start} onClose={() => setOpen(false)} />}
    </>
  );
}
export function Gallery({ photos, size = "h-20 w-20" }: { photos: string[]; size?: string }) {
  if (!photos.length) return <span className="text-sm text-stone-400">無照片</span>;
  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((p, i) => (
        <Thumb key={i} src={p} photos={photos} className={size} />
      ))}
    </div>
  );
}

export function Table({ head, children }: { head: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-stone-50 text-xs text-stone-500">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="whitespace-nowrap px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({
  children,
  className = "",
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={`px-4 py-3 align-middle ${className || "text-stone-700"}`}>
      {children}
    </td>
  );
}

/** Edit / delete buttons for a table row. */
export function RowActions({
  onEdit,
  onDelete,
  confirm = true,
}: {
  onEdit: () => void;
  onDelete: () => void;
  /** false：不跳出瀏覽器確認框（由 onDelete 自己處理，例如驗證碼對話框） */
  confirm?: boolean;
}) {
  return (
    <div className="flex justify-end">
      <Button size="sm" variant="ghost" onClick={onEdit} title="編輯">
        <Pencil size={14} />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="text-red-600"
        onClick={() => (!confirm || confirmDelete()) && onDelete()}
        title="刪除"
      >
        <Trash2 size={14} />
      </Button>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-3 mt-6 border-l-4 border-emerald-600 pl-2 text-sm font-semibold text-stone-800 first:mt-0">
      {children}
    </h3>
  );
}

export function confirmDelete(what = "這筆資料") {
  return window.confirm(`確定要刪除${what}嗎？此動作無法復原。`);
}

export function BarChart({
  data,
  format = (n: number) => n.toLocaleString("zh-TW"),
}: {
  data: { label: string; value: number }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex h-48 items-end gap-1.5 sm:gap-2">
      {data.map((d) => (
        <div key={d.label} className="group flex h-full flex-1 flex-col items-center justify-end">
          <span className="mb-1 hidden text-[10px] text-stone-600 group-hover:block">{format(d.value)}</span>
          <div
            className="w-full rounded-t-md bg-emerald-500 transition-colors group-hover:bg-emerald-700"
            style={{ height: `${(d.value / max) * 85}%`, minHeight: d.value ? 2 : 0 }}
            title={`${d.label}：${format(d.value)}`}
          />
          <span className="mt-1 text-[10px] text-stone-500 sm:text-xs">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
