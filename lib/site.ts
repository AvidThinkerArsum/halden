/**
 * Everything a client would change lives here: name, town, contact, the hero photo and its
 * annotations, the other photos, and the price bands. Every name and town on the page reads
 * from this file.
 *
 * SAMPLE DATA: every figure, review, availability state, licence number and credential below
 * is sample content. Replace before using for a real firm.
 */

export type Pt = [number, number]; // normalised image coordinates, 0..1 from the top-left

export type Callout = {
  id: string;
  /** First line (uppercase in the drawing). */
  label: string;
  /** Second line: a dimension or spec. */
  spec?: string;
  /** Point on the feature, in image coordinates. */
  anchor: Pt;
  /** Different point on the same feature when the phone crop hides the desktop one. */
  anchorMobile?: Pt;
  /** Where the label sits relative to the anchor, in CSS px. */
  offset: Pt;
  offsetMobile?: Pt;
  /** Hide on phones (feature is outside the crop). */
  mobile?: boolean;
  /** Which crew stage builds it. It ticks BUILT (or LIT) when that stage completes. */
  stage: "stone" | "planting" | "finish" | "light";
};

export type Light = {
  /** Fixture position (ground point) in image coordinates. */
  at: Pt;
  kind: "path" | "up";
  /** Pool radius (image-height units) for path lights; beam width for uplights. */
  radius: number;
  /** Uplight throw height in image-height units. */
  height?: number;
  intensity?: number;
};

export type Override = {
  /**
   * Forces the mask class inside the polygon. `far` marks distance/haze. `planter` is planting
   * that sits in a stone feature (an urn, a trough): it comes up with the stone around it,
   * not with the beds, so the built terrace never has a paper hole in the middle.
   */
  kind: "stone" | "planting" | "rest" | "sky" | "far" | "planter";
  points: Pt[];
  /** Stone only: false = cast or set pieces (benches, steps) that arrive as stone, with no grey base first. */
  base?: boolean;
};

/** A line the designer wants drawn for sure (in image coordinates), e.g. an object's silhouette. */
export type Stroke = { points: Pt[]; weight?: 0 | 1 | 2 | 3; closed?: boolean; /** straight segments, no smoothing */ sharp?: boolean };

export type Retouch =
  | { kind: "clone"; rect: [number, number, number, number]; from: Pt }
  | { kind: "desat"; rect: [number, number, number, number]; amount: number };

export type HeroConfig = {
  /** One daylight, eye-level, landscape photo of a finished yard. Everything derives from it. */
  photo: { id: number; alt: string; credit: string; aspect: number };
  /** Optional same-angle dusk photo; otherwise the relight is synthetic. */
  duskPhoto?: string;
  focal: { desktop: Pt; mobile: Pt };
  /** Where the terrace's lines converge: drawn as the sheet's perspective construction. */
  vanishingPoint: Pt;
  thresholds: {
    /** Hue range (deg) counted as planting. */
    plantHue: [number, number];
    plantSat: number;
    /** Above this line (0..1 from top) green reads as trees, not beds. */
    plantTop: number;
    stoneSat: number;
    /** Stone is only looked for below this line. */
    stoneTop: number;
    /** Origin the stone spreads from (usually just below the frame, foreground centre). */
    stoneOrigin: Pt;
    /** Edge sensitivity: higher = fewer lines. */
    lines: number;
    /** Hatch and stipple density multipliers. */
    hatch: number;
    stipple: number;
  };
  overrides: Override[];
  retouch: Retouch[];
  /** Emphasis lines drawn on top of the generated linework. */
  strokes?: Stroke[];
  /** Areas where generated linework is suppressed (the strokes speak there). */
  quiet?: Pt[][];
  callouts: Callout[];
  lights: Light[];
  /** Phones see a narrow crop: fixtures that fall inside it (max 8). */
  lightsMobile?: Light[];
};

/** Points on a (rotated) ellipse, for drawn rims and pots. Rounded so SSR and client agree. */
export function ellipse(cx: number, cy: number, rx: number, ry: number, rotDeg = 0, n = 40, from = 0, to = 360): Pt[] {
  const out: Pt[] = [];
  const r = (rotDeg * Math.PI) / 180;
  for (let i = 0; i <= n; i++) {
    const a = ((from + ((to - from) * i) / n) * Math.PI) / 180;
    const x = rx * Math.cos(a), y = ry * Math.sin(a);
    out.push([Math.round((cx + x * Math.cos(r) - y * Math.sin(r)) * 1e4) / 1e4, Math.round((cy + x * Math.sin(r) + y * Math.cos(r)) * 1e4) / 1e4]);
  }
  return out;
}

const pexels = (id: number, w = 2400) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;

const NAME = process.env.NEXT_PUBLIC_SITE_NAME || "Halden";
const REGION = "Eastside";

const HERO_PHOTO = {
  id: 37785078,
  alt: "A bluestone terrace after rain, moss in the joints, two stone benches and a planted urn under multi-stem trees",
  credit: "Brett A",
  aspect: 4 / 3,
};

export const site = {
  name: NAME,
  descriptor: "Landscape Design + Build",
  /**
   * True for the invented demo firm. False when the page is pitched to (or run by) a real
   * business: the footer then drops "fictional" and, while `showConceptBanner` is on, says
   * the page is an unofficial concept with sample figures instead. A name supplied at build
   * time (NEXT_PUBLIC_SITE_NAME, how a prospect's version is built) is taken to be real.
   */
  fictional: !process.env.NEXT_PUBLIC_SITE_NAME,
  town: "Kirkland",
  state: "WA",
  /** In a sentence ("on the Eastside") and as an adjective ("Eastside clay"). */
  region: `the ${REGION}`,
  regionShort: REGION,
  /** For the live sunset line in the closing section. */
  geo: { lat: 47.6769, lon: -122.206, tz: "America/Los_Angeles" },
  phone: "(425) 555-0148",
  phoneHref: "tel:+14255550148",
  email: "studio@halden.example",
  /** Placeholder until the real registration number is supplied. */
  contractorReg: "",
  credentials: "Licensed · Bonded · Insured",
  /** Shows the "Unofficial concept" bar and tags every number and claim as sample. */
  showConceptBanner: false,
  serviceTowns: [
    "Kirkland",
    "Bellevue",
    "Medina",
    "Clyde Hill",
    "Yarrow Point",
    "Redmond",
    "Woodinville",
    "Sammamish",
    "Issaquah",
    "Mercer Island",
    "Bothell",
  ],
  designWeeks: "3–4 weeks",
  designFee: "$2,400–$4,800",
  winterSlots: { left: 3, total: 8 },

  hero: {
    photo: HERO_PHOTO,
    focal: { desktop: [0.5, 0.56], mobile: [0.5, 0.56] },
    vanishingPoint: [0.505, 0.318],
    thresholds: {
      plantHue: [48, 170],
      plantSat: 0.2,
      plantTop: 0.3,
      stoneSat: 0.26,
      stoneTop: 0.4,
      stoneOrigin: [0.5, 1.12],
      lines: 1,
      hatch: 1,
      stipple: 1,
    },
    overrides: [
      // The terrace, joints and all: moss in the joints is still stone.
      {
        kind: "stone",
        points: [
          [0.395, 0.452], [0.47, 0.435], [0.6, 0.438], [0.64, 0.46], [0.6, 0.49], [0.66, 0.52],
          [0.8, 0.545], [0.86, 0.6], [0.93, 0.65], [0.965, 0.75], [0.985, 0.9], [1, 1],
          [0, 1], [0, 0.86], [0.055, 0.8], [0.09, 0.74], [0.07, 0.66], [0.1, 0.6], [0.16, 0.56],
          [0.3, 0.545], [0.385, 0.52], [0.4, 0.49],
        ],
      },
      // Benches are cast stone, set in one piece: no base first.
      { kind: "stone", base: false, points: [[0.02, 0.5], [0.16, 0.485], [0.16, 0.6], [0.1, 0.65], [0.05, 0.64]] },
      { kind: "stone", base: false, points: [[0.855, 0.48], [0.975, 0.5], [0.97, 0.65], [0.91, 0.65], [0.86, 0.58]] },
      // The urn is cast stone too.
      {
        kind: "stone",
        base: false,
        points: [[0.424, 0.49], [0.47, 0.488], [0.55, 0.49], [0.592, 0.5], [0.585, 0.53], [0.555, 0.558], [0.535, 0.572], [0.54, 0.6], [0.54, 0.634], [0.472, 0.634], [0.475, 0.598], [0.478, 0.572], [0.45, 0.55], [0.428, 0.515]],
      },
      // The urn's planting comes up with the terrace around it.
      {
        kind: "planter",
        points: [[0.422, 0.497], [0.44, 0.474], [0.468, 0.46], [0.49, 0.445], [0.515, 0.435], [0.545, 0.441], [0.568, 0.456], [0.594, 0.49], [0.59, 0.512], [0.562, 0.542], [0.53, 0.56], [0.5, 0.562], [0.468, 0.548], [0.44, 0.527]],
      },
      // Mulched bed and boulders behind the urn.
      { kind: "planting", points: [[0.43, 0.345], [0.7, 0.35], [0.72, 0.42], [0.6, 0.44], [0.44, 0.44]] },
      // The lawn beyond: distance, mist at dusk.
      {
        kind: "far",
        points: [[0, 0.02], [1, 0.02], [1, 0.36], [0.88, 0.33], [0.7, 0.3], [0.52, 0.3], [0.3, 0.3], [0.12, 0.32], [0, 0.36]],
      },
    ],
    retouch: [
      // People picnicking on the lawn beyond; clone the grass next to them.
      { kind: "clone", rect: [0.456, 0.158, 0.056, 0.046], from: [0.07, 0.004] },
      { kind: "clone", rect: [0.285, 0.128, 0.026, 0.042], from: [-0.034, 0.01] },
      // A red park structure behind the left tree.
      { kind: "desat", rect: [0.12, 0.08, 0.1, 0.075], amount: 0.85 },
    ],
    // The planted urn: the camera sees a busy tangle, a designer draws a bowl on a plinth.
    quiet: [
      [[0.022, 0.51], [0.1, 0.483], [0.165, 0.49], [0.156, 0.6], [0.1, 0.65], [0.045, 0.648], [0.022, 0.55]],
      [[0.85, 0.485], [0.92, 0.47], [0.98, 0.5], [0.972, 0.64], [0.905, 0.64], [0.86, 0.595]],
      [[0.424, 0.49], [0.47, 0.488], [0.55, 0.49], [0.592, 0.5], [0.585, 0.53], [0.555, 0.558], [0.535, 0.572], [0.54, 0.6], [0.54, 0.634], [0.472, 0.634], [0.475, 0.598], [0.478, 0.572], [0.45, 0.55], [0.428, 0.515]],
    ],
    strokes: [
      // rim
      { points: ellipse(0.508, 0.4975, 0.0798, 0.0165, 1.2, 48), weight: 2, closed: true },
      // bowl
      {
        points: [[0.4283, 0.4945], [0.4338, 0.5091], [0.444, 0.5259], [0.4581, 0.5406], [0.4707, 0.5531], [0.4817, 0.5632], [0.4943, 0.5689], [0.5068, 0.5709], [0.5304, 0.5678], [0.5493, 0.5573], [0.5666, 0.5385], [0.5807, 0.5196], [0.5876, 0.5035]],
        weight: 3,
      },
      // stem and collar
      { points: [[0.4822, 0.5705], [0.4818, 0.6036]], weight: 2 },
      { points: [[0.5298, 0.5703], [0.5302, 0.6036]], weight: 2 },
      { points: [[0.4815, 0.5752], [0.5305, 0.5752]], weight: 1 },
      // plinth
      { points: [[0.4768, 0.6044], [0.5358, 0.6044], [0.5376, 0.6298], [0.4754, 0.6298]], weight: 2, closed: true, sharp: true },
      // left bench: curved slab on two pedestals
      {
        points: [[0.026, 0.54], [0.032, 0.517], [0.052, 0.508], [0.08, 0.497], [0.104, 0.489], [0.13, 0.485], [0.158, 0.493], [0.16, 0.499], [0.13, 0.505], [0.112, 0.513], [0.101, 0.524], [0.098, 0.537], [0.094, 0.541], [0.06, 0.541], [0.026, 0.54]],
        weight: 3,
      },
      { points: [[0.028, 0.545], [0.06, 0.547], [0.092, 0.547]], weight: 1 },
      { points: [[0.101, 0.527], [0.112, 0.517], [0.152, 0.505]], weight: 1 },
      { points: [[0.108, 0.521], [0.108, 0.585]], weight: 2 },
      { points: [[0.15, 0.513], [0.15, 0.591]], weight: 2 },
      { points: [[0.112, 0.593], [0.148, 0.593]], weight: 2 },
      { points: [[0.05, 0.548], [0.052, 0.641]], weight: 1 },
      { points: [[0.09, 0.548], [0.098, 0.644]], weight: 2 },
      // right bench
      {
        points: [[0.8536, 0.4915], [0.8706, 0.4807], [0.8923, 0.4764], [0.9188, 0.4781], [0.9433, 0.4852], [0.966, 0.4953], [0.9754, 0.5015], [0.9698, 0.5494], [0.9433, 0.5431], [0.9188, 0.5368], [0.9008, 0.533], [0.9018, 0.5267], [0.9084, 0.5192], [0.9037, 0.5104], [0.8867, 0.5015], [0.8678, 0.4953], [0.8536, 0.4922]],
        weight: 3,
      },
      { points: [[0.8546, 0.4978], [0.8867, 0.5066], [0.9074, 0.5179]], weight: 1 },
      { points: [[0.9018, 0.5393], [0.9433, 0.5481], [0.9698, 0.5532]], weight: 1 },
      { points: [[0.8678, 0.5015], [0.865, 0.5658], [0.864, 0.5884]], weight: 2 },
      { points: [[0.8848, 0.51], [0.8848, 0.586]], weight: 1 },
      { points: [[0.864, 0.5897], [0.9093, 0.5922]], weight: 2 },
      { points: [[0.9112, 0.5431], [0.9188, 0.5784], [0.9093, 0.6136], [0.9112, 0.6363]], weight: 2 },
      { points: [[0.9622, 0.5557], [0.9603, 0.601], [0.966, 0.6363]], weight: 2 },
      { points: [[0.9112, 0.5658], [0.9622, 0.5758]], weight: 1 },
      // the dogwood limbs reaching over the terrace (the phone crop's whole sky)
      { points: [[0.3, 0.193], [0.33, 0.163], [0.3625, 0.142], [0.4, 0.127], [0.43, 0.11], [0.455, 0.095], [0.475, 0.078]], weight: 2 },
      { points: [[0.3, 0.2], [0.33, 0.171], [0.363, 0.15], [0.398, 0.135]], weight: 1 },
      { points: [[0.3, 0.103], [0.325, 0.083], [0.35, 0.057], [0.375, 0.023], [0.3875, 0.003]], weight: 2 },
      { points: [[0.4, 0.127], [0.41, 0.108], [0.428, 0.093]], weight: 1 },
      // leaves over the rim, a few confident strokes
      { points: [[0.47, 0.487], [0.482, 0.47], [0.492, 0.462]], weight: 1 },
      { points: [[0.515, 0.482], [0.522, 0.462], [0.535, 0.452]], weight: 1 },
      { points: [[0.53, 0.47], [0.545, 0.458], [0.558, 0.458]], weight: 1 },
    ],
    callouts: [
      {
        id: "terrace",
        label: "Bluestone terrace",
        spec: `18'-0" × 24'-0"`,
        anchor: [0.33, 0.8],
        anchorMobile: [0.45, 0.8],
        offset: [-190, -70],
        offsetMobile: [-110, -64],
        stage: "stone",
      },
      {
        id: "bench",
        label: "Stone bench, curved",
        spec: "× 2, on 6\" base",
        anchor: [0.915, 0.555],
        offset: [-60, -175],
        mobile: false,
        stage: "stone",
      },
      {
        id: "bed",
        label: "Shade bed",
        spec: "Hellebore, sword fern",
        anchor: [0.055, 0.78],
        anchorMobile: [0.4, 0.4],
        offset: [70, 40],
        offsetMobile: [-30, -118],
        stage: "planting",
      },
      {
        id: "urn",
        label: "Cast stone urn",
        spec: "Carex, planted",
        anchor: [0.555, 0.505],
        offset: [70, -60],
        offsetMobile: [-196, -112],
        // set and planted with the terrace around it
        stage: "stone",
      },
      {
        id: "trees",
        label: "Multi-stem dogwood",
        spec: "× 2, 14' ht",
        anchor: [0.235, 0.3],
        anchorMobile: [0.655, 0.3],
        offset: [80, -70],
        offsetMobile: [-150, -74],
        stage: "finish",
      },
      {
        id: "path",
        label: "Path light 2700K",
        spec: "× 6, low voltage",
        anchor: [0.625, 0.455],
        offset: [150, 30],
        offsetMobile: [-40, 96],
        stage: "light",
      },
    ],
    lights: [
      { at: [0.07, 0.7], kind: "path", radius: 0.12, intensity: 1 },
      { at: [0.255, 0.535], kind: "path", radius: 0.1, intensity: 1 },
      { at: [0.375, 0.456], kind: "path", radius: 0.085, intensity: 1 },
      { at: [0.625, 0.456], kind: "path", radius: 0.085, intensity: 1 },
      { at: [0.765, 0.528], kind: "path", radius: 0.1, intensity: 1 },
      { at: [0.935, 0.705], kind: "path", radius: 0.12, intensity: 1 },
      { at: [0.175, 0.44], kind: "up", radius: 0.1, height: 0.42, intensity: 1 },
      { at: [0.755, 0.44], kind: "up", radius: 0.1, height: 0.42, intensity: 1 },
    ],
    lightsMobile: [
      { at: [0.375, 0.456], kind: "path", radius: 0.085, intensity: 1 },
      { at: [0.625, 0.456], kind: "path", radius: 0.085, intensity: 1 },
      { at: [0.508, 0.636], kind: "up", radius: 0.05, height: 0.2, intensity: 0.8 },
      { at: [0.405, 0.64], kind: "path", radius: 0.07, intensity: 0.9 },
      { at: [0.61, 0.64], kind: "path", radius: 0.07, intensity: 0.9 },
      { at: [0.66, 0.43], kind: "up", radius: 0.07, height: 0.4, intensity: 0.9 },
    ],
  } as HeroConfig,

  /** Derived from the hero config, so swapping the hero photo swaps it everywhere. The closing
   * section shows the hero's own lit render, so there is no separate dusk photo to replace. */
  photos: {
    hero: { id: HERO_PHOTO.id, src: pexels(HERO_PHOTO.id), credit: HERO_PHOTO.credit, title: "Tranquil stone patio" },
  },

  projects: [
    {
      id: 7045706,
      src: pexels(7045706, 1600),
      credit: "Max Vakhtbovych",
      alt: "Stone stair beside a house, terraced walls and conifer planting climbing the slope",
      town: "Somerset, Bellevue",
      drawn: "Dec 2023",
      title: "The hillside stair",
      scope: "Stone stair, three terraced walls, conifer planting",
      weeks: 14,
      band: "$100k+",
      focal: "50% 55%",
    },
    {
      id: 32707056,
      src: pexels(32707056, 1600),
      credit: "xfly",
      alt: "A raked gravel court with mossy boulders and clipped shrubs under a red maple",
      town: "Medina",
      drawn: "Jan 2024",
      title: "The maple court",
      scope: "Gravel court, set boulders, clipped planting, one old maple kept",
      weeks: 9,
      band: "$40–100k",
      focal: "40% 50%",
    },
    {
      id: 38193972,
      src: pexels(38193972, 1600),
      credit: "Magda Ehlers",
      alt: "A circular paved fire court with a steel fire bowl and stone chairs, screened by planting",
      town: "Juanita, Kirkland",
      drawn: "Nov 2024",
      title: "The fire circle",
      scope: "Paver circle, low seat wall, screen planting",
      weeks: 6,
      band: "$15–40k",
      focal: "68% 60%",
    },
  ],

  priceBands: [
    {
      id: "patio",
      name: "Patio & walls",
      low: 15,
      high: 40,
      plus: false,
      what: "A terrace or path, a low wall or two, the drainage under them, planting at the edges.",
    },
    {
      id: "full",
      name: "Full backyard",
      low: 40,
      high: 100,
      plus: true,
      what: "Terraces, walls and steps, full planting, lighting on its own circuits, often a fire or water feature.",
    },
  ],
  priceFactors: [
    { id: "access", label: "Access", note: "If a skid steer can't get in, stone goes in by wheelbarrow. That's labour." },
    { id: "slope", label: "Slope & wall height", note: "Walls over 4' need an engineer, geogrid and a permit." },
    { id: "stone", label: "Stone choice", note: "Local basalt and bluestone vs. imported porcelain: 2–3× swing per square foot." },
    { id: "drainage", label: "Drainage", note: `${REGION} clay holds water. Most yards need a drain line to daylight or a dry well.` },
    { id: "demo", label: "Demolition & haul-off", note: "Old concrete, lawn and roots out before anything goes in." },
    { id: "lighting", label: "Lighting", note: "Low-voltage fixtures, transformer, and conduit laid before the stone." },
    { id: "plants", label: "Plant size at install", note: "A 6' vine maple costs more than a 3' one — and saves you four summers." },
    { id: "trees", label: "Trees to protect", note: "Root zones set where walls and footings can go." },
  ],
  reviews: [
    {
      quote:
        "They drew the whole thing in December, built it in April, and in July we were out there every night. The lighting plan alone was worth the design fee.",
      who: "Homeowner, Houghton",
    },
    {
      quote: "Ours was the third quote and the highest. It’s also the only patio on our street that hasn’t moved.",
      who: "Homeowner, Bridle Trails",
    },
  ],
};

export type Site = typeof site;
export const pexelsUrl = pexels;
export const heroSrc = (w: number) => pexels(site.hero.photo.id, w);
