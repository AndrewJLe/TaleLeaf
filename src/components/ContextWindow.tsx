"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface ChapterMarker {
  id: string;
  title: string;
  startPage: number;
  endPage?: number;
  index: number;
}

interface ContextWindowProps {
  window: { start: number; end: number };
  pageCount: number;
  chapters?: ChapterMarker[];
  onChange: (start: number, end: number) => void;
}

export default function ContextWindow({
  window: win,
  pageCount,
  chapters = [],
  onChange,
}: ContextWindowProps) {
  const [active, setActive] = useState<"start" | "end" | null>(null);
  const [startInput, setStartInput] = useState(String(win.start));
  const [endInput, setEndInput] = useState(String(win.end));

  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setStartInput(String(win.start));
  }, [win.start]);
  useEffect(() => {
    setEndInput(String(win.end));
  }, [win.end]);

  useEffect(() => {
    const onUp = () => setActive(null);
    const onMove = (e: PointerEvent) => {
      if (!active || !trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      let pct = (e.clientX - rect.left) / rect.width;
      pct = Math.max(0, Math.min(1, pct));
      const val = Math.round(pct * (pageCount - 1)) + 1;
      if (active === "start") {
        onChange(Math.min(val, win.end), win.end);
      } else if (active === "end") {
        onChange(win.start, Math.max(val, win.start));
      }
    };

    globalThis.addEventListener?.("pointermove", onMove);
    globalThis.addEventListener?.("pointerup", onUp);
    return () => {
      globalThis.removeEventListener?.("pointermove", onMove);
      globalThis.removeEventListener?.("pointerup", onUp);
    };
  }, [active, pageCount, win.start, win.end, onChange]);

  // dynamic z-index so the handle being interacted with is on top
  const leftZ =
    active === "start"
      ? 30
      : active === "end"
        ? 10
        : win.start >= win.end
          ? 30
          : 20;
  const rightZ =
    active === "end"
      ? 30
      : active === "start"
        ? 10
        : win.end > win.start
          ? 30
          : 20;

  const chapterButtons = useMemo(
    () =>
      chapters.filter((ch) => ch.startPage >= 1 && ch.startPage <= pageCount),
    [chapters, pageCount],
  );

  const percentageForPage = (page: number) => {
    if (pageCount <= 1) return 0;
    return ((page - 1) / (pageCount - 1)) * 100;
  };

  const clampStart = (value: number) => Math.max(1, Math.min(value, pageCount));
  const clampEnd = (value: number, baseStart: number = win.start) =>
    Math.min(pageCount, Math.max(value, baseStart));

  const handleStartBlur = () => {
    let next = parseInt(startInput, 10);
    if (Number.isNaN(next)) next = win.start;
    next = clampStart(next);
    setStartInput(String(next));
    if (next !== win.start) onChange(next, Math.max(next, win.end));
  };

  const handleEndBlur = () => {
    let next = parseInt(endInput, 10);
    if (Number.isNaN(next)) next = win.end;
    next = clampEnd(next);
    setEndInput(String(next));
    if (next !== win.end) onChange(win.start, next);
  };

  const handleChapterJump = (marker: ChapterMarker) => {
    const start = clampStart(marker.startPage);
    const chapterEnd = marker.endPage
      ? clampEnd(marker.endPage, start)
      : clampEnd(marker.startPage + (win.end - win.start), start);
    onChange(start, Math.max(start, chapterEnd));
  };

  return (
    <section className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-semibold text-gray-900">Context window</h3>
          <p className="text-xs text-slate-500">
            Pages {win.start} – {win.end} of {pageCount}
          </p>
        </div>
      </div>

      <div
        ref={trackRef}
        onPointerDown={(e) => {
          // determine which handle is closer to pointer and activate it immediately
          const rect = trackRef.current?.getBoundingClientRect();
          if (!rect) return;
          const pct = Math.max(
            0,
            Math.min(1, (e.clientX - rect.left) / rect.width),
          );
          const val = Math.round(pct * (pageCount - 1)) + 1;
          const startPct = (win.start - 1) / (pageCount - 1);
          const endPct = (win.end - 1) / (pageCount - 1);
          const distToStart = Math.abs(pct - startPct);
          const distToEnd = Math.abs(pct - endPct);
          if (distToStart <= distToEnd) {
            setActive("start");
            onChange(Math.min(val, win.end), win.end);
          } else {
            setActive("end");
            onChange(win.start, Math.max(val, win.start));
          }
        }}
        className="relative h-12 select-none"
      >
        {/* background track */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-slate-200" />

        {/* chapter markers */}
        {chapterButtons.map((marker) => (
          <div
            key={`${marker.id}-${marker.startPage}`}
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none"
            style={{ left: `${percentageForPage(marker.startPage)}%` }}
          >
            <div className="w-px h-3 bg-slate-400" />
            <span className="mt-1 text-[10px] text-slate-500 whitespace-nowrap">
              {marker.title}
            </span>
          </div>
        ))}

        {/* selected range highlight */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-2 bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full shadow-inner"
          style={{
            left: `${percentageForPage(win.start)}%`,
            right: `${100 - percentageForPage(win.end)}%`,
          }}
        />

        {/* left handle (visual only) */}
        <input
          aria-hidden
          type="range"
          min={1}
          max={pageCount}
          value={win.start}
          readOnly
          className="absolute left-0 right-0 top-0 w-full h-12 bg-transparent appearance-none pointer-events-none"
          style={{ zIndex: leftZ }}
        />

        {/* right handle (visual only) */}
        <input
          aria-hidden
          type="range"
          min={1}
          max={pageCount}
          value={win.end}
          readOnly
          className="absolute left-0 right-0 top-0 w-full h-12 bg-transparent appearance-none pointer-events-none"
          style={{ zIndex: rightZ }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 uppercase tracking-wide">
            Start
          </label>
          <input
            type="number"
            min={1}
            max={pageCount}
            value={startInput}
            onChange={(e) => setStartInput(e.target.value)}
            onBlur={handleStartBlur}
            className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 uppercase tracking-wide">
            End
          </label>
          <input
            type="number"
            min={1}
            max={pageCount}
            value={endInput}
            onChange={(e) => setEndInput(e.target.value)}
            onBlur={handleEndBlur}
            className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 focus:border-transparent"
          />
        </div>
        <div className="text-xs text-slate-500">
          AI will only use pages inside this range.
        </div>
      </div>

      {chapterButtons.length > 0 && (
        <div className="mt-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">
            Jump to chapter
          </p>
          <div className="flex flex-wrap gap-2">
            {chapterButtons.map((marker) => (
              <button
                key={marker.id}
                type="button"
                onClick={() => handleChapterJump(marker)}
                className="px-3 py-1.5 rounded-full border border-slate-200 bg-white text-xs text-slate-600 hover:border-emerald-400 hover:text-emerald-700 transition-colors"
              >
                {marker.title}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
