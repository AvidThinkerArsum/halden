# Halden — landscape design + build (demo)

A one-page concept site for a fictional Eastside landscape firm. The hero turns a single
photograph into a graphite perspective drawing, then builds the yard back in crew order
(stone, planting, finish) and relights it at blue hour as you scroll.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static export to out/
```

`BASE_PATH=/halden npm run build` if the export is hosted under a sub-path.

## Everything a client changes lives in `lib/site.ts`

- `name`, `town`, `phone`, `email`, `contractorReg`, `serviceTowns`, price bands, projects, reviews.
- `showConceptBanner` shows the "Unofficial concept" bar and tags every figure as **sample**.
- `fictional` (true for the invented demo firm, false automatically when `NEXT_PUBLIC_SITE_NAME` is set):
  the footer then says "Unofficial concept for {name}, not affiliated" instead of "fictional business".
- `hero`: one daylight, eye-level, landscape photo (Pexels id), plus:
  - `focal` (desktop / mobile), `vanishingPoint`, mask `thresholds`
  - `overrides` (polygons forcing stone / planting / distance; `base: false` for set pieces like benches
    that arrive whole; `planter` for planting in a vessel, which comes up with the stone around it),
    `retouch` (clone / desaturate patches)
  - `strokes` + `quiet` (designer's lines drawn over, and areas where generated lines are suppressed)
  - `callouts` (anchor on the feature, label offset, stage that ticks it BUILT), `lights` / `lightsMobile`
  - optional `duskPhoto`, a same-angle night photo used instead of the synthetic relight.

All states come from that one photo (`lib/hero/process.ts` builds the drawing, masks and reveal
map once; `lib/hero/gl.ts` is the single WebGL2 shader). Without WebGL the same drawing and reveal map
are composited in Canvas 2D; only an unreadable (CORS-tainted) photo falls back to an SVG-filter sketch.
The closing section shows the hero's own last frame (finished, blue hour, every light on).

## Dev switches

| URL | What it does |
| --- | --- |
| `?masks` (dev builds only) | Shader shows the masks: red stone, green planting, blue distance, white bands = reveal order |
| `?trace` (dev builds only) | Click on the hero to place points, copy them as JSON for polygons, strokes and anchors |
| `?nogl` | Forces the no-WebGL fallback |
| `?month=3` / `?month=mar` | Pretends it is that month (season copy, CTAs, year ribbon, sunset line) |

`NEXT_PUBLIC_SITE_NAME="A Much Longer Firm Name" npm run build` tests long names.

## Photos

Hotlinked from Pexels (credited in the footer): hero 37785078 (Brett A), projects 7045706
(Max Vakhtbovych), 32707056 (xfly), 38193972 (Magda Ehlers). The dusk image is rendered from the hero.

Halden is fictional. Every figure, review, licence and credential on the page is sample content.
