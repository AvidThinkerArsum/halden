"use client";

import { useState } from "react";
import { site, type Pt } from "@/lib/site";
import type { Rect } from "@/lib/hero/gl";

/**
 * Dev tools for fitting a new photo. `?trace`: click to place points, copy them as JSON for
 * polygons, strokes and anchors; existing anchors and lights are shown. `?masks`: the shader
 * shows the masks (R stone, G planting, B distance, white bands = reveal order).
 */
export function Trace({ rect, trace }: { rect: Rect; trace: boolean }) {
  const [pts, setPts] = useState<Pt[]>([]);
  const [copied, setCopied] = useState(false);
  const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
  const toScreen = ([x, y]: Pt) => [rect.ox + x * rect.dw, rect.oy + y * rect.dh];
  const json = JSON.stringify(pts);
  return (
    <div
      className={`absolute inset-0 z-40 ${trace ? "cursor-crosshair" : "pointer-events-none"}`}
      onClick={(e) => {
        if (!trace) return;
        const b = e.currentTarget.getBoundingClientRect();
        setPts((p) => [...p, [r4((e.clientX - b.left - rect.ox) / rect.dw), r4((e.clientY - b.top - rect.oy) / rect.dh)]]);
        setCopied(false);
      }}
    >
      <svg className="pointer-events-none absolute inset-0 h-full w-full">
        {trace &&
          site.hero.callouts.map((c) => {
            const [x, y] = toScreen(c.anchor);
            return (
              <g key={c.id}>
                <circle cx={x} cy={y} r={6} fill="none" stroke="#00e5ff" strokeWidth={2} />
                <text x={x + 9} y={y + 4} fill="#00e5ff" fontSize={11} fontFamily="monospace">{c.id}</text>
              </g>
            );
          })}
        {trace &&
          site.hero.lights.map((l, i) => {
            const [x, y] = toScreen(l.at);
            return <circle key={i} cx={x} cy={y} r={5} fill="#ff00aa" />;
          })}
        {pts.length > 1 && <polyline points={pts.map((p) => toScreen(p).join(",")).join(" ")} fill="none" stroke="#ffe600" strokeWidth={1.5} />}
        {pts.map((p, i) => {
          const [x, y] = toScreen(p);
          return <circle key={i} cx={x} cy={y} r={3.5} fill="#ffe600" stroke="#000" />;
        })}
      </svg>
      <div className="pointer-events-auto absolute left-4 top-20 max-w-[min(420px,calc(100%-2rem))] bg-black/80 p-3 font-mono text-[11px] text-white" onClick={(e) => e.stopPropagation()}>
        {trace ? (
          <>
            <p className="mb-2 opacity-70">?trace — click to place points ({pts.length})</p>
            <p className="max-h-28 overflow-auto break-all">{json}</p>
            <div className="mt-2 flex gap-3">
              <button
                className="underline"
                onClick={() => {
                  navigator.clipboard?.writeText(json).then(() => setCopied(true), () => setCopied(false));
                }}
              >
                {copied ? "Copied" : "Copy JSON"}
              </button>
              <button className="underline" onClick={() => setPts((p) => p.slice(0, -1))}>Undo</button>
              <button className="underline" onClick={() => setPts([])}>Clear</button>
            </div>
          </>
        ) : (
          <p>?masks — red stone · green planting · blue distance · white bands: reveal order · dark: linework</p>
        )}
      </div>
    </div>
  );
}
