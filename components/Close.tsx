"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { site } from "@/lib/site";
import { useSeason } from "@/lib/season";
import { fmtTime, localNoon, sunsetUTC } from "@/lib/sun";
import { Words } from "@/components/ui/Reveal";
import { useHeroLit } from "@/lib/hero/store";

export function Close() {
  const ref = useRef<HTMLElement>(null);
  const { copy, month, overridden, ready } = useSeason();
  const [sun, setSun] = useState<{ set: string; on: string; past: boolean } | null>(null);
  useEffect(() => {
    if (!ready) return;
    const noon = localNoon(site.geo.tz, overridden ? month : undefined);
    const s = sunsetUTC(noon, site.geo.lat, site.geo.lon);
    if (!s) return;
    const on = new Date(s.getTime() + 60_000);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSun({ set: fmtTime(s, site.geo.tz), on: fmtTime(on, site.geo.tz), past: !overridden && Date.now() > s.getTime() });
  }, [ready, month, overridden]);

  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-6%", "6%"]);
  // the hero's own last frame: the same garden, finished, every light on
  const lit = useHeroLit();

  return (
    <section ref={ref} id="close" data-nav="dark" className="relative isolate flex min-h-[100svh] items-end overflow-hidden bg-dusk-2 text-vellum md:items-center">
      {/* phones: the lit garden sits above the words; wider screens: to the right of them */}
      <div className="absolute inset-x-0 top-0 -z-10 h-[60svh] overflow-hidden md:inset-y-0 md:left-auto md:right-0 md:h-auto md:w-[62%]">
        <motion.div style={{ y }} className="absolute inset-[-7%_0]">
          {/* before the render exists (or without WebGL): the hero photo, graded to evening */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={site.photos.hero.src}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover object-[50%_50%] [filter:brightness(0.42)_saturate(0.55)_contrast(1.1)]"
          />
          <div className="absolute inset-0 bg-[#10243a] mix-blend-multiply opacity-60" />
          {lit && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={lit}
              alt={`The garden from the top of the page, finished and lit at blue hour`}
              className="absolute inset-0 h-full w-full animate-[fadein_1.2s_ease-out] object-cover object-[50%_50%]"
            />
          )}
        </motion.div>
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(18,26,27,0.4)_0%,transparent_22%,transparent_62%,#172021_100%)] md:bg-[linear-gradient(90deg,#172021_0%,rgba(23,32,33,0.55)_16%,transparent_42%),linear-gradient(180deg,rgba(23,32,33,0.5)_0%,transparent_18%,transparent_80%,rgba(23,32,33,0.7)_100%)]" />
      </div>
      <div className="mx-auto w-full max-w-[1500px] px-5 pb-28 pt-[50svh] sm:px-8 md:py-[16svh] lg:px-10">
        <div className="md:max-w-[46%]">
        <p className="eyebrow text-warm/85">{site.name} · {site.town}</p>
        <h2 className="display mt-6 text-[3.1rem] sm:text-6xl lg:text-[4.6rem] xl:text-[5.2rem]">
          <Words text="Start the drawing" />
          <br />
          <Words italic="this winter." delay={0.15} />
        </h2>
        <p className="mt-7 max-w-xl text-[17px] leading-relaxed text-vellum/85" aria-live="polite">
          {sun ? (
            sun.past ? (
              <>
                Tonight in {site.town} the sun set at <span className="font-mono text-[15px] text-warm">{sun.set}</span>. Your lights came on at{" "}
                <span className="font-mono text-[15px] text-warm">{sun.on}</span>.
              </>
            ) : (
              <>
                Tonight in {site.town} the sun sets at <span className="font-mono text-[15px] text-warm">{sun.set}</span>. Your lights would come on at{" "}
                <span className="font-mono text-[15px] text-warm">{sun.on}</span>.
              </>
            )
          ) : (
            <>Tonight in {site.town} your lights would come on a minute after sunset.</>
          )}
        </p>
        <div className="mt-9 flex flex-col items-start gap-5">
          <a href="#reserve" className="pill">
            {copy.pill} <span aria-hidden>↗</span>
          </a>
          <a href={site.phoneHref} className="ghost font-mono !text-[14px] text-vellum/85">
            or call {site.phone}
          </a>
        </div>
        </div>
      </div>
    </section>
  );
}
