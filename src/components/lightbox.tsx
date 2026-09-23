"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import { photoSrc } from "@/lib/utils";

const MIN = 1;
const MAX = 5;
const STEP = 1.5;
const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v));

type Pt = { x: number; y: number };

/**
 * 放大檢視照片。
 * 切換：左右箭頭、鍵盤 ←／→、下方縮圖、手機左右滑（原尺寸時）。
 * 縮放：＋／－ 按鈕、滑鼠滾輪（以游標為中心）、雙擊、兩指捏合、鍵盤 + - 0；放大後可拖曳移動。
 */
export function Lightbox({ photos, start = 0, onClose }: { photos: string[]; start?: number; onClose: () => void }) {
  const [i, setI] = useState(Math.min(Math.max(start, 0), photos.length - 1));
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Pt>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  // 目前按在照片上的手指／滑鼠，用來處理拖曳與兩指縮放
  const pointers = useRef(new Map<number, Pt>());
  const gesture = useRef<{ dist: number; scale: number; offset: Pt; mid: Pt } | null>(null);
  const drag = useRef<{ start: Pt; offset: Pt; moved: boolean } | null>(null);
  const many = photos.length > 1;

  const reset = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };
  const show = (n: number) => {
    setI((n + photos.length) % photos.length);
    reset();
  };

  /** 縮放到 next 倍，並讓畫面上 at 這個點（預設為中心）保持不動 */
  function zoomTo(next: number, at?: Pt, from = { scale, offset }) {
    const s = clamp(next);
    if (s === 1) return reset();
    const rect = stage.current?.getBoundingClientRect();
    if (!rect || !at) {
      setScale(s);
      setOffset({ x: (from.offset.x * s) / from.scale, y: (from.offset.y * s) / from.scale });
      return;
    }
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const k = s / from.scale;
    setScale(s);
    setOffset({
      x: at.x - cx - k * (at.x - cx - from.offset.x),
      y: at.y - cy - k * (at.y - cy - from.offset.y),
    });
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const keys = ["Escape", "ArrowLeft", "ArrowRight", "+", "=", "-", "_", "0"];
      if (!keys.includes(e.key)) return;
      // 在編輯視窗裡按 Esc 只關照片，不要連視窗一起關
      e.stopPropagation();
      e.preventDefault();
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && many) show(i - 1);
      else if (e.key === "ArrowRight" && many) show(i + 1);
      else if (e.key === "+" || e.key === "=") zoomTo(scale * STEP);
      else if (e.key === "-" || e.key === "_") zoomTo(scale / STEP);
      else if (e.key === "0") reset();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  });

  // 滾輪縮放要用非 passive 的監聽才能 preventDefault（避免整頁一起捲動）
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomTo(scale * (e.deltaY < 0 ? 1.2 : 1 / 1.2), { x: e.clientX, y: e.clientY });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  function onPointerDown(e: React.PointerEvent) {
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2) {
      drag.current = null;
      gesture.current = {
        dist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
        scale,
        offset,
        mid: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
      };
    } else if (pts.length === 1) {
      drag.current = { start: { x: e.clientX, y: e.clientY }, offset, moved: false };
      setDragging(true);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    if (pts.length === 2 && gesture.current) {
      const g = gesture.current;
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      zoomTo((g.scale * dist) / g.dist, g.mid, { scale: g.scale, offset: g.offset });
    } else if (drag.current) {
      const dx = e.clientX - drag.current.start.x;
      const dy = e.clientY - drag.current.start.y;
      if (Math.abs(dx) + Math.abs(dy) > 4) drag.current.moved = true;
      if (scale > 1) setOffset({ x: drag.current.offset.x + dx, y: drag.current.offset.y + dy });
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current = null;
    if (pointers.current.size === 0) {
      setDragging(false);
      drag.current = null;
      // 原尺寸時左右滑動切換照片（手機）
      if (d && scale === 1 && many && e.pointerType !== "mouse") {
        const dx = e.clientX - d.start.x;
        if (Math.abs(dx) > 60) show(i + (dx < 0 ? 1 : -1));
      }
    }
  }

  if (!photos.length) return null;
  const btn = "rounded-full bg-black/60 p-2 text-white hover:bg-black/80 disabled:opacity-40";
  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-3 bg-black/85 p-4"
      onClick={onClose}
      role="dialog"
      aria-label="照片檢視"
    >
      <div className="absolute left-4 top-4 z-10 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
        <button className={btn} onClick={() => zoomTo(scale / STEP)} disabled={scale <= MIN} aria-label="縮小">
          <ZoomOut size={20} />
        </button>
        <span className="min-w-14 rounded-full bg-black/60 px-2 py-1 text-center text-sm text-white" aria-live="polite">
          {Math.round(scale * 100)}%
        </span>
        <button className={btn} onClick={() => zoomTo(scale * STEP)} disabled={scale >= MAX} aria-label="放大">
          <ZoomIn size={20} />
        </button>
        <button className={btn} onClick={reset} disabled={scale === 1} aria-label="恢復原尺寸">
          <RotateCcw size={18} />
        </button>
      </div>
      <button
        onClick={onClose}
        className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70"
        aria-label="關閉"
      >
        <X size={22} />
      </button>
      {many && (
        <div className="absolute left-1/2 top-5 z-10 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
          {i + 1} / {photos.length}
        </div>
      )}

      <div ref={stage} className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photos[i]}
          src={photoSrc(photos[i])}
          alt={`照片 ${i + 1}`}
          draggable={false}
          className={`max-h-full max-w-full touch-none select-none rounded-lg object-contain ${
            scale > 1 ? (dragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
          } ${dragging ? "" : "transition-transform duration-150"}`}
          style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (scale > 1) reset();
            else zoomTo(2.5, { x: e.clientX, y: e.clientY });
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        {many && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                show(i - 1);
              }}
              className="absolute left-0 z-10 rounded-full bg-black/50 p-3 text-white hover:bg-black/70 sm:left-4"
              aria-label="上一張"
            >
              <ChevronLeft size={26} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                show(i + 1);
              }}
              className="absolute right-0 z-10 rounded-full bg-black/50 p-3 text-white hover:bg-black/70 sm:right-4"
              aria-label="下一張"
            >
              <ChevronRight size={26} />
            </button>
          </>
        )}
      </div>

      {many && (
        <div className="flex max-w-full gap-2 overflow-x-auto pb-1" onClick={(e) => e.stopPropagation()}>
          {photos.map((p, j) => (
            <button
              key={j}
              onClick={() => show(j)}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 ${
                j === i ? "border-white" : "border-transparent opacity-60 hover:opacity-100"
              }`}
              aria-label={`第 ${j + 1} 張`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoSrc(p)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
