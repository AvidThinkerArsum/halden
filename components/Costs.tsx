"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { site } from "@/lib/site";
import { Rise, Words } from "@/components/ui/Reveal";
import { Sample } from "@/components/ui/Sample";

const MAX = 120; // $k shown on the scale
const pct = (k: number) => `${(Math.min(k, MAX) / MAX) * 100}%`;

export function Costs() {
  const [active, setActive] = useState<string>(site.priceFactors[0].id);
  const f = site.priceFactors.find((p) => p.id === active)!;
  return (
    <section id="cost" data-nav="light" className="relative bg-vellum-2 text-graphite">
      <div className="mx-auto max-w-[1500px] px-5 py-24 sm:px-8 lg:px-10 lg:py-32">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-6">
            <p className="eyebrow text-cedar">Honest numbers</p>
            <h2 className="display mt-6 text-[2.7rem] sm:text-6xl lg:text-[4.4rem]">
              <Words text="What gardens cost" />
              <br />
              <Words italic={`on ${site.region}.`} delay={0.12} />
            </h2>
          </div>
          <Rise delay={0.15} className="self-end text-[15.5px] leading-relaxed text-graphite/75 lg:col-span-5 lg:col-start-8">
            Most firms make you book a visit to hear a number. Here are ours, as bands, for work in {site.town} and the towns around it. The drawing
            pins yours down to a fixed price.
          </Rise>
        </div>

        {/* the scale */}
        <Rise delay={0.1} className="mt-16">
          <div className="relative">
            <div className="relative h-[170px] sm:h-[176px]">
              {/* under $15k */}
              <div className="absolute inset-y-0 left-0 border-r border-dashed border-graphite/30 bg-[repeating-linear-gradient(135deg,rgba(38,40,38,0.07)_0_1px,transparent_1px_7px)]" style={{ width: pct(15) }}>
                <p className="absolute bottom-3 left-2 right-2 hidden font-mono text-[10px] uppercase leading-snug tracking-[0.08em] text-graphite/55 sm:block">Under $15k</p>
              </div>
              {site.priceBands.map((b, i) => (
                <div key={b.id} className={`absolute inset-x-0 ${i === 0 ? "top-3" : "top-[104px] sm:top-[86px]"}`}>
                  <p className="mb-1.5 font-mono text-[13px] sm:hidden" style={{ marginLeft: `min(${pct(b.low)}, calc(100% - 190px))` }}>
                    ${b.low}–{b.high}k{b.plus ? "+" : ""}
                    <Sample /> <span className="font-body text-[12px] text-graphite/65">{b.name}</span>
                  </p>
                  <motion.div
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true, margin: "-10% 0px" }}
                    transition={{ duration: 1.1, delay: 0.2 + i * 0.25, ease: [0.22, 1, 0.36, 1] }}
                    className={`relative h-4 origin-left sm:h-16 ${i === 0 ? "bg-moss text-vellum" : "bg-dusk text-vellum"}`}
                    style={{ marginLeft: pct(b.low), width: `calc(${pct(b.high)} - ${pct(b.low)} ${b.plus ? "+ 9%" : ""})` }}
                  >
                    <div className="hidden h-full flex-col justify-center whitespace-nowrap px-4 sm:flex">
                      <p className="font-mono text-[17px] tracking-[0.02em]">
                        ${b.low}–{b.high}k{b.plus ? "+" : ""}
                        <Sample className="text-vellum" />
                      </p>
                      <p className="text-[12.5px] opacity-80">{b.name}</p>
                    </div>
                    {b.plus && <span className="absolute -right-2 top-1/2 h-0 w-0 -translate-y-1/2 border-y-[8px] border-l-[8px] border-y-transparent border-l-dusk sm:-right-3 sm:border-y-[32px] sm:border-l-[12px]" aria-hidden />}
                  </motion.div>
                </div>
              ))}
            </div>
            <div className="relative mt-2 h-6 border-t border-graphite/40 font-mono text-[10.5px] text-graphite/60">
              {[0, 15, 40, 100].map((k) => (
                <span key={k} className="absolute top-0 -translate-x-1/2 pt-1.5" style={{ left: pct(k) }}>
                  <span className="absolute left-1/2 top-[-5px] h-[5px] w-px bg-graphite/40" />${k}k
                </span>
              ))}
            </div>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            {site.priceBands.map((b) => (
              <div key={b.id} className="border-t border-graphite/20 pt-4">
                <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-graphite/60">{b.name}</p>
                <p className="mt-2 text-[14.5px] leading-snug text-graphite/80">{b.what}</p>
              </div>
            ))}
            <div className="border-t border-cedar/50 pt-4">
              <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-cedar">Under $15k?</p>
              <p className="mt-2 text-[14.5px] leading-snug text-graphite/80">
                We’re probably not your best fit yet. Call anyway — we’ll tell you who is, and what to do first so the next step costs less.
              </p>
            </div>
          </div>
        </Rise>

        {/* what moves it */}
        <div className="mt-20 grid grid-cols-1 gap-8 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h3 className="display text-3xl sm:text-4xl">
              What moves <em>the price</em>
            </h3>
            <p className="mt-3 text-[14px] text-graphite/65">Tap one. The drawing prices each of these before you sign anything.</p>
          </div>
          <div className="lg:col-span-8">
            <div className="flex flex-wrap gap-2.5" role="tablist" aria-label="What moves the price">
              {site.priceFactors.map((p) => (
                <button
                  key={p.id}
                  role="tab"
                  aria-selected={active === p.id}
                  onClick={() => setActive(p.id)}
                  className={`chip rounded-full border px-4 py-2 text-[13.5px] transition ${
                    active === p.id ? "border-graphite bg-graphite text-vellum" : "border-graphite/25 bg-vellum/60 text-graphite/80 hover:border-graphite/60"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <motion.p key={f.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mt-6 max-w-2xl border-l-2 border-cedar pl-4 text-[16px] leading-relaxed text-graphite/85" role="tabpanel">
              {f.note}
            </motion.p>
          </div>
        </div>
      </div>
    </section>
  );
}
