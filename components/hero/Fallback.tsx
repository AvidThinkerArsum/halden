"use client";

import { motion, useMotionValueEvent, useTransform, type MotionValue } from "framer-motion";
import { useEffect, useRef } from "react";
import { site } from "@/lib/site";
import type { Rect } from "@/lib/hero/gl";
import { sketchToPaper, type Processed } from "@/lib/hero/process";
import { buildAt, duskAt, lightLevels } from "@/lib/hero/timeline";

const HERO = site.hero;

/**
 * No WebGL. The drawing and the reveal map are plain Canvas 2D, so they still exist: the
 * real sketch is shown and the photo is revealed through the same reveal-time map (stone on
 * its gritty front with the grey base ahead of it, then planting, then the rest), composited
 * on a small canvas whenever the scroll moves. Blue hour is a graded layer with glows.
 * Only when the photo can't be read at all (a tainted canvas) does the SVG-filter sketch
 * with a plain wipe stand in.
 */
export function Fallback({ src, rect, progress, processed }: { src: string; rect: Rect; progress: MotionValue<number>; processed: Processed | null }) {
  const dusk = useTransform(progress, (p) => duskAt(p) * 0.78);
  return (
    <div className="absolute inset-0" aria-hidden data-fallback>
      <div className="absolute" style={{ left: rect.ox, top: rect.oy, width: rect.dw, height: rect.dh }}>
        {processed ? <Composite p={processed} progress={progress} /> : <FilterSketch src={src} progress={progress} />}
        <motion.div className="absolute inset-0 bg-[#0d1a26] mix-blend-multiply" style={{ opacity: dusk }} />
        {HERO.lights.map((l, i) => (
          <Glow key={i} i={i} x={l.at[0]} y={l.at[1]} r={l.radius} up={l.kind === "up"} progress={progress} />
        ))}
      </div>
    </div>
  );
}

function Composite({ p, progress }: { p: Processed; progress: MotionValue<number> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const state = useRef<{ render: (b: number) => void } | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const W = Math.min(p.w, 960), H = Math.round((W * p.h) / p.w);
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    const grab = (src: CanvasImageSource) => {
      const t = document.createElement("canvas");
      t.width = W;
      t.height = H;
      const tc = t.getContext("2d", { willReadFrequently: true })!;
      tc.drawImage(src, 0, 0, W, H);
      return tc.getImageData(0, 0, W, H).data;
    };
    const photo = grab(p.photo);
    const paper = grab(sketchToPaper(p, W));
    const n = W * H;
    const T = new Float32Array(n), stone = new Uint8Array(n), noBase = new Uint8Array(n), grit = new Float32Array(n), agg = new Float32Array(n);
    const hash = (x: number, y: number) => {
      let h = (x * 374761393 + y * 668265263) | 0;
      h = Math.imul(h ^ (h >>> 13), 1274126177);
      return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
    };
    for (let y = 0; y < H; y++) {
      const sy = Math.min(p.h - 1, Math.round((y * p.h) / H));
      for (let x = 0; x < W; x++) {
        const sx = Math.min(p.w - 1, Math.round((x * p.w) / W));
        const j = (sy * p.w + sx) * 4, i = y * W + x;
        T[i] = p.maps[j + 2] / 255;
        stone[i] = p.maps[j] > 127 ? 1 : 0;
        noBase[i] = p.maps2[j] > 127 ? 1 : 0;
        // a little grit on the fronts, fixed per pixel; crushed rock in stones, not static
        grit[i] = hash(x, y);
        const cy = Math.floor(y / 3), cx = Math.floor((x + (cy % 2) * 2) / 4);
        agg[i] = hash(cx + 911, cy + 57);
      }
    }
    const img = ctx.createImageData(W, H);
    const out = img.data;
    let last = -1;
    const render = (b: number) => {
      const q = Math.round(b * 400) / 400;
      if (q === last) return;
      last = q;
      const sf = q * 1.1 - 0.06, bf = sf + 0.045;
      for (let i = 0; i < n; i++) {
        const t = T[i] + (grit[i] - 0.5) * 0.012;
        const k = i * 4;
        let src = paper;
        if (stone[i] ? t <= sf : t <= q) src = photo;
        else if (stone[i] && !noBase[i] && t <= bf) {
          // compacted base: warm grey aggregate
          const v = 104 + agg[i] * 36 + grit[i] * 8;
          out[k] = v + 6;
          out[k + 1] = v + 2;
          out[k + 2] = v - 6;
          out[k + 3] = 255;
          continue;
        }
        out[k] = src[k];
        out[k + 1] = src[k + 1];
        out[k + 2] = src[k + 2];
        out[k + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    };
    state.current = { render };
    render(buildAt(progress.get()));
    return () => {
      state.current = null;
    };
  }, [p, progress]);
  useMotionValueEvent(progress, "change", (v) => {
    const s = state.current;
    if (!s) return;
    requestAnimationFrame(() => s.render(buildAt(v)));
  });
  return <canvas ref={ref} className="absolute inset-0 h-full w-full" />;
}

/** Last resort (the photo's pixels can't be read): a filtered sketch and a wipe from the foreground. */
function FilterSketch({ src, progress }: { src: string; progress: MotionValue<number> }) {
  const clip = useTransform(progress, (p) => `inset(${Math.round((1 - buildAt(p)) * 1000) / 10}% 0 0 0)`);
  return (
    <>
      <svg width="0" height="0" className="absolute">
        <filter id="hero-sketch" colorInterpolationFilters="sRGB">
          <feColorMatrix type="saturate" values="0" />
          <feGaussianBlur stdDeviation="0.9" />
          <feConvolveMatrix order="3" kernelMatrix="-1 -1 -1 -1 8 -1 -1 -1 -1" preserveAlpha="true" />
          <feComponentTransfer>
            <feFuncR type="linear" slope="-7" intercept="1.02" />
            <feFuncG type="linear" slope="-7" intercept="1.02" />
            <feFuncB type="linear" slope="-7" intercept="1.02" />
          </feComponentTransfer>
          <feColorMatrix type="matrix" values="0.8 0 0 0 0.15  0 0.78 0 0 0.157  0 0 0.75 0 0.15  0 0 0 1 0" />
        </filter>
      </svg>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" crossOrigin="anonymous" className="absolute inset-0 h-full w-full" style={{ filter: "url(#hero-sketch)" }} />
      <motion.img src={src} alt="" crossOrigin="anonymous" className="absolute inset-0 h-full w-full" style={{ clipPath: clip }} />
    </>
  );
}

function Glow({ i, x, y, r, up, progress }: { i: number; x: number; y: number; r: number; up: boolean; progress: MotionValue<number> }) {
  const o = useTransform(progress, (p) => lightLevels(p, HERO.lights.length, HERO.lights.map((_, k) => k))[i]);
  const w = r * 260;
  return (
    <motion.div
      className="absolute rounded-full mix-blend-screen"
      style={{
        opacity: o,
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: `${w}%`,
        height: `${up ? w * 2.4 : w * 0.45}%`,
        translateX: "-50%",
        translateY: up ? "-90%" : "-50%",
        background: "radial-gradient(closest-side, rgba(255,180,107,0.75), rgba(255,160,80,0.25) 45%, transparent)",
      }}
    />
  );
}
