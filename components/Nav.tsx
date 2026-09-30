"use client";

import { useEffect, useState } from "react";
import { site } from "@/lib/site";
import { useSeason } from "@/lib/season";

/**
 * Transparent bar whose ink follows what's under it: every section says data-nav="light"
 * (paper under the bar, dark ink) or "dark". The hero flips its own attribute as it builds.
 */
export function Nav() {
  const [tone, setTone] = useState<"light" | "dark">("light");
  const [scrolled, setScrolled] = useState(false);
  const [atTop, setAtTop] = useState(true);
  const { copy } = useSeason();
  useEffect(() => {
    let raf = 0;
    const check = () => {
      raf = 0;
      const els = document.elementsFromPoint(window.innerWidth / 2, 34);
      const host = els.map((e) => e.closest("[data-nav]")).find(Boolean) as HTMLElement | undefined;
      setTone((host?.dataset.nav as "light" | "dark") ?? "light");
      // over the hero the bar floats on the drawing until the hero asks for a ground (just
      // before its line comes up); everywhere else it always has one
      // (the reduced-motion strip isn't pinned and never asks: it's treated like any section)
      const asks = host?.dataset.ground;
      setScrolled(asks !== undefined ? asks === "1" : window.scrollY > 40);
      setAtTop(window.scrollY < 24);
    };
    const on = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    check();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    const mo = new MutationObserver(on);
    mo.observe(document.body, { subtree: true, attributes: true, attributeFilter: ["data-nav", "data-ground"] });
    return () => {
      window.removeEventListener("scroll", on);
      window.removeEventListener("resize", on);
      mo.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);
  const dark = tone === "dark";
  return (
    <header
      className={`pointer-events-none fixed inset-x-0 top-0 z-50 transition-colors duration-500 ${dark ? "text-vellum" : "text-graphite"} ${
        dark && !scrolled ? "[text-shadow:0_1px_10px_rgba(8,12,13,0.55)]" : ""
      }`}
    >
      <div
        className={`absolute inset-0 border-b backdrop-blur-md transition-[opacity,background-color,border-color] duration-500 ${scrolled ? "opacity-100" : "opacity-0"} ${
          dark ? "border-white/[0.06] bg-dusk/80" : "border-graphite/10 bg-vellum/85"
        }`}
        aria-hidden
      />
      {site.showConceptBanner && (
        <div
          className={`pointer-events-auto relative overflow-hidden bg-graphite text-center font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/75 transition-[max-height] duration-500 ${atTop ? "max-h-20 sm:max-h-10" : "max-h-0"}`}
        >
          {/* phones: two short lines rather than a truncated one; the disclaimer must survive */}
          <p className="px-4 py-1.5 leading-snug sm:truncate">Unofficial concept for {site.name}, not affiliated · all figures are samples</p>
        </div>
      )}
      <nav className="pointer-events-auto relative mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10" aria-label="Main">
        <a href="#top" className="group flex min-w-0 items-baseline gap-3">
          <span className="display truncate text-[1.45rem] leading-none tracking-[-0.01em]">{site.name}</span>
          <span className="hidden font-mono text-[9.5px] uppercase tracking-[0.18em] opacity-60 lg:inline">{site.descriptor}</span>
        </a>
        <div className="flex shrink-0 items-center gap-5 text-[13px] font-medium">
          <a href="#design" className="hidden opacity-80 transition hover:opacity-100 lg:inline">
            Design
          </a>
          <a href="#cost" className="hidden opacity-80 transition hover:opacity-100 lg:inline">
            Cost
          </a>
          <a href="#seasons" className="hidden opacity-80 transition hover:opacity-100 lg:inline">
            When
          </a>
          <a href="#work" className="hidden opacity-80 transition hover:opacity-100 lg:inline">
            Work
          </a>
          <a href={site.phoneHref} className="hidden font-mono text-[12px] tracking-[0.04em] opacity-80 transition hover:opacity-100 md:inline">
            {site.phone}
          </a>
          <a href="#reserve" className="pill hidden !px-4 !py-2.5 !text-[13px] sm:inline-flex" aria-label={copy.primary}>
            Start with a design
          </a>
        </div>
      </nav>
    </header>
  );
}

/** Phone-first: a sticky call bar under the thumb. */
export function CallBar() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-dusk/95 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-2.5 backdrop-blur md:hidden">
      <div className="flex gap-2.5">
        <a href={site.phoneHref} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-vellum/30 py-3 text-[14px] font-medium text-vellum">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
            <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
          </svg>
          Call {site.name.length > 14 ? "" : site.name}
        </a>
        <a href="#reserve" className="pill flex-1 justify-center !py-3 !text-[14px]">
          Start with a design
        </a>
      </div>
    </div>
  );
}

/** The concept bar now lives in the fixed header (it folds away once you scroll). */
export function ConceptBanner() {
  return null;
}
