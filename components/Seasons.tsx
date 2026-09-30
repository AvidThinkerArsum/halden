"use client";

import { motion } from "framer-motion";
import { site } from "@/lib/site";
import { MONTHS, MONTHS_LONG, SEASON, seasonOf, slotsLine, useSeason, type Season } from "@/lib/season";
import { Rise, Words } from "@/components/ui/Reveal";
import { Sample } from "@/components/ui/Sample";

/** The firm’s year, starting when the rain does. */
const ORDER = [9, 10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8];
const BANDS: { season: Season; label: string; from: number; to: number; cls: string }[] = [
  { season: "design", label: "Design", from: 0, to: 4, cls: "bg-vellum text-graphite" },
  { season: "order", label: "Permits", from: 4, to: 5, cls: "bg-[repeating-linear-gradient(135deg,#8c8f8a_0_2px,#6f7370_2px_6px)] text-vellum" },
  { season: "build", label: "Build", from: 5, to: 9, cls: "bg-stone text-dusk" },
  { season: "outside", label: "Outside", from: 9, to: 12, cls: "bg-moss text-vellum" },
];

export function Seasons() {
  const { month, day, season, copy, overridden, ready } = useSeason();
  const idx = ORDER.indexOf(month);
  const at = ((idx + (day - 1) / 30) / 12) * 100;
  return (
    <section id="seasons" data-nav="dark" className="relative overflow-hidden bg-dusk-2 text-vellum">
      {/* the terrace in the rain: same photo, relit */}
      <div aria-hidden className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={site.photos.hero.src} alt="" loading="lazy" crossOrigin="anonymous" className="h-full w-full object-cover object-[50%_65%] opacity-40 [filter:grayscale(0.55)_brightness(0.55)_contrast(1.1)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(23,32,33,0.92)_0%,rgba(23,32,33,0.55)_45%,rgba(23,32,33,0.94)_100%)]" />
        <div className="rain absolute inset-0 opacity-70" />
      </div>
      <div className="relative mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-10 lg:py-36">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="eyebrow text-warm/80">When to call</p>
            <h2 className="display mt-6 text-[2.9rem] sm:text-6xl lg:text-[4.8rem]">
              <Words text="Plan it" />
              <br />
              <Words italic="in the rain." delay={0.12} />
            </h2>
          </div>
          <Rise delay={0.15} className="self-end lg:col-span-5">
            <motion.div key={season} initial={{ opacity: ready ? 0 : 1 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-warm/80">
                {MONTHS_LONG[month]} · {SEASON[season].name}
                {overridden && <span className="ml-2 text-vellum/40">(?month)</span>}
              </p>
              <p className="display mt-3 text-[1.9rem] leading-tight">{copy.ribbonTitle}</p>
              <p className="mt-3 text-[15px] leading-relaxed text-vellum/70">
                {copy.ribbonBody}
                <Sample className="text-vellum" />
              </p>
            </motion.div>
          </Rise>
        </div>

        {/* the year */}
        <Rise delay={0.1} className="mt-16">
          <div className="relative pt-12">
            {/* you are here */}
            <motion.div className="absolute top-0 z-10" initial={false} animate={{ left: `${at}%` }} transition={{ type: "spring", stiffness: 60, damping: 16 }} aria-hidden>
              {/* the label leans away from the edges so it never clips */}
              <div
                className="absolute bottom-full mb-0 whitespace-nowrap rounded-full bg-cedar px-3 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-vellum shadow-lg"
                style={{ transform: `translate(${at < 12 ? -8 : at > 88 ? -92 : -50}%, 26px)` }}
              >
                You are here
              </div>
              <div className="absolute left-0 top-[30px] h-[44px] w-px -translate-x-1/2 bg-cedar" />
              <div className="absolute left-0 top-[70px] h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-cedar ring-4 ring-cedar/30" />
            </motion.div>
            <div className="relative flex h-14 overflow-hidden rounded-sm ring-1 ring-vellum/15">
              {BANDS.map((b) => {
                // the marker's dot sits in the current band: its label moves to the other end
                const within = (at / 100 - b.from / 12) / ((b.to - b.from) / 12);
                const flip = b.season === season && within < 0.55;
                return (
                <div
                  key={b.season}
                  className={`relative flex items-center overflow-hidden px-2 sm:px-4 ${flip ? "justify-end" : ""} ${b.cls} ${b.season === season ? "" : "opacity-55"} transition-opacity duration-500`}
                  style={{ width: `${((b.to - b.from) / 12) * 100}%` }}
                >
                  <span className={`truncate font-mono text-[10px] uppercase tracking-[0.1em] sm:text-[11px] ${b.season === "order" ? "hidden sm:inline" : ""}`}>{b.label}</span>
                </div>
                );
              })}
            </div>
            <div className="mt-2 grid grid-cols-12 font-mono text-[10px] uppercase tracking-[0.06em] text-vellum/55 sm:text-[11px]">
              {ORDER.map((m) => (
                <span key={m} className={`text-center ${m === month ? "text-vellum" : ""}`}>
                  <span className="sm:hidden">{MONTHS[m].slice(0, 1)}</span>
                  <span className="hidden sm:inline">{MONTHS[m]}</span>
                </span>
              ))}
            </div>
          </div>
          {/* on wide screens each caption sits under its own band (4 / 1 / 4 / 3 months) */}
          <div className="mt-6 grid grid-cols-2 gap-4 font-mono text-[11px] uppercase leading-relaxed tracking-[0.08em] text-vellum/60 lg:grid-cols-12 lg:gap-0">
            <p className="lg:col-span-4 lg:pr-4"><span className="text-vellum">Oct–Jan</span><br />We measure and draw.</p>
            <p className="lg:col-span-1 lg:pr-2"><span className="text-vellum">Feb</span><br />Permits, stone.</p>
            <p className="lg:col-span-4 lg:pl-3 lg:pr-4"><span className="text-vellum">Mar–Jun</span><br />The crew builds it.</p>
            <p className="lg:col-span-3 lg:pl-3"><span className="text-vellum">Jul–Sep</span><br />You live in it.</p>
          </div>
        </Rise>

        <Rise delay={0.15} className="mt-14 flex flex-wrap items-center gap-x-8 gap-y-4">
          <a href="#reserve" className="pill">
            {copy.primary} <span aria-hidden>↗</span>
          </a>
          <a href={seasonOf(month) === "build" ? site.phoneHref : "#design"} className="ghost text-vellum/80">
            {copy.secondary}
          </a>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-vellum/55">
            {slotsLine(season, site.winterSlots)}
            <Sample className="text-vellum" />
          </p>
        </Rise>
      </div>
    </section>
  );
}
