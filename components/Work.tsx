"use client";

import { useEffect, useRef, useState } from "react";
import { site } from "@/lib/site";
import { loadImage, processPhoto, sketchToPaper } from "@/lib/hero/process";
import { Rise, Words } from "@/components/ui/Reveal";
import { Sample } from "@/components/ui/Sample";

type Project = (typeof site.projects)[number];

// A generic setting for any project photo: no hand polygons, just the photo.
// Cards are small: fewer, surer lines and lighter stipple than the hero sheet.
const TH = { ...site.hero.thresholds, plantTop: 0.02, stoneTop: 0.35, lines: 1.2, stipple: 0.5, hatch: 0.85 };

/** One drawing at a time, so three cards never process at once. */
let queue: Promise<unknown> = Promise.resolve();
function drawingFor(src: string) {
  const job = queue.then(async () => {
    const img = await loadImage(src);
    const p = await processPhoto({ img, width: 1000, thresholds: TH, full: false, seed: 3 });
    return sketchToPaper(p, 1000).toDataURL("image/jpeg", 0.85);
  });
  queue = job.catch(() => null);
  return job;
}

function Card({ p }: { p: Project }) {
  const ref = useRef<HTMLElement>(null);
  const [flipped, setFlipped] = useState(false);
  const [drawing, setDrawing] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let started = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting || started) return;
        started = true;
        drawingFor(p.src).then(setDrawing, () => setFailed(true));
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [p.src]);
  return (
    <article ref={ref} className="group">
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-pressed={flipped}
        aria-label={`${p.title}, ${p.town}: ${flipped ? "show the photo" : "show the drawing"}`}
        className="block w-full text-left [perspective:1600px] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cedar"
      >
        <div
          className="relative aspect-[4/5] w-full transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] [transform-style:preserve-3d]"
          style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
        >
          <div className="absolute inset-0 overflow-hidden bg-dusk [backface-visibility:hidden]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.src} alt={p.alt} loading="lazy" crossOrigin="anonymous" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]" style={{ objectPosition: p.focal }} />
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,rgba(15,22,23,0.6),transparent)]" />
            <span className="absolute bottom-4 left-4 inline-flex items-center gap-2 rounded-full bg-vellum/92 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-graphite">
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                <path d="M2 10 L10 2 M2 7 L5 10 M7 2 L10 5" stroke="currentColor" strokeWidth="1.1" fill="none" />
              </svg>
              See the drawing
            </span>
          </div>
          <div className="absolute inset-0 overflow-hidden bg-vellum [backface-visibility:hidden] [transform:rotateY(180deg)]">
            {drawing ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={drawing} alt={`The drawing of ${p.title}, generated from the photo`} className="h-full w-full object-cover" style={{ objectPosition: p.focal }} />
            ) : (
              <div className="flex h-full items-center justify-center font-mono text-[10px] uppercase tracking-[0.18em] text-graphite/50">
                {failed ? "Drawing unavailable" : "Drawing…"}
              </div>
            )}
            <div className="absolute inset-3 border border-graphite/30" />
            <div className="absolute bottom-3 right-3 border border-graphite/70 bg-vellum px-3 py-2 font-mono text-[9px] uppercase leading-relaxed tracking-[0.1em] text-graphite">
              <span className="block font-display text-[13px] normal-case tracking-normal">{site.name}</span>
              {p.town} · Drawn {p.drawn}
            </div>
            <span className="absolute left-4 top-4 font-mono text-[10px] uppercase tracking-[0.12em] text-graphite/60">Tap for the garden</span>
          </div>
        </div>
      </button>
      <div className="mt-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-cedar">
          {p.town}
          {site.showConceptBanner && <span className="ml-2 text-graphite/45">· Sample project</span>}
        </p>
        <h3 className="display mt-2 text-[1.9rem]">{p.title}</h3>
        <p className="mt-2 text-[14px] leading-snug text-graphite/70">{p.scope}</p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-graphite/15 pt-3 font-mono text-[12px] text-graphite/80">
          <span>
            {p.weeks} weeks on site
            <Sample />
          </span>
          <span>
            {p.band}
            <Sample />
          </span>
        </p>
      </div>
    </article>
  );
}

export function Work() {
  return (
    <section id="work" data-nav="light" className="paper relative text-graphite">
      <div className="mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-10 lg:py-32">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="eyebrow text-cedar">Work</p>
            <h2 className="display mt-6 text-[2.7rem] sm:text-6xl lg:text-[4.4rem]">
              <Words text="Three gardens," />
              <br />
              <Words italic="drawn first." delay={0.12} />
            </h2>
          </div>
          <Rise delay={0.15} className="self-end text-[15.5px] leading-relaxed text-graphite/75 lg:col-span-4 lg:col-start-9">
            Tap a garden to see the drawing it started as. Each one is generated from the photo, the same way yours would be.
          </Rise>
        </div>
        <div className="mt-14 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {site.projects.map((p, i) => (
            <Rise key={p.id} delay={i * 0.1}>
              <Card p={p} />
            </Rise>
          ))}
        </div>
        <div className="mt-20 grid grid-cols-1 gap-10 border-t border-graphite/15 pt-12 md:grid-cols-2">
          {site.reviews.map((r) => (
            <figure key={r.who}>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-graphite/50">Sample review</p>
              <blockquote className="display mt-3 text-[1.55rem] leading-snug sm:text-[1.8rem]">“{r.quote}”</blockquote>
              <figcaption className="mt-4 font-mono text-[11px] uppercase tracking-[0.1em] text-graphite/60">{r.who}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
