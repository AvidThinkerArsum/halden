"use client";

import { animate, motion, useMotionValue, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "framer-motion";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Rise, Words } from "@/components/ui/Reveal";
import { site } from "@/lib/site";

const G = "#262826";
type Mode = "ours" | "quick";

/** What goes under a terrace and behind its wall. `skip` = what the quick quote leaves out. */
const LAYERS = [
  { id: "stone", n: 1, name: "Bluestone, 1½\" thermal", why: "What you see. Also the only line the quick quote prices properly.", skip: false },
  { id: "bed", n: 2, name: "1\" mortar setting bed", why: "Every stone at one height, with a 2% fall so rain leaves the terrace.", skip: false },
  { id: "base", n: 3, name: "8\" crushed base, in 2\" lifts", why: "The terrace’s real foundation. A thin base is why patios rock by year three.", skip: true, quick: "2\" of base, not compacted" },
  { id: "geo", n: 4, name: "Geotextile separator", why: `Keeps ${site.regionShort} clay from pumping up into the base every wet winter.`, skip: true },
  { id: "rock", n: 5, name: "Clean ¾\" drain rock", why: "Lets water reach the drain instead of pressing on the wall.", skip: true },
  { id: "drain", n: 6, name: "4\" perforated drain, to daylight", why: "Water behind a wall is what pushes it over. This carries it away.", skip: true },
  { id: "grid", n: 7, name: "Geogrid, every second course", why: "Ties the wall back into the hill. Required on walls over 4'.", skip: true },
  { id: "conduit", n: 8, name: "Lighting conduit, laid first", why: "So adding lights never means lifting stone.", skip: true },
] as const;

type Id = (typeof LAYERS)[number]["id"];

// ---------- axonometric geometry ----------
const S = 27;
const C30 = 0.866, S30 = 0.5;
const OX = 400, OY = 330;
const r2 = (v: number) => Math.round(v * 100) / 100;
type V3 = [number, number, number];
/** x runs right-back, z runs left-front (toward you), y is up. */
function P([x, y, z]: V3): [number, number] {
  return [r2(OX + (x - z) * C30 * S), r2(OY + (x + z) * S30 * S - y * S)];
}
const pts = (vs: V3[]) => vs.map((v) => P(v).join(",")).join(" ");

/** The three visible faces of a box: top, front (z = z1), right (x = x1). */
function boxFaces(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  return {
    top: pts([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]]),
    front: pts([[x0, y1, z1], [x1, y1, z1], [x1, y0, z1], [x0, y0, z1]]),
    right: pts([[x1, y1, z1], [x1, y1, z0], [x1, y0, z0], [x1, y0, z1]]),
  };
}

function Box({ b, top, front, right, sw = 1, topFill, frontFill, rightFill }: { b: [number, number, number, number, number, number]; top: string; front: string; right: string; sw?: number; topFill?: string; frontFill?: string; rightFill?: string }) {
  const f = boxFaces(...b);
  return (
    <g stroke={G} strokeWidth={sw} strokeLinejoin="round">
      <polygon points={f.front} fill={front} />
      {frontFill && <polygon points={f.front} fill={frontFill} />}
      <polygon points={f.right} fill={right} />
      {rightFill && <polygon points={f.right} fill={rightFill} />}
      <polygon points={f.top} fill={top} />
      {topFill && <polygon points={f.top} fill={topFill} />}
    </g>
  );
}

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

// block footprint and layer heights (schematic, not to scale)
const W = 12, D = 7;
const Y = { clay: [0, 2.3], geo: [2.3, 2.42], base: [2.42, 4.62], bed: [4.62, 4.98], stone: [4.98, 5.55] } as const;
const QUICK_BASE_BOTTOM = 4.0;

/** Flagstones on the terrace: a jittered grid with shared corners, projected. */
const FLAGS = (() => {
  const rnd = rng(21);
  const cols = 6, rows = 4;
  const V: [number, number][][] = [];
  for (let j = 0; j <= rows; j++) {
    V.push([]);
    for (let i = 0; i <= cols; i++) {
      const edgeX = i === 0 || i === cols, edgeZ = j === 0 || j === rows;
      V[j].push([(i / cols) * W + (edgeX ? 0 : (rnd() - 0.5) * 1.1), (j / rows) * D + (edgeZ ? 0 : (rnd() - 0.5) * 0.8)]);
    }
  }
  const out: { poly: string; shade: number; dy: number; rot: number }[] = [];
  const y = Y.stone[1];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const q = [V[j][i], V[j][i + 1], V[j + 1][i + 1], V[j + 1][i]];
      const ins = 0.07;
      const cx = q.reduce((a, p) => a + p[0], 0) / 4, cz = q.reduce((a, p) => a + p[1], 0) / 4;
      const poly = pts(q.map(([x, z]) => [x + (cx - x) * ins, y, z + (cz - z) * ins] as V3));
      out.push({ poly, shade: rnd(), dy: -2 - rnd() * 12, rot: (rnd() - 0.5) * 9 });
    }
  return out;
})();

const GRAVEL = (() => {
  const rnd = rng(8);
  return Array.from({ length: 90 }, () => [rnd(), rnd(), 0.8 + rnd() * 1.6] as const);
})();

/** Phones: the drawing is cropped and tags shrink to numbered pins (the list explains them). */
const Compact = createContext(false);

function Tag({ n, label, at, off, side = "left", to }: { n: number; label: string; at: [number, number]; off: boolean; side?: "left" | "right"; to?: number }) {
  const compact = useContext(Compact);
  const [x, y] = at;
  if (compact) {
    const col = off ? "#8c8f8a" : G;
    const px = side === "left" ? x - 30 : x + 30;
    return (
      <g opacity={off ? 0.6 : 1}>
        <line x1={x} y1={y} x2={px} y2={y} stroke={col} strokeWidth="1.2" />
        <circle cx={x} cy={y} r="3.4" fill={col} />
        <circle cx={px} cy={y} r="17" fill="#f3efe6" stroke={col} strokeWidth="1.8" />
        <text x={px} y={y + 6} textAnchor="middle" fontSize="18" fontFamily="var(--font-plex)" fill={col}>
          {n}
        </text>
      </g>
    );
  }
  const lx = side === "left" ? 30 : (to ?? x + 70);
  const col = off ? "#8c8f8a" : G;
  const textW = label.length * 6.9 + 24;
  return (
    <g opacity={off ? 0.6 : 1}>
      <line x1={x} y1={y} x2={side === "left" ? lx + textW + 8 : lx - 14} y2={y} stroke={col} strokeWidth="0.7" strokeDasharray={off ? "3 3" : undefined} />
      <circle cx={x} cy={y} r="2.4" fill={col} />
      <g transform={`translate(${lx} ${y})`}>
        <circle cx="0" cy="0" r="10.5" fill="#f3efe6" stroke={col} strokeWidth="1.1" />
        <text y="4" textAnchor="middle" fontSize="11" fontFamily="var(--font-plex)" fill={col}>
          {n}
        </text>
        <text x="17" y="4" fontSize="11" fontFamily="var(--font-plex)" letterSpacing="0.6" fill={col} textDecoration={off ? "line-through" : undefined}>
          {label.toUpperCase()}
        </text>
      </g>
    </g>
  );
}

/** A layer that lifts with the scroll (dy, screen px) or slides along the x axis (dx, model units). */
function Lift({ spread, dy = 0, dx = 0, children, off, offOpacity = 0.13 }: { spread: MotionValue<number>; dy?: number; dx?: number; children: React.ReactNode; off?: boolean; offOpacity?: number }) {
  const y = useTransform(spread, (s) => -s * dy + s * dx * S30 * S);
  const x = useTransform(spread, (s) => s * dx * C30 * S);
  return (
    <motion.g style={{ x, y }}>
      <motion.g animate={{ opacity: off ? offOpacity : 1 }} transition={{ duration: 0.7 }}>
        {children}
      </motion.g>
    </motion.g>
  );
}

function Section({ spread, mode, year3 }: { spread: MotionValue<number>; mode: Mode; year3: boolean }) {
  const compact = useContext(Compact);
  const quick = mode === "quick";
  const off = (id: Id) => quick && LAYERS.find((l) => l.id === id)!.skip;
  // the quick quote's base is a quarter as deep; clay comes up to meet it
  const seam = useMotionValue<number>(Y.base[0]);
  useEffect(() => {
    const c = animate(seam, quick ? QUICK_BASE_BOTTOM : Y.base[0], { duration: 0.8, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [quick, seam]);
  const baseFront = useTransform(seam, (b) => boxFaces(0, W, b, Y.base[1], 0, D).front);
  const baseRight = useTransform(seam, (b) => boxFaces(0, W, b, Y.base[1], 0, D).right);
  const clayFront = useTransform(seam, (b) => boxFaces(0, W, Y.clay[0], b - (Y.base[0] - Y.clay[1]), 0, D).front);
  const clayRight = useTransform(seam, (b) => boxFaces(0, W, Y.clay[0], b - (Y.base[0] - Y.clay[1]), 0, D).right);
  const clayTopF = useTransform(seam, (b) => boxFaces(0, W, Y.clay[0], b - (Y.base[0] - Y.clay[1]), 0, D).top);
  const baseF = boxFaces(0, W, Y.base[0], Y.base[1], 0, D);
  const gridOn = useTransform(spread, [0.35, 0.8], [0, 1]);
  const tagsOn = useTransform(spread, [0.25, 0.6], [0, 1]);
  const EX = { stone: 158, bed: 116, conduit: 84, base: 56, geo: 26 };
  const WALL_DX = 4.2, ROCK_DX = 1.8;
  const wallX0 = W + 1.1, wallX1 = W + 2.5;
  return (
    <svg viewBox={compact ? "190 90 740 570" : "0 0 1000 660"} className="h-auto w-full" role="img" aria-label="An exploded axonometric of a terrace and retaining wall, every layer pulled apart and numbered">
      <defs>
        <pattern id="lx-earth" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="9" stroke={G} strokeWidth="0.55" opacity="0.4" />
        </pattern>
        <pattern id="lx-gravel" patternUnits="userSpaceOnUse" width="26" height="18">
          {GRAVEL.slice(0, 14).map(([a, b, r], i) => (
            <circle key={i} cx={r2(a * 26)} cy={r2(b * 18)} r={r2(r * 0.9)} fill="none" stroke={G} strokeWidth="0.5" opacity="0.65" />
          ))}
        </pattern>
        <pattern id="lx-sand" patternUnits="userSpaceOnUse" width="5" height="5">
          <circle cx="1.2" cy="1.2" r="0.55" fill={G} opacity="0.45" />
          <circle cx="3.7" cy="3.4" r="0.45" fill={G} opacity="0.35" />
        </pattern>
        <pattern id="lx-fabric" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(30)">
          <path d="M0 3 H6 M3 0 V6" stroke={G} strokeWidth="0.35" opacity="0.5" />
        </pattern>
        <pattern id="lx-rock" patternUnits="userSpaceOnUse" width="16" height="14">
          <circle cx="4" cy="4" r="3.1" fill="none" stroke={G} strokeWidth="0.6" />
          <circle cx="12" cy="9" r="2.7" fill="none" stroke={G} strokeWidth="0.6" />
          <circle cx="5" cy="11.5" r="2" fill="none" stroke={G} strokeWidth="0.5" />
        </pattern>
      </defs>

      {/* 0 · native clay */}
      <Lift spread={spread}>
        <g stroke={G} strokeWidth="1">
          <motion.polygon points={clayFront} fill="#c9b08d" />
          <motion.polygon points={clayFront} fill="url(#lx-earth)" />
          <motion.polygon points={clayRight} fill="#b39873" />
          <motion.polygon points={clayRight} fill="url(#lx-earth)" />
          <motion.polygon points={clayTopF} fill="#d6c2a2" />
        </g>
        <text x={P([0.4, 0.5, D])[0]} y={P([0.4, 0.5, D])[1]} fontSize="10" fontFamily="var(--font-plex)" fill={G} opacity="0.7" transform={`rotate(30 ${P([0.4, 0.5, D]).join(" ")})`}>
          NATIVE CLAY
        </text>
      </Lift>

      {/* 4 · geotextile */}
      <Lift spread={spread} dy={EX.geo} off={off("geo")}>
        <Box b={[-0.25, W + 0.25, Y.geo[0], Y.geo[1], -0.25, D + 0.25]} top="#dfe3e1" front="#9ea6a5" right="#8d9594" topFill="url(#lx-fabric)" sw={0.9} />
      </Lift>

      {/* 3 · crushed base */}
      <Lift spread={spread} dy={EX.base}>
        <g stroke={G} strokeWidth="1.1">
          <motion.polygon points={baseFront} fill="#e4ddcc" />
          <motion.polygon points={baseFront} fill="url(#lx-gravel)" />
          <motion.polygon points={baseRight} fill="#d3cbb8" />
          <motion.polygon points={baseRight} fill="url(#lx-gravel)" />
          <polygon points={baseF.top} fill="#ebe5d6" />
          <polygon points={baseF.top} fill="url(#lx-gravel)" opacity="0.6" />
        </g>
        {/* lifts */}
        {!quick &&
          [3.15, 3.88].map((y) => <polyline key={y} points={pts([[0, y, D], [W, y, D], [W, y, 0]])} fill="none" stroke={G} strokeWidth="0.5" strokeDasharray="4 4" opacity="0.6" />)}
      </Lift>

      {/* 8 · lighting conduit, in a groove on the base */}
      <Lift spread={spread} dy={EX.conduit} off={off("conduit")}>
        {(() => {
          const a = P([0.6, Y.base[1] + 0.2, D - 0.55]);
          const b = P([W, Y.base[1] + 0.2, D - 0.55]);
          return (
            <g>
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={G} strokeWidth="9" strokeLinecap="round" />
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#9a5b33" strokeWidth="6.6" strokeLinecap="round" />
              <path d={`M${b[0]} ${b[1]} q 34 -6 52 -40`} fill="none" stroke="#9a5b33" strokeWidth="2.6" />
              <g transform={`translate(${r2(b[0] + 52)} ${r2(b[1] - 44)})`}>
                <rect x="-3" y="-16" width="6" height="16" fill={G} />
                <path d="M-8 -16 H8 L5 -22 H-5 Z" fill={G} />
                <circle cy="-10" r="16" fill="#ffb46b" opacity="0.18" />
              </g>
            </g>
          );
        })()}
      </Lift>

      {/* 2 · setting bed */}
      <Lift spread={spread} dy={EX.bed}>
        <Box b={[0, W, Y.bed[0], Y.bed[1], 0, D]} top="#e9e2d2" front="#d8cfbb" right="#c8bfa9" frontFill="url(#lx-sand)" rightFill="url(#lx-sand)" topFill="url(#lx-sand)" sw={0.9} />
      </Lift>

      {/* 1 · bluestone */}
      <Lift spread={spread} dy={EX.stone}>
        <Box b={[0, W, Y.stone[0], Y.stone[1], 0, D]} top="#4f575b" front="#7b8488" right="#6a7377" sw={1.1} />
        {FLAGS.map((f, i) => (
          <motion.g
            key={i}
            animate={year3 ? { y: f.dy, rotate: f.rot } : { y: 0, rotate: 0 }}
            transition={{ duration: 1.1, delay: year3 ? i * 0.025 : 0, ease: [0.34, 1.5, 0.64, 1] }}
            style={{ transformBox: "fill-box", transformOrigin: "50% 50%" }}
          >
            <polygon points={f.poly} fill={`hsl(200 ${6 + f.shade * 5}% ${56 + f.shade * 12}%)`} stroke={G} strokeWidth="0.8" strokeLinejoin="round" />
          </motion.g>
        ))}
        <motion.ellipse cx={P([4, Y.stone[1], 3.5])[0]} cy={P([4, Y.stone[1], 3.5])[1]} rx="70" ry="16" fill="#86aec4" initial={false} animate={{ opacity: year3 ? 0.6 : 0 }} transition={{ duration: 0.8, delay: year3 ? 0.7 : 0 }} />
      </Lift>

      {/* 5 · drain rock, 6 · pipe to daylight */}
      <Lift spread={spread} dx={ROCK_DX} off={off("rock")}>
        <Box b={[W, W + 1.1, 0.9, Y.base[1], 0, D]} top="#ece6d8" front="#e1dac8" right="#d4ccb8" frontFill="url(#lx-rock)" rightFill="url(#lx-rock)" topFill="url(#lx-rock)" sw={0.9} />
      </Lift>
      <Lift spread={spread} dx={ROCK_DX} off={off("drain")} offOpacity={0}>
        {(() => {
          const back = P([W + 0.55, 1.15, -0.2]);
          const front = P([W + 0.55, 1.15, D + 1.9]);
          return (
            <g>
              <line x1={back[0]} y1={back[1]} x2={front[0]} y2={front[1]} stroke={G} strokeWidth="15" strokeLinecap="butt" />
              <line x1={back[0]} y1={back[1]} x2={front[0]} y2={front[1]} stroke="#f3efe6" strokeWidth="12.6" strokeLinecap="butt" />
              <line x1={back[0]} y1={back[1]} x2={front[0]} y2={front[1]} stroke={G} strokeWidth="2" strokeDasharray="1.5 7" />
              <ellipse cx={front[0]} cy={front[1]} rx="6.6" ry="7.6" fill="#f3efe6" stroke={G} strokeWidth="1.1" />
              <path d={`M${r2(front[0] - 10)} ${r2(front[1] + 12)} l -26 15 m 7 -1 l -7 1 l 3 -7`} stroke="#5e8fa8" strokeWidth="1.6" fill="none" />
            </g>
          );
        })()}
      </Lift>

      {/* the wall, and 7 · the geogrid tied into it */}
      <Lift spread={spread} dx={WALL_DX}>
        <motion.g style={{ opacity: gridOn }}>
          <motion.g animate={{ opacity: off("grid") ? 0.13 : 1 }}>
            {[1.9, 3.6].map((y) => (
              <g key={y}>
                <polygon points={pts([[wallX0 - WALL_DX + 0.3, y, 0], [wallX0, y, 0], [wallX0, y, D], [wallX0 - WALL_DX + 0.3, y, D]])} fill="#f3efe6" fillOpacity="0.55" stroke={G} strokeWidth="0.9" strokeDasharray="6 3" />
                {Array.from({ length: 6 }, (_, k) => {
                  const x = wallX0 - WALL_DX + 0.3 + ((k + 0.5) / 6) * (WALL_DX - 0.3);
                  return <line key={k} x1={P([x, y, 0])[0]} y1={P([x, y, 0])[1]} x2={P([x, y, D])[0]} y2={P([x, y, D])[1]} stroke={G} strokeWidth="0.45" />;
                })}
                {Array.from({ length: 5 }, (_, k) => {
                  const z = ((k + 0.5) / 5) * D;
                  return <line key={k} x1={P([wallX0 - WALL_DX + 0.3, y, z])[0]} y1={P([wallX0 - WALL_DX + 0.3, y, z])[1]} x2={P([wallX0, y, z])[0]} y2={P([wallX0, y, z])[1]} stroke={G} strokeWidth="0.45" />;
                })}
              </g>
            ))}
          </motion.g>
        </motion.g>
        <motion.g
          animate={{ rotate: year3 ? 7 : 0 }}
          transition={{ duration: 1.3, ease: [0.34, 1.3, 0.64, 1] }}
          style={{ transformBox: "fill-box", transformOrigin: "100% 100%" }}
        >
          <Box b={[wallX0 - 0.1, wallX1 + 0.15, -0.5, 0.05, -0.1, D + 0.1]} top="#e2dccd" front="#d6cfbf" right="#cbc3b1" sw={0.9} />
          {[0, 1, 2, 3].map((c) => {
            const y0 = 0.05 + c * 1.3, y1 = y0 + 1.3;
            const splits = c % 2 ? [0, 2.4, 4.8, D] : [0, 1.3, 3.6, 5.9, D];
            return splits.slice(0, -1).map((z0, k) => (
              <Box key={`${c}-${k}`} b={[wallX0, wallX1, y0, y1, z0, splits[k + 1]]} top="#cfc7b6" front="#b9b09d" right="#a89f8b" sw={1} />
            ));
          })}
          <Box b={[wallX0 - 0.15, wallX1 + 0.2, 5.25, 5.7, -0.1, D + 0.1]} top="#ddd6c7" front="#c4bba8" right="#b3aa96" sw={1.1} />
          <path d={`M${P([wallX1, 3.7, D - 2]).join(" ")} l 6 18 l -7 14 l 9 20`} fill="none" stroke={G} strokeWidth="1.3" opacity={year3 ? 1 : 0} />
        </motion.g>
        <text x={P([wallX1, 0, D + 0.4])[0] + 14} y={P([wallX1, 0, D + 0.4])[1] + 14} fontSize="10" fontFamily="var(--font-plex)" fill={G} opacity="0.7">
          BASALT BLOCK WALL
        </text>
      </Lift>

      {/* callouts ride with their layers, and fade when the block is closed up */}
      <motion.g style={{ opacity: tagsOn }}>
      <Lift spread={spread} dy={EX.stone}>
        <Tag n={1} label="Bluestone" at={P([0, Y.stone[1] - 0.2, D])} off={false} />
      </Lift>
      <Lift spread={spread} dy={EX.bed}>
        <Tag n={2} label="Setting bed" at={P([0, Y.bed[1] - 0.15, D])} off={false} />
      </Lift>
      <Lift spread={spread} dy={EX.conduit}>
        {compact ? (
          <Tag n={8} label="Light conduit" at={P([W - 2.2, Y.base[1] + 0.2, D - 0.55])} off={quick} side="right" />
        ) : (
          <Tag n={8} label="Light conduit" at={P([0.6, Y.base[1] + 0.2, D - 0.55])} off={quick} />
        )}
      </Lift>
      <Lift spread={spread} dy={EX.base}>
        <Tag n={3} label={quick ? '2" base, loose' : '8" crushed base'} at={P([0, 3.6, D])} off={quick} />
      </Lift>
      <Lift spread={spread} dy={EX.geo}>
        <Tag n={4} label="Geotextile" at={P([0, Y.geo[1], D - 0.2])} off={quick} />
      </Lift>
      <Lift spread={spread} dx={ROCK_DX}>
        <Tag n={6} label="Drain to daylight" at={P([W + 0.55, 1.15, D + 1.9])} off={quick} />
      </Lift>
      <Lift spread={spread} dx={ROCK_DX}>
        <Tag n={5} label="Drain rock" at={P([W + 0.55, Y.base[1], 0.9])} off={quick} side="right" to={r2(880 - ROCK_DX * C30 * S)} />
      </Lift>
      <motion.g style={{ opacity: gridOn }}>
        <Lift spread={spread} dx={WALL_DX}>
          <Tag n={7} label="Geogrid" at={P([wallX0 - 0.6, 3.6, 0.6])} off={quick} side="right" to={r2(880 - WALL_DX * C30 * S)} />
        </Lift>
      </motion.g>
      </motion.g>

      <motion.g initial={false} animate={{ opacity: year3 ? 1 : 0, y: year3 ? 0 : 8 }} transition={{ duration: 0.6, delay: year3 ? 1 : 0 }}>
        <text x={compact ? 920 : 990} y={compact ? 150 : 52} textAnchor="end" fontSize="44" fontFamily="var(--font-plex)" fill="#9a5b33" letterSpacing="3">
          YEAR 3
        </text>
        <text x={compact ? 920 : 990} y={compact ? 176 : 76} textAnchor="end" fontSize={compact ? 15 : 11} fontFamily="var(--font-plex)" fill={G} letterSpacing="1">
          {compact ? "HEAVED · PONDING · LEANING" : "HEAVED STONE · A TERRACE THAT PONDS · A WALL LEANING OUT"}
        </text>
      </motion.g>
      <text x={compact ? 920 : 990} y="648" textAnchor="end" fontSize="9" fontFamily="var(--font-plex)" fill={G} opacity="0.45" letterSpacing="1">
        SCHEMATIC · NOT TO SCALE
      </text>
    </svg>
  );
}

export function Layers() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const [mode, setMode] = useState<Mode>("ours");
  const [year3, setYear3] = useState(false);
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const target = useTransform(scrollYProgress, [0.18, 0.46], [0, 1]);
  const spread = useSpring(0, { stiffness: 60, damping: 18 });
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
    spread.set(mode === "quick" ? 0 : reduce ? 1 : target.get());
    if (mode !== "quick") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setYear3(false);
      return;
    }
    const t = setTimeout(() => setYear3(true), 900);
    return () => clearTimeout(t);
  }, [mode, reduce, spread, target]);
  useMotionValueEvent(target, "change", (v) => {
    if (modeRef.current === "ours") spread.set(reduce ? 1 : v);
  });

  return (
    <section ref={ref} id="build" data-nav="light" className="paper relative overflow-hidden text-graphite">
      <div className="mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-10 lg:py-36">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="eyebrow text-cedar">Under the stone</p>
            <h2 className="display mt-6 text-[2.7rem] sm:text-6xl lg:text-[4.4rem]">
              <Words text="Most of what you pay for," />
              <br />
              <Words italic="you’ll never see." delay={0.15} />
            </h2>
          </div>
          <Rise delay={0.15} className="self-end text-[15.5px] leading-relaxed text-graphite/75 lg:col-span-5">
            Holding a quote at a third of ours? It usually isn’t cheaper stone. It’s the eight inches under it, the drain behind the
            wall, and the grid that ties the wall into the hill. Toggle it and see what gets left out.
          </Rise>
        </div>

        <div className="mt-12 flex flex-wrap items-center gap-3" role="radiogroup" aria-label="Compare builds">
          {(
            [
              ["ours", `The ${site.name} build`],
              ["quick", "The quick quote"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              role="radio"
              aria-checked={mode === m}
              onClick={() => setMode(m)}
              className={`chip rounded-full border px-5 py-2.5 text-[13.5px] font-medium transition ${
                mode === m ? (m === "quick" ? "border-cedar bg-cedar text-vellum" : "border-graphite bg-graphite text-vellum") : "border-graphite/30 text-graphite/70 hover:border-graphite/60"
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-1 font-mono text-[11px] uppercase tracking-[0.12em] text-graphite/50">{mode === "quick" ? "Same stone. Less of everything else." : "Pulled apart, as built"}</span>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-8">
            <div className="border border-graphite/15 bg-vellum px-2 py-4 sm:px-6">
              <Compact.Provider value={phone}>
                <Section spread={spread} mode={mode} year3={year3} />
              </Compact.Provider>
            </div>
          </div>
          <ol className="grid grid-cols-1 gap-x-6 gap-y-4 self-center sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
            {LAYERS.map((l) => {
              const off = mode === "quick" && l.skip;
              return (
                <li key={l.id} className={`grid grid-cols-[28px_1fr] gap-3 transition-opacity duration-500 ${off ? "opacity-60" : ""}`}>
                  <span className={`mt-0.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border font-mono text-[11px] ${off ? "border-stone text-stone" : "border-graphite"}`}>{l.n}</span>
                  <div>
                    <p className="font-mono text-[11.5px] uppercase tracking-[0.08em]">
                      <span className={off ? "line-through decoration-cedar decoration-2" : ""}>{l.name}</span>
                      {off && <span className="ml-2 text-cedar no-underline">{"quick" in l ? l.quick : "Skipped"}</span>}
                    </p>
                    <p className="mt-1 text-[13.5px] leading-snug text-graphite/70">{l.why}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
