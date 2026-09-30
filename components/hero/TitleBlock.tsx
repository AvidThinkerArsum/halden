"use client";

import { AnimatePresence, motion } from "framer-motion";
import { site } from "@/lib/site";
import { STAGES, TITLE, type Stage } from "@/lib/hero/timeline";

const SHORT: Record<Stage, string> = { drawn: "Drawn", stone: "Stone", planting: "Plants", finish: "Finish", light: "Light" };

function Roll({ value }: { value: string }) {
  return (
    <span className="relative block h-[1.25em] overflow-hidden">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.span
          key={value}
          className="block whitespace-nowrap"
          initial={{ y: "105%" }}
          animate={{ y: 0 }}
          exit={{ y: "-105%" }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The drawing's title block: the first thing anyone reads is the firm's own name. */
export function TitleBlock({ stage, compact }: { stage: Stage; compact: boolean }) {
  const t = TITLE[stage];
  const idx = STAGES.indexOf(stage);
  // long names step down so the block keeps its proportions
  const n = site.name.length;
  const short = n <= 12;
  const nameSize = compact ? (n <= 12 ? 19 : n <= 22 ? 15 : 12.5) : n <= 12 ? 27 : n <= 22 ? 21 : 16.5;
  return (
    <div
      className={`pointer-events-none select-none border border-graphite/75 bg-vellum/95 font-mono uppercase text-graphite shadow-[0_18px_40px_-24px_rgba(0,0,0,0.5)] ${
        compact ? "w-[214px] text-[9px]" : "w-[318px] text-[10px]"
      }`}
      style={{ letterSpacing: "0.08em" }}
      aria-label={`${site.name}, ${site.descriptor}. Residence, ${site.town}, ${site.state}. Sheet L-3. ${t.label} ${t.value}.`}
    >
      <div className={`flex items-baseline justify-between gap-3 border-b border-graphite/60 ${compact ? "px-2.5 pb-1.5 pt-2" : "px-3.5 pb-2 pt-3"}`}>
        <span
          className="font-display normal-case leading-[0.98] tracking-[0.02em] [overflow-wrap:break-word] [text-wrap:balance]"
          style={{ fontVariationSettings: '"opsz" 72', fontSize: nameSize }}
        >
          {site.name.toUpperCase()}
        </span>
        {!compact && short && <span className="shrink-0 text-[8.5px] opacity-60">{site.descriptor}</span>}
      </div>
      <div className={`border-b border-graphite/60 ${compact ? "px-2.5 py-1" : "px-3.5 py-1.5"}`}>
        Residence, {site.town}, {site.state}
      </div>
      <div className="grid grid-cols-[1fr_1.6fr]">
        <div className={`border-r border-graphite/60 ${compact ? "px-2.5 py-1" : "px-3.5 py-1.5"}`}>
          <span className="block text-[0.82em] opacity-55">Sheet</span>
          L-3
        </div>
        <div className={compact ? "px-2.5 py-1" : "px-3.5 py-1.5"}>
          <span className="block text-[0.82em] opacity-55">
            <Roll value={t.label} />
          </span>
          <Roll value={t.value} />
        </div>
      </div>
      <div className="flex border-t border-graphite/60">
        {STAGES.map((s, i) => (
          <span
            key={s}
            className={`flex-1 border-r border-graphite/30 text-center last:border-r-0 ${compact ? "py-[3px] text-[7px]" : "py-1 text-[7.5px]"} transition-colors duration-500 ${
              i < idx ? "bg-graphite/12 opacity-70" : i === idx ? "bg-graphite text-vellum" : "opacity-40"
            }`}
          >
            {compact ? SHORT[s].slice(0, 1) : SHORT[s]}
          </span>
        ))}
      </div>
    </div>
  );
}
