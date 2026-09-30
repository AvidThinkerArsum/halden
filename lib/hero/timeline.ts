/**
 * The hero's scroll script. p = 0..1 across the pinned section.
 *
 *   0.00–0.05  the drawing, as delivered in January
 *   0.05–0.25  stone: compacted base, then stone, from the foreground
 *   0.25–0.43  planting rises out of the beds
 *   0.43–0.58  the rest: trees, lawn, sky
 *   0.60–0.70  blue hour
 *   0.66–0.84  lights, one by one
 *   0.86–0.93  the line and the button
 */
export const TL = {
  stone: [0.05, 0.25],
  planting: [0.25, 0.43],
  finish: [0.43, 0.58],
  dusk: [0.6, 0.7],
  lights: [0.66, 0.84],
  head: [0.86, 0.93],
} as const;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (p: number, [a, b]: readonly [number, number]) => clamp01((p - a) / (b - a));

/** Build progress for the shader (0..1, thirds = stone / planting / finish). */
export function buildAt(p: number) {
  return (seg(p, TL.stone) + seg(p, TL.planting) + seg(p, TL.finish)) / 3;
}

export function duskAt(p: number) {
  const d = seg(p, TL.dusk);
  return d * d * (3 - 2 * d);
}

/** Per-light intensity; they bloom one after another in `order`. */
export function lightLevels(p: number, count: number, order: number[]) {
  const out = new Float32Array(8);
  const [a, b] = TL.lights;
  const span = (b - a) / Math.max(1, count);
  order.slice(0, count).forEach((li, k) => {
    const s = a + k * span;
    const v = clamp01((p - s) / (span * 1.6));
    out[li] = v * v * (3 - 2 * v);
  });
  return out;
}

export type Stage = "drawn" | "stone" | "planting" | "finish" | "light";
export const STAGES: Stage[] = ["drawn", "stone", "planting", "finish", "light"];

/**
 * Build progress at which each stage looks done (about 70% of its area in place), in the
 * shader's units. Stone runs on a lagging front (1.1b - 0.06) over reveal times 0.015-0.23;
 * planting over 0.36-0.61; trees, lawn and distance over 0.68-0.97.
 */
const DONE = { stone: 0.2, planting: 0.54, finish: 0.89 } as const;

/** The title block only claims a stage once the picture shows it. */
export function stageAt(p: number): Stage {
  const b = buildAt(p);
  if (duskAt(p) >= 0.6) return "light";
  if (b >= DONE.finish) return "finish";
  if (b >= DONE.planting) return "planting";
  if (b >= DONE.stone) return "stone";
  return "drawn";
}

/** What the title block reads at each stage. */
export const TITLE: Record<Stage, { label: string; value: string }> = {
  drawn: { label: "Drawn", value: "Jan" },
  stone: { label: "Stone set", value: "Mar" },
  planting: { label: "Planted", value: "Apr" },
  finish: { label: "Finished", value: "Jul" },
  light: { label: "Lit", value: "Jul 9:40 pm" },
};

/** When a callout's stage is complete (in shader build units, or scroll p for lights). */
export function isBuilt(stage: "stone" | "planting" | "finish" | "light", p: number) {
  const b = buildAt(p);
  if (stage === "stone") return b >= 0.26;
  if (stage === "planting") return b >= 0.64;
  if (stage === "finish") return b >= 0.985;
  return p >= TL.lights[0] + (TL.lights[1] - TL.lights[0]) * 0.7;
}
