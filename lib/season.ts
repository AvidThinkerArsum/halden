"use client";

import { useEffect, useState } from "react";

/**
 * The firm’s year: design Oct–Jan, permits and stone orders in Feb, build Mar–Jun,
 * outside Jul–Sep. Copy and calls to action follow it, so a winter visitor is sold a
 * design slot, not a patio. `?month=3` or `?month=mar` overrides the date.
 */
export type Season = "design" | "order" | "build" | "outside";

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function seasonOf(m: number): Season {
  if (m >= 9 || m === 0) return "design";
  if (m === 1) return "order";
  if (m <= 5) return "build";
  return "outside";
}

export const SEASON: Record<
  Season,
  { name: string; pill: string; ribbonTitle: string; ribbonBody: string; primary: string; secondary: string; hero: string }
> = {
  design: {
    name: "Design season",
    pill: "Reserve a winter design slot",
    ribbonTitle: "It’s design season.",
    ribbonBody:
      "The rain is the best time to draw. We measure, you decide, the stone gets ordered in February and your crew is booked for spring before the calendar fills.",
    primary: "Reserve a winter design slot",
    secondary: "What a design includes",
    hero: "Book the drawing this winter and your crew starts in March.",
  },
  order: {
    name: "Permits & stone",
    pill: "Take a late-winter design slot",
    ribbonTitle: "Last designs for a spring build.",
    ribbonBody:
      "February is permits and stone orders. A design started this month can still make a May or June build — after that, you’re drawing for fall.",
    primary: "Take a late-winter design slot",
    secondary: "What a design includes",
    hero: "There’s still room to draw it this month and build it by June.",
  },
  build: {
    name: "Build season",
    pill: "Hold a slot for this winter",
    ribbonTitle: "We’re building. You could be drawing.",
    ribbonBody:
      "Spring crews are booked by designs drawn last winter. Hold a winter design slot now and yours is first on next spring’s calendar.",
    primary: "Hold a winter design slot",
    secondary: "Ask about a fall build",
    hero: "This spring’s crews were booked in January; hold your place for next year’s.",
  },
  outside: {
    name: "Outside season",
    pill: "Get on the winter design list",
    ribbonTitle: "Go outside. We’ll call in October.",
    ribbonBody:
      "Summer is for using a garden. Put your name on the winter list now: eight winter design slots open October 1, and the list gets first pick.",
    primary: "Get on the winter design list",
    secondary: "What a winter design includes",
    hero: "Eight winter design slots open October 1, and the list gets first pick.",
  },
};

/** What the slot counter says: before October the winter slots haven't opened yet. */
export function slotsLine(season: Season, slots: { left: number; total: number }) {
  return season === "outside" ? `${slots.total} winter design slots open Oct 1` : `${slots.left} of ${slots.total} winter design slots open`;
}

export function parseMonth(v: string | null): number | null {
  if (!v) return null;
  const n = Number(v);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n - 1;
  const i = MONTHS.findIndex((m) => m.toLowerCase() === v.slice(0, 3).toLowerCase());
  return i >= 0 ? i : null;
}

type MonthState = { month: number; day: number; overridden: boolean; ready: boolean };

/** Current month in Pacific time, or ?month=. Starts on January (design season) until mounted. */
export function useMonth(): MonthState {
  const [s, set] = useState<MonthState>({ month: 0, day: 15, overridden: false, ready: false });
  useEffect(() => {
    const q = parseMonth(new URLSearchParams(window.location.search).get("month"));
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", month: "numeric", day: "numeric" }).formatToParts(new Date());
    const m = Number(parts.find((p) => p.type === "month")?.value ?? 1) - 1;
    const d = Number(parts.find((p) => p.type === "day")?.value ?? 15);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    set(q === null ? { month: m, day: d, overridden: false, ready: true } : { month: q, day: 15, overridden: true, ready: true });
  }, []);
  return s;
}

export function useSeason() {
  const m = useMonth();
  const season = seasonOf(m.month);
  return { ...m, season, copy: SEASON[season] };
}
