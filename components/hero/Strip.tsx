"use client";

import { useEffect, useState } from "react";
import { heroSrc, site } from "@/lib/site";
import type { SEASON } from "@/lib/season";
import { loadImage, processPhoto, sketchToPaper } from "@/lib/hero/process";
import { HeroGL } from "@/lib/hero/gl";
import { publishLit, publishSketch } from "@/lib/hero/store";
import { TitleBlock } from "./TitleBlock";
import { Sample } from "@/components/ui/Sample";

const HERO = site.hero;
const FRAMES = [
  { label: "Drawn", when: "January", progress: 0, dusk: 0, lights: 0 },
  { label: "Built", when: "March", progress: 0.34, dusk: 0, lights: 0 },
  { label: "Planted", when: "April", progress: 1, dusk: 0, lights: 0 },
  { label: "Lit", when: "July, 9:40 pm", progress: 1, dusk: 1, lights: 1 },
];

/** Reduced motion: the same four states, side by side, no pin and no scrubbing. */
export function Strip({ copy }: { copy: (typeof SEASON)[keyof typeof SEASON] }) {
  const [frames, setFrames] = useState<string[] | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const img = await loadImage(heroSrc(1600));
        if (dead) return;
        setPhoto(img.src);
        const p = await processPhoto({ img, width: 1100, thresholds: HERO.thresholds, overrides: HERO.overrides, retouch: HERO.retouch, strokes: HERO.strokes, quiet: HERO.quiet, vp: HERO.vanishingPoint });
        publishSketch(sketchToPaper(p, 900).toDataURL("image/jpeg", 0.86));
        const c = document.createElement("canvas");
        const gl = HeroGL.create(c);
        if (!gl || dead) return;
        gl.vp = HERO.vanishingPoint;
        gl.setLights(HERO.lights);
        gl.setProcessed(p);
        const W = 960, H = 720;
        gl.setView(W, H, { ox: 0, oy: 0, dw: W, dh: H });
        const out = FRAMES.map((f) => {
          gl.set({ progress: f.progress, dusk: f.dusk, draw: 1 });
          gl.setLevels(HERO.lights.map(() => f.lights));
          gl.render();
          return c.toDataURL("image/jpeg", 0.85);
        });
        gl.dispose();
        if (!dead) {
          setFrames(out);
          publishLit(out[3]);
        }
      } catch {
        /* keep the photo-only strip */
      }
    })();
    return () => {
      dead = true;
    };
  }, []);

  return (
    <section id="top" data-nav="light" className="paper relative px-4 pb-20 pt-28 sm:px-8">
      <div className="mx-auto max-w-[1400px]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <TitleBlock stage="light" compact={false} />
          <p className="max-w-sm font-mono text-[11px] uppercase leading-relaxed tracking-[0.12em] text-graphite/60">
            One garden in {site.town}, from the drawing to the first night the lights came on.
          </p>
        </div>
        <ol className="mt-10 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {FRAMES.map((f, i) => (
            <li key={f.label} className="relative overflow-hidden bg-vellum-2">
              <div className="aspect-[4/3] w-full">
                {frames ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={frames[i]} alt={`${f.label}, ${f.when}`} className="h-full w-full object-cover" />
                ) : photo && i > 0 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="" crossOrigin="anonymous" className="h-full w-full object-cover" style={{ filter: i === 3 ? "brightness(0.45) saturate(0.7)" : undefined }} />
                ) : null}
              </div>
              <p className="absolute left-2 top-2 bg-vellum/90 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-graphite">
                {f.label} · {f.when}
              </p>
            </li>
          ))}
        </ol>
        <div className="mt-14 max-w-3xl">
          <h1 className="display text-5xl text-graphite sm:text-7xl">
            Drawn in winter.
            <br />
            <em className="text-moss">Lived in by summer.</em>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-graphite/75">
            {copy.hero}
            <Sample />
          </p>
          <a href="#reserve" className="pill mt-8">
            {copy.pill} <span aria-hidden>↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}
