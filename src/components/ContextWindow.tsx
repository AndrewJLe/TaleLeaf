"use client";

import React, { useState, useEffect, useRef } from "react";

export default function ContextWindow({
    window: win,
    pageCount,
    onChange,
}: {
    window: { start: number; end: number };
    pageCount: number;
    onChange: (start: number, end: number) => void;
}) {
    const [active, setActive] = useState<'start' | 'end' | null>(null);

    const trackRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        const onUp = () => setActive(null);
        const onMove = (e: PointerEvent) => {
            if (!active || !trackRef.current) return;
            const rect = trackRef.current.getBoundingClientRect();
            let pct = (e.clientX - rect.left) / rect.width;
            pct = Math.max(0, Math.min(1, pct));
            const val = Math.round(pct * (pageCount - 1)) + 1;
            if (active === 'start') {
                onChange(Math.min(val, win.end), win.end);
            } else if (active === 'end') {
                onChange(win.start, Math.max(val, win.start));
            }
        };

        globalThis.addEventListener?.('pointermove', onMove);
        globalThis.addEventListener?.('pointerup', onUp);
        return () => {
            globalThis.removeEventListener?.('pointermove', onMove);
            globalThis.removeEventListener?.('pointerup', onUp);
        };
    }, [active, pageCount, win.start, win.end, onChange]);

    // dynamic z-index so the handle being interacted with is on top
    const leftZ = active === 'start' ? 30 : active === 'end' ? 10 : (win.start >= win.end ? 30 : 20);
    const rightZ = active === 'end' ? 30 : active === 'start' ? 10 : (win.end > win.start ? 30 : 20);

    return (
        <section className="mt-4 border-t pt-4">
            <h3 className="font-medium">Context window (pages)</h3>
            <div className="mt-2 text-sm text-slate-500">Page 1 — {pageCount}</div>

            <div className="mt-3">
                <div ref={trackRef} onPointerDown={(e) => {
                    // determine which handle is closer to pointer and activate it immediately
                    const rect = trackRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    const val = Math.round(pct * (pageCount - 1)) + 1;
                    const startPct = (win.start - 1) / (pageCount - 1);
                    const endPct = (win.end - 1) / (pageCount - 1);
                    const distToStart = Math.abs(pct - startPct);
                    const distToEnd = Math.abs(pct - endPct);
                    if (distToStart <= distToEnd) {
                        setActive('start');
                        onChange(Math.min(val, win.end), win.end);
                    } else {
                        setActive('end');
                        onChange(win.start, Math.max(val, win.start));
                    }
                }} className="relative h-8">
                    {/* background track */}
                    <div className="absolute left-0 right-0 top-3 h-1 bg-slate-200 rounded" />

                    {/* selected range highlight */}
                    <div
                        className="absolute top-3 h-1 bg-emerald-500 rounded"
                        style={{ left: `${((win.start - 1) / (pageCount - 1)) * 100}%`, right: `${100 - ((win.end - 1) / (pageCount - 1)) * 100}%` }}
                    />

                    {/* left handle (visual only) */}
                    <input
                        aria-hidden
                        type="range"
                        min={1}
                        max={pageCount}
                        value={win.start}
                        readOnly
                        className="absolute left-0 right-0 top-0 w-full h-8 bg-transparent appearance-none pointer-events-none"
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
                        className="absolute left-0 right-0 top-0 w-full h-8 bg-transparent appearance-none pointer-events-none"
                        style={{ zIndex: rightZ }}
                    />
                </div>

                <div className="flex items-center gap-2 mt-3">
                    <input
                        type="number"
                        min={1}
                        max={pageCount}
                        value={win.start}
                        onChange={(e) => onChange(Math.max(1, Math.min(Number(e.target.value) || 1, win.end)), win.end)}
                        className="w-24 border rounded px-2 py-1"
                    />
                    <span className="text-sm text-slate-500">to</span>
                    <input
                        type="number"
                        min={1}
                        max={pageCount}
                        value={win.end}
                        onChange={(e) => onChange(win.start, Math.min(pageCount, Math.max(Number(e.target.value) || pageCount, win.start)))}
                        className="w-24 border rounded px-2 py-1"
                    />
                    <div className="text-xs text-slate-500 ml-4">AI will only use pages in this window</div>
                </div>
            </div>
        </section>
    );
}
