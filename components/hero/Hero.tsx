"use client";

import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { heroSrc, site, type Callout } from "@/lib/site";
import { useSeason } from "@/lib/season";
import { loadImage, processPhoto, sketchToPaper, type Processed } from "@/lib/hero/process";
import { HeroGL, coverRect, type Rect } from "@/lib/hero/gl";
import { buildAt, duskAt, isBuilt, lightLevels, stageAt, TITLE, TL, type Stage } from "@/lib/hero/timeline";
import { publishLit, publishSketch, renderLit } from "@/lib/hero/store";
import { Callouts, Construction, Fixtures, placeCallouts, type Tone } from "./Callouts";
import { TitleBlock } from "./TitleBlock";
import { Fallback } from "./Fallback";
import { Strip } from "./Strip";
import { Trace } from "./Trace";
import { Sample } from "@/components/ui/Sample";

const HERO = site.hero;
/** Order the fixtures come on: round the terrace from the front left, then the two trees. */
const LIGHT_ORDER = [0, 1, 2, 3, 4, 5, 6, 7];
const MONTH_OF: Record<Callout["stage"], string> = { stone: "Mar", planting: "Apr", finish: "Jul", light: "Jul" };
/** `?masks` and `?trace` are for fitting a new photo: development builds only. */
const DEV_TOOLS = process.env.NODE_ENV !== "production";

type Mode = "loading" | "gl" | "fallback";

/**
 * Reduced motion gets the static strip. Decided after mount so the server HTML (the pinned
 * hero) always matches the first client render.
 */
export function Hero() {
  const prefers = useReducedMotion();
  const { copy } = useSeason();
  const [strip, setStrip] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStrip(!!prefers);
  }, [prefers]);
  return strip ? <Strip copy={copy} /> : <PinnedHero />;
}

function PinnedHero() {
  const ref = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<HeroGL | null>(null);
  const reduce = useReducedMotion();
  const { copy } = useSeason();

  const [vp, setVp] = useState({ w: 1440, h: 900 });
  const [mode, setMode] = useState<Mode>("loading");
  const [processed, setProcessed] = useState<Processed | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [plotted, setPlotted] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dev, setDev] = useState({ masks: false, trace: false, nogl: false });
  const tbRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const [tbH, setTbH] = useState(0);
  // the title block steps aside wherever it would sit under the line (phones, tablets)
  const [tbYield, setTbYield] = useState(false);
  useEffect(() => {
    const el = tbRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setTbH(Math.round(el.offsetHeight)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const mobile = vp.w < 768;
  const focal = mobile ? HERO.focal.mobile : HERO.focal.desktop;
  const lights = mobile && HERO.lightsMobile ? HERO.lightsMobile : HERO.lights;
  const rect: Rect = useMemo(() => coverRect(vp.w, vp.h, HERO.photo.aspect, focal), [vp, focal]);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useEffect(() => {
    const gl = glRef.current;
    if (!gl) return;
    gl.setLights(lights);
    gl.setLevels(lightLevels(scrollYProgress.get(), lights.length, LIGHT_ORDER));
  }, [lights, scrollYProgress]);

  // ---- discrete state that React renders (stage, callout ticks, tones) ----
  const [snap, setSnap] = useState<{ stage: Stage; built: Record<string, boolean>; tones: Record<string, Tone>; head: boolean }>({
    stage: "drawn",
    built: {},
    tones: {},
    head: false,
  });
  const revealAt = useRef<Record<string, number>>({});

  const computeSnap = useCallback(
    (p: number) => {
      const b = buildAt(p);
      const d = duskAt(p);
      const built: Record<string, boolean> = {};
      const tones: Record<string, Tone> = {};
      for (const c of HERO.callouts) {
        built[c.id] = isBuilt(c.stage, p);
        const r = revealAt.current[c.id] ?? 0.5;
        tones[c.id] = d > 0.45 ? "dusk" : b > r + 0.01 ? "photo" : "paper";
      }
      return { stage: stageAt(p), built, tones, head: p >= TL.head[0] + 0.02 };
    },
    [],
  );

  const apply = useCallback(
    (p: number) => {
      const gl = glRef.current;
      if (gl) {
        gl.set({ progress: buildAt(p), dusk: duskAt(p) });
        gl.setLevels(lightLevels(p, gl.lights.length, LIGHT_ORDER));
      }
      const next = computeSnap(p);
      setSnap((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      // the nav reads dark on the drawing, light once the tree tops are built (a scrim comes
      // up with them), and gets its own ground before the line appears under it
      // (while the tree tops are half paper, half leaves, the bar takes a vellum ground instead)
      const b = buildAt(p);
      stickyRef.current?.setAttribute("data-nav", b < 0.9 ? "light" : "dark");
      stickyRef.current?.setAttribute("data-ground", (b >= 0.72 && b < 0.9) || p >= TL.head[0] - 0.04 ? "1" : "0");
    },
    [computeSnap],
  );

  useMotionValueEvent(scrollYProgress, "change", (p) => apply(reduce ? 1 : p));

  // ---- size ----
  useEffect(() => {
    const el = stickyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setVp({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    const q = new URLSearchParams(window.location.search);
    setMounted(true);
    setDev({ masks: DEV_TOOLS && q.has("masks"), trace: DEV_TOOLS && q.has("trace"), nogl: q.has("nogl") });
    return () => ro.disconnect();
  }, []);

  // ---- one photo in: load, process, hand to the shader ----
  useEffect(() => {
    let dead = false;
    const q = new URLSearchParams(window.location.search);
    const small = window.innerWidth < 768;
    (async () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      let img: HTMLImageElement;
      try {
        // no srcset: a density-corrected naturalWidth would misalign every derived map
        img = await loadImage(heroSrc(small ? 1600 : 2400));
      } catch {
        if (!dead) setMode("fallback");
        return;
      }
      if (dead) return;
      setPhotoUrl(img.currentSrc || img.src);
      const gl = q.has("nogl") ? null : canvasRef.current ? HeroGL.create(canvasRef.current) : null;
      let p: Processed;
      try {
        // phones get the same 1600px drawing: the crop is narrow, so every line counts
        p = await processPhoto({
          img,
          width: 1600,
          thresholds: HERO.thresholds,
          overrides: HERO.overrides,
          retouch: HERO.retouch,
          strokes: HERO.strokes,
          quiet: HERO.quiet,
          vp: HERO.vanishingPoint,
        });
      } catch (e) {
        // (a photo whose pixels can't be read: the SVG-filter sketch is all that is left)
        console.warn("hero: processing failed, using the SVG sketch", e);
        gl?.dispose();
        if (!dead) setMode("fallback");
        return;
      }
      if (dead) {
        gl?.dispose();
        return;
      }
      // when does each callout's feature appear (for its tone)
      for (const c of HERO.callouts) {
        const a = small && c.anchorMobile ? c.anchorMobile : c.anchor;
        const x = Math.min(p.w - 1, Math.max(0, Math.round(a[0] * p.w)));
        const y = Math.min(p.h - 1, Math.max(0, Math.round(a[1] * p.h)));
        revealAt.current[c.id] = p.maps[(y * p.w + x) * 4 + 2] / 255;
      }
      const shareSketch = () =>
        setTimeout(() => {
          if (dead) return;
          try {
            publishSketch(sketchToPaper(p, 900).toDataURL("image/jpeg", 0.86));
          } catch {
            /* ignore */
          }
        }, 400);
      if (!gl) {
        // no WebGL: the same drawing and reveal map, composited in 2D
        setProcessed(p);
        setMode("fallback");
        shareSketch();
        return;
      }
      let dusk: HTMLImageElement | null = null;
      if (HERO.duskPhoto) dusk = await loadImage(HERO.duskPhoto).catch(() => null);
      glRef.current = gl;
      gl.vp = HERO.vanishingPoint;
      gl.setLights(small && HERO.lightsMobile ? HERO.lightsMobile : HERO.lights);
      gl.setProcessed(p, dusk);
      if (DEV_TOOLS && q.has("masks")) gl.set({ mode: 1 });
      setProcessed(p);
      setMode("gl");
      // the drawing plots in, then the callouts
      const t0 = performance.now();
      const dur = reduce ? 0 : 1700;
      const step = () => {
        const k = dur ? Math.min(1, (performance.now() - t0) / dur) : 1;
        gl.set({ draw: 1 - Math.pow(1 - k, 2.2) });
        if (k < 1 && !dead) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
      setTimeout(() => !dead && setPlotted(true), reduce ? 0 : 900);
      apply(reduce ? 1 : scrollYProgress.get());
      // share the drawing with the plan sheets, and the lit garden with the close
      shareSketch();
      setTimeout(() => {
        if (dead) return;
        const lit = renderLit(p, HERO.lights, HERO.vanishingPoint);
        if (lit) publishLit(lit);
      }, 1400);
    })();
    return () => {
      dead = true;
      glRef.current?.dispose();
      glRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fallback path still gets its callouts
  useEffect(() => {
    if (mode === "fallback") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPlotted(true);
      apply(scrollYProgress.get());
    }
  }, [mode, apply, scrollYProgress]);

  // ---- view → shader ----
  useEffect(() => {
    const gl = glRef.current;
    if (!gl || !processed) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    gl.setView(Math.round(vp.w * dpr), Math.round(vp.h * dpr), { ox: rect.ox * dpr, oy: rect.oy * dpr, dw: rect.dw * dpr, dh: rect.dh * dpr });
  }, [vp, rect, processed]);

  // ---- layout of the overlay ----
  const tb = { w: mobile ? 214 : 318, h: tbH || (mobile ? 104 : 132), r: mobile ? 12 : 28, b: mobile ? 84 : 28 };
  const tbRect = { x: vp.w - tb.r - tb.w, y: vp.h - tb.b - tb.h, w: tb.w, h: tb.h };
  const cueRect = { x: 0, y: vp.h - (mobile ? 140 : 90), w: mobile ? 110 : 200, h: 90 };
  const placed = useMemo(
    () => placeCallouts(HERO.callouts, rect, vp.w, vp.h, mobile, [tbRect, cueRect], lights.map((l) => l.at), HERO.quiet),
    [rect, vp, mobile, lights, tbH], // eslint-disable-line react-hooks/exhaustive-deps
  );
  useEffect(() => {
    const el = headRef.current;
    if (!el) return;
    // measured without the entrance offset; the block is laid out even while invisible
    const hb = { l: el.offsetLeft, t: el.offsetTop, r: el.offsetLeft + el.offsetWidth, b: el.offsetTop + el.offsetHeight };
    const hit = hb.r > tbRect.x - 16 && hb.b > tbRect.y - 12 && hb.l < tbRect.x + tbRect.w;
    setTbYield(mobile || hit);
  }, [vp, tbH, mobile, copy]); // eslint-disable-line react-hooks/exhaustive-deps
  const months = useMemo(() => Object.fromEntries(HERO.callouts.map((c) => [c.id, MONTH_OF[c.stage]])), []);

  // ---- scroll-linked opacity (full 0→1 ranges so nothing fades back in) ----
  const calloutO = useTransform(scrollYProgress, [0, 0.83, 0.87, 1], [1, 1, 0, 0]);
  const fixturesO = useTransform(scrollYProgress, [0, 0.035, 0.08, 1], [1, 1, 0, 0]);
  const borderO = useTransform(scrollYProgress, [0, 0.05, 0.16, 1], [1, 1, 0, 0]);
  const cueO = useTransform(scrollYProgress, [0, 0.025, 1], [1, 0, 0]);
  const headO = useTransform(scrollYProgress, [0, TL.head[0], TL.head[1], 1], [0, 0, 1, 1]);
  const headY = useTransform(scrollYProgress, [0, TL.head[0], TL.head[1], 1], [28, 28, 0, 0]);
  const tbO = useTransform(scrollYProgress, [0, TL.head[0] - 0.02, TL.head[0] + 0.02, 1], [1, 1, 0, 0]);
  const scrimO = useTransform(scrollYProgress, [0, TL.head[0] - 0.02, TL.head[1], 1], [0, 0, 1, 1]);
  // a band of evening under the nav once the tree tops are photographs, so its ink always reads
  const topScrimO = useTransform(scrollYProgress, [0, 0.5, 0.535, 1], [0, 0, 1, 1]);

  return (
    <section ref={ref} id="top" className="relative bg-vellum" style={{ height: "500svh" }} aria-label={`${site.name}: a garden drawn, then built`}>
      <div ref={stickyRef} data-nav="light" data-ground="0" className="sticky top-0 h-[100svh] w-full overflow-hidden bg-vellum">
        <canvas ref={canvasRef} className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${mode === "gl" ? "opacity-100" : "opacity-0"}`} aria-hidden />
        {mode === "fallback" && <Fallback src={photoUrl ?? heroSrc(1600)} rect={rect} progress={scrollYProgress} processed={processed} />}
        <span className="sr-only">
          A pencil drawing of a backyard terrace becomes the finished garden as you scroll: stone first, then planting, then trees, then the lights at dusk.
        </span>

        {/* perspective construction: up first, while the drawing is still being computed */}
        <motion.div style={{ opacity: fixturesO }} className="absolute inset-0">
          <Construction rect={rect} vp={HERO.vanishingPoint} plotted={mounted} />
        </motion.div>

        {/* the sheet's border, only while it is a drawing */}
        <motion.div style={{ opacity: borderO }} className="pointer-events-none absolute inset-3 border border-graphite/35 sm:inset-5" aria-hidden>
          <div className="absolute inset-[3px] border border-graphite/15" />
        </motion.div>

        {mode !== "loading" && (
          <>
            <motion.div style={{ opacity: fixturesO }} className="absolute inset-0">
              <Fixtures lights={lights} rect={rect} plotted={plotted} />
            </motion.div>
            <motion.div style={{ opacity: calloutO }} className="absolute inset-0">
              <Callouts placed={placed} tones={snap.tones} built={snap.built} plotted={plotted} months={months} />
            </motion.div>
          </>
        )}

        {mode === "loading" && (
          <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-[0.2em] text-graphite/50">
            <span className="animate-pulse">Plotting sheet L-3</span>
          </p>
        )}

        {/* scroll cue */}
        <motion.div style={{ opacity: cueO }} className={`pointer-events-none absolute left-5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-graphite/70 sm:left-8 ${mobile ? "bottom-[98px]" : "bottom-9"}`}>
          <span className="relative block h-9 w-px overflow-hidden bg-graphite/20">
            <span className="absolute inset-x-0 top-0 h-1/2 animate-[cue_1.6s_ease-in-out_infinite] bg-graphite" />
          </span>
          {mobile ? "Scroll" : "Scroll to build it"}
        </motion.div>

        {/* the title block */}
        {/* on phones the title block steps aside for the line */}
        <motion.div ref={tbRef} className="absolute z-10" style={{ right: tb.r, bottom: tb.b, opacity: tbYield ? tbO : 1 }}>
          <TitleBlock stage={snap.stage} compact={mobile} />
        </motion.div>

        <motion.div
          style={{ opacity: topScrimO }}
          className="pointer-events-none absolute inset-x-0 top-0 h-[120px] bg-[linear-gradient(to_bottom,rgba(12,18,19,0.84),rgba(12,18,19,0.5)_50%,transparent)]"
          aria-hidden
        />

        {/* blue hour: the line */}
        <motion.div
          style={{ opacity: scrimO }}
          className={`pointer-events-none absolute inset-0 ${
            mobile
              ? "bg-[linear-gradient(to_top,rgba(12,18,19,0.92)_0%,rgba(12,18,19,0.8)_42%,rgba(12,18,19,0.35)_66%,transparent_82%)]"
              : "bg-[radial-gradient(120%_85%_at_0%_100%,rgba(12,18,19,0.82)_0%,rgba(12,18,19,0.45)_42%,transparent_72%)]"
          }`}
        />
        <motion.div
          ref={headRef}
          style={{ opacity: headO, y: headY, ...(mobile ? { bottom: tb.b + 6 } : {}) }}
          className={`absolute left-5 right-5 text-vellum sm:left-10 sm:right-auto sm:max-w-[780px] ${mobile ? "" : "bottom-14 lg:left-14"} ${snap.head ? "" : "pointer-events-none"}`}
        >
          <p className="eyebrow text-warm/90">
            <span className="hidden sm:inline">
              {site.name} · {site.descriptor} ·{" "}
            </span>
            {site.town}, {site.state}
          </p>
          <h1 className="display mt-4 text-[2.7rem] leading-[0.95] sm:text-6xl lg:text-[5rem]">
            Drawn in winter.
            <br />
            <em className="text-[#f7dcc0]">Lived in by summer.</em>
          </h1>
          <p className="mt-5 max-w-[30rem] text-[15px] leading-relaxed text-vellum/80 sm:text-base">
            {copy.hero}
            <Sample className="text-vellum" />
          </p>
          <a href="#reserve" className="pill mt-7" tabIndex={snap.head ? 0 : -1}>
            {copy.pill} <span aria-hidden>↗</span>
          </a>
        </motion.div>

        {(dev.trace || dev.masks) && <Trace rect={rect} trace={dev.trace} />}
      </div>
    </section>
  );
}

export type HeroProgress = MotionValue<number>;
export { TITLE };
