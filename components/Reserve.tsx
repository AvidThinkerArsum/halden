"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { site } from "@/lib/site";
import { slotsLine, useSeason } from "@/lib/season";
import { Words } from "@/components/ui/Reveal";
import { Sample } from "@/components/ui/Sample";

const TOWNS = [...site.serviceTowns.slice(0, 8), "Somewhere else"];
const SCOPE = ["a terrace", "retaining walls", "steps & paths", "planting", "lighting", "the whole backyard"];
const BUDGET = [...site.priceBands.map((b) => `$${b.low}–${b.high}k`), `$${site.priceBands[site.priceBands.length - 1].high}k+`, "not sure yet"];
const WHEN = ["design this winter", "build this spring", "build later", "just thinking"];

function list(xs: string[]) {
  if (xs.length <= 1) return xs[0] ?? "";
  return `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
}

function Chips({ label, options, value, multi, onChange }: { label: string; options: string[]; value: string[]; multi?: boolean; onChange: (v: string[]) => void }) {
  return (
    <fieldset>
      <legend className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-vellum/55">{label}</legend>
      <div className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value.includes(o);
          return (
            <button
              type="button"
              key={o}
              aria-pressed={on}
              onClick={() => onChange(multi ? (on ? value.filter((v) => v !== o) : [...value, o]) : on ? [] : [o])}
              className={`chip rounded-full border px-3.5 py-2 text-[13.5px] transition ${on ? "border-vellum bg-vellum text-dusk" : "border-vellum/25 text-vellum/80 hover:border-vellum/60"}`}
            >
              {o}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Reserve() {
  const { copy, season } = useSeason();
  const [town, setTown] = useState<string[]>([]);
  const [scope, setScope] = useState<string[]>([]);
  const [budget, setBudget] = useState<string[]>([]);
  const [when, setWhen] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [sent, setSent] = useState(false);

  const place = town[0] ? (town[0] === "Somewhere else" ? "just outside your usual towns" : `in ${town[0]}`) : "in …";
  const sentence = `Hi ${site.name} — I’m ${place}, thinking about ${scope.length ? list(scope) : "…"}, with a budget around ${budget[0] ?? "…"}, and I’d like to ${when[0] ?? "…"}.`;
  const complete = town.length && scope.length && budget.length && when.length;
  const fit = budget[0] && budget[0] !== "not sure yet";

  return (
    <section id="reserve" data-nav="dark" className="relative bg-dusk text-vellum">
      <div className="mx-auto grid max-w-[1500px] grid-cols-1 gap-14 px-5 py-24 sm:px-8 lg:grid-cols-12 lg:px-10 lg:py-32">
        <div className="lg:col-span-5">
          <p className="eyebrow text-warm/80">Reserve</p>
          <h2 className="display mt-6 text-[2.7rem] sm:text-6xl lg:text-[4.2rem]">
            <Words text="Tell us about" />
            <br />
            <Words italic="the yard." delay={0.12} />
          </h2>
          <p className="mt-6 max-w-sm text-[15.5px] leading-relaxed text-vellum/70">
            Four taps and a name. We call back within a working day
            <Sample className="text-vellum" /> to book the site walk — the first step of the design.
          </p>
          <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.1em] text-vellum/50">
            {slotsLine(season, site.winterSlots)}
            <Sample className="text-vellum" /> · or call {site.phone}
          </p>
        </div>

        <div className="lg:col-span-7">
          <AnimatePresence mode="wait" initial={false}>
            {!sent ? (
              <motion.form
                key="form"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  if (complete) setSent(true);
                }}
                className="space-y-8"
                aria-label={`Design enquiry for ${site.name} (demo: nothing is sent)`}
              >
                <Chips label="I’m in" options={TOWNS} value={town} onChange={setTown} />
                <Chips label="Thinking about" options={SCOPE} value={scope} multi onChange={setScope} />
                <Chips label="Budget, roughly" options={BUDGET} value={budget} onChange={setBudget} />
                <Chips label="Hoping to" options={WHEN} value={when} onChange={setWhen} />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-vellum/55">Name</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="mt-2 w-full border-b border-vellum/30 bg-transparent py-2 text-[16px] outline-none placeholder:text-vellum/30 focus:border-warm" placeholder="Your name" />
                  </label>
                  <label className="block">
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-vellum/55">Phone or email</span>
                    <input value={contact} onChange={(e) => setContact(e.target.value)} className="mt-2 w-full border-b border-vellum/30 bg-transparent py-2 text-[16px] outline-none placeholder:text-vellum/30 focus:border-warm" placeholder="How we reach you" />
                  </label>
                </div>
                <div className="rounded-sm border border-vellum/15 bg-dusk-2/70 p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/45">Your note, so far</p>
                  <p className="display mt-3 text-[1.45rem] leading-snug text-vellum sm:text-[1.65rem]">{sentence}</p>
                </div>
                <div className="flex flex-wrap items-center gap-5">
                  <button type="submit" disabled={!complete} className="pill disabled:cursor-not-allowed disabled:opacity-40">
                    {season === "design" ? "Reserve my design slot" : copy.primary} <span aria-hidden>↗</span>
                  </button>
                  <span className="text-[12.5px] text-vellum/50">Demo: nothing is sent anywhere.</span>
                </div>
              </motion.form>
            ) : (
              <motion.div key="lead" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-warm/85">This is the lead that lands in {site.name}’s inbox</p>
                <div className="mt-5 overflow-hidden rounded-md bg-vellum text-graphite shadow-[0_40px_80px_-40px_rgba(0,0,0,0.8)]">
                  <div className="border-b border-graphite/10 px-5 py-3 font-mono text-[11px] text-graphite/60">
                    <p>
                      <span className="inline-block w-16">From</span>
                      {name || "A homeowner"} {contact ? `· ${contact}` : ""}
                    </p>
                    <p>
                      <span className="inline-block w-16">To</span>
                      {site.email}
                    </p>
                    <p className="mt-1 text-graphite">
                      <span className="inline-block w-16 text-graphite/60">Subject</span>
                      Design enquiry — {town[0]}, {list(scope)}, {budget[0]}
                    </p>
                  </div>
                  <div className="px-5 py-5">
                    <p className="display text-[1.35rem] leading-snug">{sentence}</p>
                    <div className="mt-5 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.1em]">
                      <span className="rounded-full bg-graphite px-2.5 py-1 text-vellum">{SEASON_TAG[season]}</span>
                      <span className={`rounded-full px-2.5 py-1 ${fit ? "bg-moss text-vellum" : "bg-vellum-3 text-graphite"}`}>{fit ? "Budget in range" : "Budget: talk it through"}</span>
                      <span className="rounded-full border border-graphite/25 px-2.5 py-1">
                        Call back within 1 working day
                        {site.showConceptBanner && <span className="ml-1.5 opacity-55">· sample</span>}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap items-center gap-5">
                  <button type="button" onClick={() => setSent(false)} className="ghost text-vellum/80">
                    Edit the note
                  </button>
                  <span className="text-[12.5px] text-vellum/50">Nothing was sent. In the live site this goes to {site.name}, with a text alert.</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

const SEASON_TAG = { design: "Design season lead", order: "Late-winter lead", build: "Build season · for next year", outside: "Winter list" } as const;
