"use client";

import { motion, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { site } from "@/lib/site";
import { useHeroSketch } from "@/lib/hero/store";
import { Rise, Words } from "@/components/ui/Reveal";
import { Sample } from "@/components/ui/Sample";

const G = "#262826";
const r2 = (v: number) => Math.round(v * 100) / 100;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A scalloped canopy / shrub outline, the landscape architect's cloud. */
function cloud(cx: number, cy: number, r: number, bumps: number, seed: number) {
  const rnd = rng(seed);
  let d = "";
  const pts: [number, number][] = [];
  for (let i = 0; i < bumps; i++) {
    const a = (i / bumps) * Math.PI * 2;
    const rr = r * (0.9 + rnd() * 0.16);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  pts.forEach(([x, y], i) => {
    const [nx, ny] = pts[(i + 1) % pts.length];
    const mx = (x + nx) / 2, my = (y + ny) / 2;
    const ox = (mx - cx) * 0.22, oy = (my - cy) * 0.22;
    d += i === 0 ? `M${r2(x)} ${r2(y)} ` : "";
    d += `Q${r2(mx + ox)} ${r2(my + oy)} ${r2(nx)} ${r2(ny)} `;
  });
  return d + "Z";
}

/** Flagstone: a jittered grid clipped to an ellipse. */
function flagstone(cx: number, cy: number, rx: number, ry: number, seed: number) {
  const rnd = rng(seed);
  const cols = 7, rows = 5;
  const P: [number, number][][] = [];
  for (let j = 0; j <= rows; j++) {
    P.push([]);
    for (let i = 0; i <= cols; i++) {
      const x = cx - rx + (i / cols) * rx * 2 + (i > 0 && i < cols ? (rnd() - 0.5) * 12 : 0);
      const y = cy - ry + (j / rows) * ry * 2 + (j > 0 && j < rows ? (rnd() - 0.5) * 9 : 0);
      P[j].push([r2(x), r2(y)]);
    }
  }
  let d = "";
  for (let j = 1; j < rows; j++) d += "M" + P[j].map((p) => p.join(" ")).join(" L") + " ";
  for (let j = 0; j < rows; j++) {
    const off = j % 2;
    for (let i = 1 + off; i < cols; i += 2) d += `M${P[j][i].join(" ")} L${P[j + 1][i].join(" ")} `;
  }
  return d;
}

/** The title strip is 33 units wide: a long name keeps its first word, squeezed to fit if need be. */
const SHORT_NAME = site.name.split(/\s+/)[0].toUpperCase();
const FIT = SHORT_NAME.length > 7 ? { textLength: 30, lengthAdjust: "spacingAndGlyphs" as const } : {};

function Frame({ no, title, children }: { no: string; title: string; children: ReactNode }) {
  return (
    <svg viewBox="0 0 360 240" className="h-full w-full" role="img" aria-label={`Sheet ${no}, ${title}`}>
      <rect x="0" y="0" width="360" height="240" fill="#f3efe6" />
      <rect x="6" y="6" width="348" height="228" fill="none" stroke={G} strokeWidth="0.9" />
      <rect x="8.5" y="8.5" width="343" height="223" fill="none" stroke={G} strokeWidth="0.3" opacity="0.5" />
      <line x1="318" y1="8.5" x2="318" y2="231.5" stroke={G} strokeWidth="0.6" />
      <text x="335" y="24" textAnchor="middle" fontSize="6" fontFamily="var(--font-newsreader)" fill={G} {...FIT}>
        {SHORT_NAME}
      </text>
      <line x1="318" y1="30" x2="351.5" y2="30" stroke={G} strokeWidth="0.4" />
      <text transform="translate(338 130) rotate(-90)" textAnchor="middle" fontSize="6.4" letterSpacing="0.8" fontFamily="var(--font-plex)" fill={G}>
        {title.toUpperCase()}
      </text>
      <line x1="318" y1="206" x2="351.5" y2="206" stroke={G} strokeWidth="0.4" />
      <text x="335" y="223" textAnchor="middle" fontSize="11" fontFamily="var(--font-plex)" fill={G}>
        {no}
      </text>
      <g>{children}</g>
    </svg>
  );
}

function Hatch({ id, angle = 45, gap = 3.2, w = 0.35 }: { id: string; angle?: number; gap?: number; w?: number }) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width={gap} height={gap} patternTransform={`rotate(${angle})`}>
      <line x1="0" y1="0" x2="0" y2={gap} stroke={G} strokeWidth={w} />
    </pattern>
  );
}

function SitePlan() {
  const rnd = rng(11);
  const dots = Array.from({ length: 140 }, () => {
    const a = rnd() * Math.PI * 2, r = 70 + rnd() * 26;
    return [r2(160 + Math.cos(a) * r * 1.2), r2(140 + Math.sin(a) * r * 0.78)];
  }).filter(([x, y]) => x > 14 && x < 312 && y > 58 && y < 226);
  return (
    <Frame no="L-1" title="Site plan">
      <defs>
        <Hatch id="h-house" />
        <clipPath id="c-terr">
          <ellipse cx="160" cy="140" rx="80" ry="54" />
        </clipPath>
      </defs>
      <rect x="40" y="16" width="230" height="34" fill="url(#h-house)" stroke={G} strokeWidth="1.1" />
      <rect x="120" y="24" width="70" height="18" fill="#f3efe6" stroke={G} strokeWidth="0.5" />
      <text x="155" y="36" textAnchor="middle" fontSize="6" fontFamily="var(--font-plex)" fill={G}>RESIDENCE · FF 104.0</text>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={146 - i * 2} y={50 + i * 6} width={28 + i * 4} height="6" fill="none" stroke={G} strokeWidth="0.6" />
      ))}
      {[0, 1, 2].map((i) => (
        <rect key={i} x={153 + (i % 2) * 5} y={72 + i * 10} width="12" height="7" rx="2" fill="none" stroke={G} strokeWidth="0.6" />
      ))}
      <g opacity="0.8">
        {dots.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="0.55" fill={G} />
        ))}
      </g>
      <ellipse cx="160" cy="140" rx="80" ry="54" fill="#f3efe6" stroke={G} strokeWidth="1.3" />
      <path d={flagstone(160, 140, 80, 54, 5)} clipPath="url(#c-terr)" fill="none" stroke={G} strokeWidth="0.45" />
      <circle cx="160" cy="140" r="8" fill="#f3efe6" stroke={G} strokeWidth="0.9" />
      <circle cx="160" cy="140" r="4.5" fill="none" stroke={G} strokeWidth="0.5" />
      <path d="M86 118 Q80 140 88 162" fill="none" stroke={G} strokeWidth="4.5" strokeLinecap="round" opacity="0.18" />
      <path d="M86 118 Q80 140 88 162" fill="none" stroke={G} strokeWidth="0.8" />
      <path d="M234 118 Q240 140 232 162" fill="none" stroke={G} strokeWidth="4.5" strokeLinecap="round" opacity="0.18" />
      <path d="M234 118 Q240 140 232 162" fill="none" stroke={G} strokeWidth="0.8" />
      {[
        [58, 104, 36, 1],
        [266, 100, 38, 2],
      ].map(([x, y, r, s]) => (
        <g key={s}>
          <path d={cloud(x, y, r, 14, s)} fill="none" stroke={G} strokeWidth="0.9" />
          <path d={cloud(x + 3, y + 3, r * 0.62, 10, s + 9)} fill="none" stroke={G} strokeWidth="0.35" opacity="0.7" />
          {[0, 1, 2].map((k) => (
            <circle key={k} cx={x + Math.cos(k * 2.1) * 3} cy={y + Math.sin(k * 2.1) * 3} r="1.2" fill={G} />
          ))}
        </g>
      ))}
      {[
        [40, 190, 13],
        [62, 206, 10],
        [280, 196, 12],
        [258, 212, 9],
        [110, 206, 8],
        [214, 206, 8],
      ].map(([x, y, r], i) => (
        <path key={i} d={cloud(x, y, r, 9, 30 + i)} fill="none" stroke={G} strokeWidth="0.7" />
      ))}
      <g stroke={G} strokeWidth="0.5">
        <line x1="80" y1="202" x2="240" y2="202" />
        <line x1="80" y1="198" x2="80" y2="206" />
        <line x1="240" y1="198" x2="240" y2="206" />
      </g>
      <text x="160" y="199" textAnchor="middle" fontSize="6.2" fontFamily="var(--font-plex)" fill={G}>24&apos;-0&quot;</text>
      <g transform="translate(24 214)">
        <circle r="7" fill="none" stroke={G} strokeWidth="0.5" />
        <path d="M0 -6 L2.5 3 L0 1.4 L-2.5 3 Z" fill={G} />
        <text y="-9" textAnchor="middle" fontSize="5" fontFamily="var(--font-plex)" fill={G}>N</text>
      </g>
    </Frame>
  );
}

function Grading() {
  const lines = [70, 98, 126, 154, 182, 210];
  return (
    <Frame no="L-2" title="Grading & drainage">
      <defs>
        <Hatch id="h-wall" angle={-45} gap={2.4} />
      </defs>
      {lines.map((y, i) => (
        <path key={i} d={`M14 ${y} C 90 ${y - 10}, 200 ${y + 14}, 312 ${y - 4}`} fill="none" stroke={G} strokeWidth="0.45" strokeDasharray="4 3" opacity="0.7" />
      ))}
      {lines.map((y, i) => (
        <text key={i} x="300" y={y - 7} fontSize="5.4" fontFamily="var(--font-plex)" fill={G} opacity="0.75">
          {104 - i}
        </text>
      ))}
      <path d="M14 126 C 70 118, 90 104, 160 104 S 250 118, 312 122" fill="none" stroke={G} strokeWidth="0.9" />
      <path d="M14 154 C 70 150, 90 176, 160 176 S 250 150, 312 150" fill="none" stroke={G} strokeWidth="0.9" />
      <ellipse cx="160" cy="140" rx="80" ry="36" fill="#f3efe6" stroke={G} strokeWidth="1.2" />
      {[
        [124, 132],
        [196, 132],
        [160, 150],
      ].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <path d="M-3 0 H3 M0 -3 V3" stroke={G} strokeWidth="0.6" />
          <text x="4" y="-3" fontSize="5.2" fontFamily="var(--font-plex)" fill={G}>
            {["+102.50", "+102.46", "+102.28"][i]}
          </text>
        </g>
      ))}
      <g stroke={G} strokeWidth="0.6" fill={G}>
        <line x1="150" y1="120" x2="150" y2="136" />
        <path d="M147 133 L150 138 L153 133 Z" />
        <line x1="176" y1="120" x2="176" y2="136" />
        <path d="M173 133 L176 138 L179 133 Z" />
      </g>
      <text x="163" y="126" textAnchor="middle" fontSize="5.4" fontFamily="var(--font-plex)" fill={G}>2%</text>
      <path d="M66 184 Q160 206 254 184" fill="none" stroke={G} strokeWidth="5" opacity="0.9" />
      <path d="M66 184 Q160 206 254 184" fill="none" stroke="#f3efe6" strokeWidth="3.4" />
      <path d="M66 184 Q160 206 254 184" fill="none" stroke="url(#h-wall)" strokeWidth="3.4" />
      <text x="160" y="220" textAnchor="middle" fontSize="5.6" fontFamily="var(--font-plex)" fill={G}>BASALT WALL · 30&quot; MAX · GEOGRID</text>
      <path d="M70 178 Q160 198 250 178 L306 170" fill="none" stroke={G} strokeWidth="0.8" strokeDasharray="1.6 1.6" />
      <path d="M300 166 L308 170 L300 174" fill="none" stroke={G} strokeWidth="0.8" />
      <text x="262" y="163" fontSize="5.2" fontFamily="var(--font-plex)" fill={G}>4&quot; PERF → DAYLIGHT</text>
      {[
        [96, 164],
        [224, 164],
      ].map(([x, y], i) => (
        <g key={i}>
          <rect x={x - 3.5} y={y - 3.5} width="7" height="7" fill="#f3efe6" stroke={G} strokeWidth="0.7" />
          <path d={`M${x - 3.5} ${y - 3.5} L${x + 3.5} ${y + 3.5} M${x + 3.5} ${y - 3.5} L${x - 3.5} ${y + 3.5}`} stroke={G} strokeWidth="0.4" />
          <text x={x} y={y - 6} textAnchor="middle" fontSize="4.8" fontFamily="var(--font-plex)" fill={G}>CB-{i + 1}</text>
        </g>
      ))}
      <rect x="40" y="16" width="230" height="30" fill="none" stroke={G} strokeWidth="0.7" />
      <text x="155" y="34" textAnchor="middle" fontSize="6" fontFamily="var(--font-plex)" fill={G}>RESIDENCE</text>
    </Frame>
  );
}

function Perspective() {
  const sketch = useHeroSketch();
  return (
    <Frame no="L-3" title="Perspective">
      <rect x="14" y="14" width="298" height="212" fill="#f3efe6" />
      {sketch ? (
        <image href={sketch} x="14" y="14" width="298" height="212" preserveAspectRatio="xMidYMid slice" opacity="0.95" />
      ) : (
        <g stroke={G} strokeWidth="0.7" fill="none" opacity="0.7">
          <path d="M14 200 L160 120 L312 200" />
          <ellipse cx="160" cy="150" rx="70" ry="18" />
          <path d="M140 150 L144 128 H176 L180 150" />
          <path d="M60 60 C 70 100, 80 120, 70 150 M250 60 C 240 100, 230 120, 244 150" />
        </g>
      )}
    </Frame>
  );
}

function Lighting() {
  const pls: [number, number][] = [
    [92, 164], [110, 108], [160, 92], [210, 108], [228, 164], [160, 190],
  ];
  return (
    <Frame no="L-4" title="Lighting plan">
      <ellipse cx="160" cy="140" rx="80" ry="54" fill="none" stroke={G} strokeWidth="0.6" opacity="0.55" />
      <path d={cloud(58, 104, 36, 14, 1)} fill="none" stroke={G} strokeWidth="0.45" opacity="0.45" />
      <path d={cloud(266, 100, 38, 14, 2)} fill="none" stroke={G} strokeWidth="0.45" opacity="0.45" />
      <rect x="40" y="16" width="230" height="30" fill="none" stroke={G} strokeWidth="0.6" opacity="0.6" />
      <g transform="translate(150 50)">
        <rect x="-9" y="-2" width="18" height="10" fill="#f3efe6" stroke={G} strokeWidth="0.8" />
        <text y="5.4" textAnchor="middle" fontSize="5" fontFamily="var(--font-plex)" fill={G}>T-1</text>
      </g>
      <path d="M146 58 C 120 70, 100 90, 110 108 S 86 150, 92 164 S 130 200, 160 190" fill="none" stroke={G} strokeWidth="0.6" strokeDasharray="3 2" />
      <path d="M154 58 C 160 70, 160 80, 160 92 S 200 96, 210 108 S 232 150, 228 164" fill="none" stroke={G} strokeWidth="0.6" strokeDasharray="1 2" />
      <path d="M146 58 C 100 60, 70 80, 60 104 M154 58 C 210 60, 250 76, 262 100" fill="none" stroke={G} strokeWidth="0.6" strokeDasharray="3 2" opacity="0.8" />
      {pls.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <circle r="7" fill="#f3efe6" opacity="0.8" />
          {Array.from({ length: 8 }, (_, k) => (
            <line key={k} x1={Math.round(Math.cos((k * Math.PI) / 4) * 4.2 * 100) / 100} y1={Math.round(Math.sin((k * Math.PI) / 4) * 4.2 * 100) / 100} x2={Math.round(Math.cos((k * Math.PI) / 4) * 6.4 * 100) / 100} y2={Math.round(Math.sin((k * Math.PI) / 4) * 6.4 * 100) / 100} stroke={G} strokeWidth="0.5" />
          ))}
          <circle r="2.8" fill="#f3efe6" stroke={G} strokeWidth="0.8" />
          <circle r="0.9" fill={G} />
          <text x="7" y="-6" fontSize="4.8" fontFamily="var(--font-plex)" fill={G}>PL-{i + 1}</text>
        </g>
      ))}
      {[
        [60, 104],
        [262, 100],
      ].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <path d="M0 0 L-16 -26 A 18 18 0 0 1 16 -26 Z" fill="none" stroke={G} strokeWidth="0.4" strokeDasharray="1.5 1.5" />
          <path d="M-3.5 2.5 L0 -3.5 L3.5 2.5 Z" fill={G} />
          <text x="6" y="8" fontSize="4.8" fontFamily="var(--font-plex)" fill={G}>UL-{i + 1}</text>
        </g>
      ))}
      <g transform="translate(18 198)">
        <rect width="118" height="26" fill="#f3efe6" stroke={G} strokeWidth="0.5" />
        <text x="5" y="10" fontSize="5" fontFamily="var(--font-plex)" fill={G}>ALL FIXTURES 2700K · 12V LED</text>
        <text x="5" y="19" fontSize="5" fontFamily="var(--font-plex)" fill={G}>PHOTOCELL ON · TIMER OFF 11:30</text>
      </g>
    </Frame>
  );
}

const SHEETS = [
  { key: "L-1", el: <SitePlan />, caption: "Site plan: stone, beds, trees, every dimension." },
  { key: "L-2", el: <Grading />, caption: "Grading & drainage: where the water goes." },
  { key: "L-3", el: <Perspective />, caption: "The perspective — drawn from your yard." },
  { key: "L-4", el: <Lighting />, caption: "Lighting: fixtures, circuits, the evening." },
];

function Sheet({ i, fan, children, caption, active, onHover, phone }: { i: number; fan: MotionValue<number>; children: ReactNode; caption: string; active: boolean; onHover: (v: number | null) => void; phone: boolean }) {
  const k = i - 1.5;
  // desktop: a fan, a little left of centre so the last sheet (and its hover) stays inside;
  // phone: a cascading hand of sheets
  const rotate = useTransform(fan, (f) => (phone ? k * 3.5 : k * 6) * f);
  const x = useTransform(fan, (f) => `${(phone ? k * 7 : k * 30 - 4) * f}%`);
  const y = useTransform(fan, (f) => `${(phone ? k * 22 + 33 : Math.abs(k) * 6) * f - (active ? 5 : 0)}%`);
  return (
    <motion.figure
      // the perspective drawn from this very garden (L-3) sits on top of the hand at rest
      style={{ rotate, x, y, zIndex: active ? 10 : i === 2 ? 5 : i, transformOrigin: "50% 120%" }}
      onHoverStart={() => onHover(i)}
      onHoverEnd={() => onHover(null)}
      onTap={() => onHover(i)}
      onFocus={() => onHover(i)}
      onBlur={() => onHover(null)}
      tabIndex={0}
      className={`absolute outline-none ${phone ? "left-[9%] top-[4%] w-[82%]" : "left-[25%] top-[14%] w-[50%]"}`}
    >
      <div
        className={`aspect-[3/2] w-full shadow-[0_30px_60px_-30px_rgba(0,0,0,0.75),0_2px_0_rgba(255,255,255,0.08)_inset] transition-transform duration-300 ${active ? "scale-[1.04]" : ""}`}
      >
        {children}
      </div>
      <figcaption className={`mt-3 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-vellum/70 transition-opacity duration-300 ${active ? "opacity-100" : "opacity-0"}`}>
        {caption}
      </figcaption>
    </motion.figure>
  );
}

export function Sheets() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [hover, setHover] = useState<number | null>(null);
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const raw = useTransform(scrollYProgress, [0.25, 0.95], [0, 1]);
  const fan = useSpring(raw, { stiffness: 70, damping: 20 });
  const one = useTransform(fan, () => 1);
  return (
    <section ref={ref} id="design" data-nav="dark" className="relative overflow-hidden bg-dusk text-vellum">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_72%_40%,rgba(94,107,74,0.28),transparent_70%)]" />
      <div className="relative mx-auto grid max-w-[1500px] grid-cols-1 items-center gap-12 px-5 pb-24 pt-24 sm:px-8 lg:grid-cols-12 lg:gap-10 lg:px-10 lg:py-36">
        <div className="lg:col-span-5 lg:pr-6">
          <p className="eyebrow text-warm/80">The design</p>
          <h2 className="display mt-6 text-[2.9rem] sm:text-6xl lg:text-[4.6rem]">
            <Words text="You’ll see it" />
            <br />
            <Words italic="before we dig." delay={0.12} />
          </h2>
          <Rise delay={0.2} className="mt-8 max-w-md text-[15.5px] leading-relaxed text-vellum/75">
            Terraces, walls, planting and light on {site.region}, built by the same crew that drew them. Nobody can picture a
            fifty-thousand-dollar yard from a napkin sketch, so we don’t hand you one. You get the set a builder works from — plan,
            grading, the perspective you just scrolled through, and a lighting plan — with a fixed price attached.
          </Rise>
          <Rise delay={0.28} className="mt-9 border-y border-vellum/15 py-6">
            <p className="display text-[1.7rem] leading-tight sm:text-[2rem]">
              Design in {site.designWeeks}
              <Sample className="text-vellum" />, <em>fee credited when we build.</em>
            </p>
            <p className="mt-3 font-mono text-[12px] uppercase tracking-[0.1em] text-vellum/60">
              Design fee {site.designFee}
              <Sample className="text-vellum" /> · yours to keep either way
            </p>
          </Rise>
          <Rise delay={0.34}>
            <ol className="mt-8 space-y-4 font-mono text-[12px] leading-relaxed text-vellum/70">
              {[
                ["Week 1", "Site walk, measure, soils. What you love, what floods."],
                ["Week 2", "Two concepts on vellum, a budget band for each."],
                ["Weeks 3–4", "The set: plan, grading, planting, lighting, a fixed quote."],
              ].map(([w, t]) => (
                <li key={w} className="grid grid-cols-[88px_1fr] gap-3">
                  <span className="uppercase tracking-[0.1em] text-warm/80">{w}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>
          </Rise>
          <Rise delay={0.4} className="mt-10 flex flex-wrap items-center gap-6">
            <a href="#reserve" className="pill">
              Start with a design <span aria-hidden>↗</span>
            </a>
            <span className="text-[13px] text-vellum/55">A small yes in November. A garden by June.</span>
          </Rise>
        </div>
        <div className="relative lg:col-span-7">
          <div className={`relative mx-auto w-full max-w-[820px] ${phone ? "aspect-[4/5]" : "aspect-[4/3]"}`} onMouseLeave={() => setHover(null)}>
            {SHEETS.map((s, i) => (
              <Sheet key={s.key} i={i} fan={reduce ? one : fan} caption={s.caption} active={hover === i} onHover={setHover} phone={phone}>
                {s.el}
              </Sheet>
            ))}
          </div>
          <p className="-mt-2 text-center font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/45 lg:hidden">Tap a sheet to bring it forward</p>
        </div>
      </div>
    </section>
  );
}
