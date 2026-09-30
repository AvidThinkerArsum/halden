"use client";

import { motion } from "framer-motion";
import type { Callout, Light, Pt } from "@/lib/site";
import type { Rect } from "@/lib/hero/gl";

export type Tone = "paper" | "photo" | "dusk";

const CH = 7.05; // Plex Mono 10.5px + tracking, per character
const CH_M = 6.2; // 9px on phones
const round = (v: number) => Math.round(v * 100) / 100;

type Placed = { compact: boolean; c: Callout; ax: number; ay: number; x: number; y: number; w: number; h: number; side: "l" | "r" | "t" | "b" };
type Box = { x: number; y: number; w: number; h: number };

type Side = Placed["side"];
/** From above/below when the anchor is roughly over the chip, else from the side. */
const sideOf = (b: Box, ax: number, ay: number): Side => (ax >= b.x - 6 && ax <= b.x + b.w + 6 ? (ay < b.y ? "t" : "b") : ax < b.x ? "l" : "r");
/** The leader as drawn: anchor, shoulder, the chip's edge. */
function leader(b: Box, ax: number, ay: number, side = sideOf(b, ax, ay)): [number, number][] {
  if (side === "t" || side === "b") {
    const ey = side === "t" ? b.y : b.y + b.h;
    const ex = Math.min(Math.max(ax, b.x + 14), b.x + b.w - 14);
    return [[ax, ay], [ex, ey + (side === "t" ? -10 : 10)], [ex, ey]];
  }
  const ex = side === "l" ? b.x : b.x + b.w;
  const ey = b.y + b.h / 2;
  return [[ax, ay], [side === "l" ? ex - 14 : ex + 14, ey], [ex, ey]];
}
/** How much of a segment runs through a box (sampled), in px. */
function crossing(x0: number, y0: number, x1: number, y1: number, b: Box) {
  const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(2, Math.ceil(len / 6));
  let inside = 0;
  for (let i = 1; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
    if (x > b.x - 6 && x < b.x + b.w + 6 && y > b.y - 6 && y < b.y + b.h + 6) inside++;
  }
  return (inside * len) / n;
}
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * Chips go where the designer put them unless that covers something: the title block, the
 * scroll cue, a fixture symbol, another callout's dot or an already placed chip (hard), or
 * one of the drawn set pieces, the urn and benches (soft). Candidates are the designer's
 * spot, its mirror images (above/below, left/right) and small nudges of each; the cheapest
 * wins, where cost is overlap first, then distance from the designer's spot.
 */
export function placeCallouts(callouts: Callout[], rect: Rect, vw: number, vh: number, mobile: boolean, avoid: Box[], fixtures: Pt[] = [], keep: Pt[][] = []) {
  const out: Placed[] = [];
  const top = mobile ? 64 : 70;
  // phones: the sticky call bar owns the bottom of the screen
  const bottom = mobile ? 92 : 14;
  const visible = callouts
    .filter((c) => !(mobile && c.mobile === false))
    .map((c) => {
      const a: Pt = mobile && c.anchorMobile ? c.anchorMobile : c.anchor;
      return { c, ax: rect.ox + a[0] * rect.dw, ay: rect.oy + a[1] * rect.dh };
    })
    // anchor must be on screen, clear of the edges
    .filter(({ ax, ay }) => !(ax < 10 || ax > vw - 10 || ay < 60 || ay > vh - (mobile ? 92 : 10)));
  const dot = (x: number, y: number, r = 9): Box => ({ x: x - r, y: y - r, w: 2 * r, h: 2 * r });
  const fixed: Box[] = [...avoid, ...fixtures.map(([x, y]) => dot(rect.ox + x * rect.dw, rect.oy + y * rect.dh, 8))];
  const soft: Box[] = keep.map((poly) => {
    const xs = poly.map((p) => rect.ox + p[0] * rect.dw), ys = poly.map((p) => rect.oy + p[1] * rect.dh);
    const x0 = Math.min(...xs), y0 = Math.min(...ys);
    return { x: x0, y: y0, w: Math.max(...xs) - x0, h: Math.max(...ys) - y0 };
  });
  const chips: Box[] = [];
  const leaders: [number, number, number, number][] = [];
  for (const { c, ax, ay } of visible) {
    const off: Pt = mobile && c.offsetMobile ? c.offsetMobile : c.offset;
    // phones: label and status only, sized to the label
    const w = mobile ? Math.round(Math.max(c.label.length, 13) * CH_M + 38) : Math.round(Math.max(c.label.length, (c.spec ?? "").length, 12) * CH + 44);
    const h = mobile ? 42 : 60;
    const hard = [...fixed, ...chips, ...visible.filter((v) => v.c !== c).map((v) => dot(v.ax, v.ay))];
    const clampBox = (x: number, y: number): Box => ({ x: Math.min(Math.max(x, 14), vw - 14 - w), y: Math.min(Math.max(y, top), vh - bottom - h), w, h });
    const home = clampBox(ax + off[0], ay + off[1]);
    const cost = (b: Box, flip: number) => {
      const [, [sx, sy]] = leader(b, ax, ay);
      // a leader never runs through another chip, and a chip never sits on another leader
      const lines = chips.reduce((s, o) => s + crossing(ax, ay, sx, sy, o), 0) + leaders.reduce((s, [x0, y0, x1, y1]) => s + crossing(x0, y0, x1, y1, b), 0);
      return lines * 400 + hard.reduce((s, o) => s + overlap(b, o), 0) * 20 +
      overlap(b, dot(ax, ay, 6)) * 40 +
      soft.reduce((s, o) => s + overlap(b, o), 0) * 0.6 +
      Math.abs(b.x - home.x) * 1.5 +
      Math.abs(b.y - home.y) +
      flip;
    };
    const bases: [number, number, number][] = [
      [off[0], off[1], 0],
      [off[0], -off[1] - h, 60],
      [-off[0] - w, off[1], 90],
      [-off[0] - w, -off[1] - h, 140],
    ];
    let best = home, bestCost = Infinity;
    for (const [dx, dy, flip] of bases) {
      for (let ny = -8; ny <= 8; ny++) {
        for (let nx = -2; nx <= 2; nx++) {
          const b = clampBox(ax + dx + nx * 24, ay + dy + ny * 12);
          const k = cost(b, flip);
          if (k < bestCost) { best = b; bestCost = k; }
        }
      }
    }
    const { x, y } = best;
    chips.push(best);
    leaders.push([ax, ay, ...leader(best, ax, ay)[1]]);
    const side = sideOf(best, ax, ay);
    out.push({ compact: mobile, c, ax: round(ax), ay: round(ay), x: round(x), y: round(y), w, h, side });
  }
  return out;
}

const INK: Record<Tone, { line: string; dot: string; text: string; chip: string; sub: string }> = {
  paper: { line: "rgba(38,40,38,0.85)", dot: "#262826", text: "text-graphite", chip: "bg-vellum/90 ring-1 ring-graphite/15", sub: "text-graphite/70" },
  photo: { line: "rgba(243,239,230,0.95)", dot: "#f3efe6", text: "text-graphite", chip: "bg-vellum/92 shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)]", sub: "text-graphite/70" },
  dusk: { line: "rgba(243,239,230,0.7)", dot: "#ffb46b", text: "text-vellum", chip: "bg-dusk-2/80 backdrop-blur-[2px] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.8)]", sub: "text-vellum/65" },
};

function Check({ on, tone }: { on: boolean; tone: Tone }) {
  const col = tone === "dusk" ? "#f3efe6" : "#262826";
  return (
    <svg width="11" height="11" viewBox="0 0 11 11" className="shrink-0" aria-hidden>
      <rect x="0.5" y="0.5" width="10" height="10" fill="none" stroke={col} strokeOpacity="0.8" />
      <motion.path
        d="M2.2 5.6 L4.5 8 L8.9 2.6"
        fill="none"
        stroke={tone === "dusk" ? "#ffb46b" : "#9a5b33"}
        strokeWidth="1.6"
        strokeLinecap="round"
        initial={false}
        animate={{ pathLength: on ? 1 : 0, opacity: on ? 1 : 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
      />
    </svg>
  );
}

export function Callouts({
  placed,
  tones,
  built,
  plotted,
  months,
}: {
  placed: Placed[];
  tones: Record<string, Tone>;
  built: Record<string, boolean>;
  plotted: boolean;
  months: Record<string, string>;
}) {
  return (
    <div className="pointer-events-none absolute inset-0" aria-hidden>
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        {placed.map((p, i) => {
          const tone = tones[p.c.id] ?? "paper";
          const ink = INK[tone];
          const d = leader(p, p.ax, p.ay, p.side)
            .map(([x, y], k) => `${k ? "L" : "M"}${round(x)} ${round(y)}`)
            .join(" ");
          return (
            <g key={p.c.id} style={{ filter: tone === "photo" ? "drop-shadow(0 1px 1.5px rgba(0,0,0,0.55))" : undefined }}>
              <motion.path
                d={d}
                fill="none"
                stroke={ink.line}
                strokeWidth={1}
                initial={{ pathLength: 0 }}
                animate={{ pathLength: plotted ? 1 : 0 }}
                transition={{ duration: 0.9, delay: 0.25 + i * 0.16, ease: [0.4, 0, 0.2, 1] }}
                style={{ transition: "stroke 0.6s" }}
              />
              <motion.g initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: plotted ? 1 : 0, scale: plotted ? 1 : 0.4 }} transition={{ duration: 0.4, delay: 0.1 + i * 0.16 }} style={{ transformOrigin: `${p.ax}px ${p.ay}px` }}>
                <circle cx={p.ax} cy={p.ay} r={3.2} fill="none" stroke={ink.dot} strokeWidth={1.2} style={{ transition: "stroke 0.6s" }} />
                <circle cx={p.ax} cy={p.ay} r={1.1} fill={ink.dot} style={{ transition: "fill 0.6s" }} />
              </motion.g>
            </g>
          );
        })}
      </svg>
      {placed.map((p, i) => {
        const tone = tones[p.c.id] ?? "paper";
        const ink = INK[tone];
        const on = !!built[p.c.id];
        const light = p.c.stage === "light";
        return (
          <motion.div
            key={p.c.id}
            className={`absolute font-mono uppercase transition-[background-color,color,box-shadow] duration-500 ${ink.chip} ${ink.text} ${p.compact ? "text-[9px]" : "text-[10.5px]"}`}
            style={{ left: p.x, top: p.y, width: p.w, letterSpacing: "0.07em", padding: p.compact ? "6px 8px" : "7px 10px" }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: plotted ? 1 : 0, y: plotted ? 0 : 4 }}
            transition={{ duration: 0.5, delay: 0.75 + i * 0.16 }}
          >
            <div className="flex items-center gap-1.5 leading-[1.25]">
              <Check on={on} tone={tone} />
              <span className="whitespace-nowrap">{p.c.label}</span>
            </div>
            {p.c.spec && !p.compact && <div className={`mt-0.5 whitespace-nowrap pl-[17px] leading-[1.25] ${ink.sub}`}>{p.c.spec}</div>}
            <div className="relative mt-0.5 h-[1.25em] overflow-hidden pl-[17px] leading-[1.25]">
              <span className={`absolute inset-x-[17px] transition-all duration-500 ${on ? "-translate-y-full opacity-0" : "opacity-45"}`}>{light ? "To wire" : "To build"}</span>
              <span className={`absolute inset-x-[17px] font-medium transition-all duration-500 ${on ? "opacity-100" : "translate-y-full opacity-0"} ${tone === "dusk" ? "text-warm" : "text-cedar"}`}>
                {light ? "Lit · 9:40 pm" : `Built · ${months[p.c.id] ?? ""}`}
              </span>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

/** Lighting-plan symbols on the drawing, before anything is built. */
export function Fixtures({ lights, rect, plotted }: { lights: Light[]; rect: Rect; plotted: boolean }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      {lights.map((l, i) => {
        const x = round(rect.ox + l.at[0] * rect.dw);
        const y = round(rect.oy + l.at[1] * rect.dh);
        return (
          <motion.g key={i} initial={{ opacity: 0 }} animate={{ opacity: plotted ? 0.85 : 0 }} transition={{ duration: 0.5, delay: 0.6 + i * 0.07 }}>
            <circle cx={x} cy={y} r={4.5} fill="#f3efe6" stroke="#262826" strokeWidth={1} />
            {l.kind === "up" ? (
              <path d={`M${x - 3} ${y + 1.5} L${x} ${y - 3} L${x + 3} ${y + 1.5} Z`} fill="#262826" />
            ) : (
              <circle cx={x} cy={y} r={1.6} fill="#262826" />
            )}
          </motion.g>
        );
      })}
    </svg>
  );
}

/** Perspective construction: horizon, vanishing point and a few rays, as on a real sheet. */
export function Construction({ rect, vp, plotted }: { rect: Rect; vp: Pt; plotted: boolean }) {
  const X = (x: number) => round(rect.ox + x * rect.dw);
  const Yy = (y: number) => round(rect.oy + y * rect.dh);
  const cx = X(vp[0]), cy = Yy(vp[1]);
  const rays: Pt[] = [[-0.05, 0.96], [0.16, 1.05], [0.36, 1.08], [0.64, 1.08], [0.84, 1.05], [1.05, 0.96]];
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: plotted ? 1 : 0 }} transition={{ duration: 1.2, delay: 0.2 }}>
        <line x1={X(-0.1)} y1={cy} x2={X(1.1)} y2={cy} stroke="#262826" strokeOpacity="0.3" strokeWidth="0.8" strokeDasharray="14 5 2 5" />
        {rays.map(([x, y], i) => (
          <motion.line
            key={i}
            x1={cx}
            y1={cy}
            x2={X(x)}
            y2={Yy(y)}
            stroke="#262826"
            strokeOpacity="0.16"
            strokeWidth="0.7"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: plotted ? 1 : 0 }}
            transition={{ duration: 1.4, delay: 0.3 + i * 0.08, ease: [0.4, 0, 0.2, 1] }}
          />
        ))}
        <circle cx={cx} cy={cy} r="4" fill="none" stroke="#262826" strokeOpacity="0.55" strokeWidth="0.8" />
        <line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} stroke="#262826" strokeOpacity="0.55" strokeWidth="0.8" />
        <line x1={cx} y1={cy - 8} x2={cx} y2={cy + 8} stroke="#262826" strokeOpacity="0.55" strokeWidth="0.8" />
        <text x={cx + 8} y={cy - 7} fontSize="8.5" fontFamily="var(--font-plex)" letterSpacing="0.08em" fill="#262826" fillOpacity="0.55">
          VP
        </text>
        <text x={Math.max(X(0) + 40, 40)} y={cy - 6} fontSize="8.5" fontFamily="var(--font-plex)" letterSpacing="0.08em" fill="#262826" fillOpacity="0.5">
          H.L. · EYE 5&apos;-4&quot;
        </text>
      </motion.g>
    </svg>
  );
}
