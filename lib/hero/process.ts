/**
 * One photo in, every hero state out.
 *
 * Runs once in the browser on the loaded photo (~1600px wide) and produces:
 *  - photo:  the retouched full-resolution photo (canvas, for the WebGL texture)
 *  - sketch: a graphite drawing of the same photo (alpha = graphite), pixel-aligned
 *  - maps:   RGBA8 per pixel: R stone mask, G planting mask, B reveal time, A distance/haze
 *
 * The drawing is built from strokes, not a filtered image: Sobel edges are thinned,
 * traced into chains, simplified and redrawn as pen lines with slight overshoot; stone
 * gets diagonal hatching by tone, planting gets stipple, trees get looser hatching.
 */
import type { Override, Pt, Retouch, Stroke } from "@/lib/site";

export type Thresholds = {
  plantHue: [number, number];
  plantSat: number;
  plantTop: number;
  stoneSat: number;
  stoneTop: number;
  stoneOrigin: Pt;
  lines: number;
  hatch: number;
  stipple: number;
};

export type Processed = {
  w: number;
  h: number;
  photo: HTMLCanvasElement;
  sketch: HTMLCanvasElement;
  /** R stone, G planting, B reveal time, A distance/haze. */
  maps: Uint8Array;
  /** R no-base (set pieces), G how much stone surrounds the pixel, B when that stone is built, A open lawn in the distance. */
  maps2: Uint8Array;
};

const STONE = 1;
const PLANT = 2;
const SKY = 3;

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

export function loadImage(src: string, srcSet?: string, sizes?: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = "anonymous";
    im.decoding = "async";
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error(`image failed: ${src}`));
    if (srcSet) {
      im.sizes = sizes ?? "100vw";
      im.srcset = srcSet;
    }
    im.src = src;
  });
}

// ---------- small deterministic helpers ----------

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  let fx = x - xi, fy = y - yi;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi), c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

function fbm(x: number, y: number) {
  return 0.55 * vnoise(x, y) + 0.3 * vnoise(x * 2.1 + 17, y * 2.1 + 5) + 0.15 * vnoise(x * 4.3 + 3, y * 4.3 + 29);
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

// ---------- blur (3 box passes ≈ gaussian) ----------

function boxesForGauss(sigma: number, n = 3) {
  const wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const wu = wl + 2;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  const r: number[] = [];
  for (let i = 0; i < n; i++) r.push(((i < m ? wl : wu) - 1) / 2);
  return r;
}

function boxH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const inv = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[row + Math.min(Math.max(k, 0), w - 1)];
    for (let x = 0; x < w; x++) {
      dst[row + x] = acc * inv;
      acc += src[row + Math.min(x + r + 1, w - 1)] - src[row + Math.max(x - r, 0)];
    }
  }
}

function boxV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number) {
  const inv = 1 / (2 * r + 1);
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let k = -r; k <= r; k++) acc += src[Math.min(Math.max(k, 0), h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = acc * inv;
      acc += src[Math.min(y + r + 1, h - 1) * w + x] - src[Math.max(y - r, 0) * w + x];
    }
  }
}

export function blur(src: Float32Array, w: number, h: number, sigma: number) {
  const a = src.slice();
  const b = new Float32Array(a.length);
  for (const r of boxesForGauss(sigma)) {
    if (r < 1) continue;
    boxH(a, b, w, h, r);
    boxV(b, a, w, h, r);
  }
  return a;
}

// ---------- edges ----------

function sobel(L: Float32Array, w: number, h: number) {
  const mag = new Float32Array(w * h);
  const dir = new Uint8Array(w * h); // 0: horiz edge normal, 1: 45, 2: vertical, 3: 135
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a = L[i - w - 1], b = L[i - w], c = L[i - w + 1];
      const d = L[i - 1], f = L[i + 1];
      const g = L[i + w - 1], hh = L[i + w], k = L[i + w + 1];
      const gx = c + 2 * f + k - a - 2 * d - g;
      const gy = g + 2 * hh + k - a - 2 * b - c;
      mag[i] = Math.hypot(gx, gy);
      let ang = (Math.atan2(gy, gx) * 180) / Math.PI;
      if (ang < 0) ang += 180;
      dir[i] = ang < 22.5 || ang >= 157.5 ? 0 : ang < 67.5 ? 1 : ang < 112.5 ? 2 : 3;
    }
  }
  return { mag, dir };
}

function nms(mag: Float32Array, dir: Uint8Array, w: number, h: number) {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const m = mag[i];
      if (m === 0) continue;
      let a: number, b: number;
      switch (dir[i]) {
        case 0: a = mag[i - 1]; b = mag[i + 1]; break;
        case 1: a = mag[i - w - 1]; b = mag[i + w + 1]; break;
        case 2: a = mag[i - w]; b = mag[i + w]; break;
        default: a = mag[i - w + 1]; b = mag[i + w - 1];
      }
      if (m >= a && m >= b) out[i] = m;
    }
  }
  return out;
}

function percentile(values: Float32Array, p: number, mask?: (i: number) => boolean) {
  let max = 0;
  for (let i = 0; i < values.length; i++) if (values[i] > max) max = values[i];
  if (max === 0) return 0;
  const bins = new Uint32Array(2048);
  let n = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (v <= 0 || (mask && !mask(i))) continue;
    bins[Math.min(2047, Math.floor((v / max) * 2047))]++;
    n++;
  }
  let acc = 0;
  const target = n * p;
  for (let k = 0; k < 2048; k++) {
    acc += bins[k];
    if (acc >= target) return (k / 2047) * max;
  }
  return max;
}

/** Hysteresis with a per-pixel threshold multiplier. */
function hysteresis(m: Float32Array, w: number, h: number, high: number, low: number, mult: Float32Array) {
  const out = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let i = 0; i < m.length; i++) {
    if (m[i] >= high * mult[i]) {
      out[i] = 1;
      stack.push(i);
    }
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w, y = (i / w) | 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (!out[j] && m[j] >= low * mult[j]) {
          out[j] = 1;
          stack.push(j);
        }
      }
    }
  }
  return out;
}

const NB = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

/** Walk thinned edge pixels into polylines. */
function traceChains(E: Uint8Array, w: number, h: number, minLen: number) {
  const seen = new Uint8Array(w * h);
  const chains: number[][] = [];
  const degree = (x: number, y: number) => {
    let d = 0;
    for (const [dx, dy] of NB) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && E[ny * w + nx]) d++;
    }
    return d;
  };
  const walk = (sx: number, sy: number) => {
    const pts = [sx, sy];
    seen[sy * w + sx] = 1;
    let x = sx, y = sy, last = -1;
    for (;;) {
      let found = -1;
      // prefer continuing straight
      const order = last < 0 ? [0, 1, 2, 3, 4, 5, 6, 7] : [last, (last + 1) & 7, (last + 7) & 7, (last + 2) & 7, (last + 6) & 7];
      for (const k of order) {
        const nx = x + NB[k][0], ny = y + NB[k][1];
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const j = ny * w + nx;
        if (E[j] && !seen[j]) {
          found = k;
          break;
        }
      }
      if (found < 0) break;
      x += NB[found][0];
      y += NB[found][1];
      seen[y * w + x] = 1;
      pts.push(x, y);
      last = found;
    }
    if (pts.length / 2 >= minLen) chains.push(pts);
  };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (E[i] && !seen[i] && degree(x, y) === 1) walk(x, y);
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    if (E[i] && !seen[i]) walk(x, y);
  }
  return chains;
}

function rdp(pts: number[], eps: number) {
  const n = pts.length / 2;
  if (n < 3) return pts;
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: [number, number][] = [[0, n - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const ax = pts[a * 2], ay = pts[a * 2 + 1], bx = pts[b * 2], by = pts[b * 2 + 1];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let best = -1, bestD = eps;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((pts[i * 2] - ax) * dy - (pts[i * 2 + 1] - ay) * dx) / len;
      if (d > bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i * 2], pts[i * 2 + 1]);
  return out;
}

/** 8-connected components of a binary mask, with size and vertical extent per label (label 0 = background). */
function components(mask: Uint8Array, w: number, h: number) {
  const lab = new Int32Array(w * h);
  const size: number[] = [0], minY: number[] = [0], maxY: number[] = [0];
  const stack: number[] = [];
  let next = 1;
  for (let s = 0; s < mask.length; s++) {
    if (!mask[s] || lab[s]) continue;
    const id = next++;
    let cnt = 0, y0 = h, y1 = 0;
    lab[s] = id;
    stack.push(s);
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w, y = (i / w) | 0;
      cnt++;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w || (!dx && !dy)) continue;
          const j = ny * w + nx;
          if (mask[j] && !lab[j]) {
            lab[j] = id;
            stack.push(j);
          }
        }
      }
    }
    size.push(cnt);
    minY.push(y0);
    maxY.push(y1);
  }
  return { lab, count: next, size, minY, maxY };
}

function polygonMask(points: Pt[], w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x * w, y * h) : ctx.moveTo(x * w, y * h)));
  ctx.closePath();
  ctx.fill();
  const d = ctx.getImageData(0, 0, w, h).data;
  const m = new Uint8Array(w * h);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 127 ? 1 : 0;
  return m;
}

// ---------- retouch ----------

function retouchPhoto(img: HTMLImageElement, retouch: Retouch[] = []) {
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, W, H);
  for (const r of retouch) {
    const x = Math.round(r.rect[0] * W), y = Math.round(r.rect[1] * H);
    const w = Math.max(2, Math.round(r.rect[2] * W)), h = Math.max(2, Math.round(r.rect[3] * H));
    if (r.kind === "clone") {
      const p = document.createElement("canvas");
      p.width = w;
      p.height = h;
      const pc = p.getContext("2d")!;
      pc.drawImage(c, x + r.from[0] * W, y + r.from[1] * H, w, h, 0, 0, w, h);
      pc.globalCompositeOperation = "destination-in";
      pc.save();
      pc.translate(w / 2, h / 2);
      pc.scale(w / 2, h / 2);
      const g = pc.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(0.55, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      pc.fillStyle = g;
      pc.fillRect(-1, -1, 2, 2);
      pc.restore();
      ctx.drawImage(p, x, y);
    } else {
      const id = ctx.getImageData(x, y, w, h);
      const d = id.data;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const k = (j * w + i) * 4;
        const ex = Math.min(i, w - 1 - i) / (w * 0.25), ey = Math.min(j, h - 1 - j) / (h * 0.25);
        const a = r.amount * clamp01(Math.min(ex, ey));
        const l = 0.3 * d[k] + 0.59 * d[k + 1] + 0.11 * d[k + 2];
        d[k] += (l - d[k]) * a;
        d[k + 1] += (l - d[k + 1]) * a;
        d[k + 2] += (l - d[k + 2]) * a;
      }
      ctx.putImageData(id, x, y);
    }
  }
  return c;
}

/** Zhang–Suen thinning, in place. */
function thin(B: Uint8Array, w: number, h: number) {
  const del: number[] = [];
  for (let iter = 0; iter < 20; iter++) {
    let changed = false;
    for (let pass = 0; pass < 2; pass++) {
      del.length = 0;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = y * w + x;
          if (!B[i]) continue;
          const p2 = B[i - w], p3 = B[i - w + 1], p4 = B[i + 1], p5 = B[i + w + 1];
          const p6 = B[i + w], p7 = B[i + w - 1], p8 = B[i - 1], p9 = B[i - w - 1];
          const nb = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
          if (nb < 2 || nb > 6) continue;
          const tr = (+(!p2 && p3)) + (+(!p3 && p4)) + (+(!p4 && p5)) + (+(!p5 && p6)) + (+(!p6 && p7)) + (+(!p7 && p8)) + (+(!p8 && p9)) + (+(!p9 && p2));
          if (tr !== 1) continue;
          if (pass === 0 ? p2 * p4 * p6 === 0 && p4 * p6 * p8 === 0 : p2 * p4 * p8 === 0 && p2 * p6 * p8 === 0) del.push(i);
        }
      }
      for (const i of del) B[i] = 0;
      if (del.length) changed = true;
    }
    if (!changed) break;
  }
}

// ---------- main ----------

export type ProcessInput = {
  img: HTMLImageElement;
  width: number;
  thresholds: Thresholds;
  overrides?: Override[];
  retouch?: Retouch[];
  strokes?: Stroke[];
  quiet?: Pt[][];
  /** The terrace's vanishing point: hatching on the ground foreshortens toward it. */
  vp?: Pt;
  /** Hero: build masks + reveal map. Cards: drawing only. */
  full?: boolean;
  seed?: number;
  /** Debug: which layers to draw (c contours, j joints, h hatch, s stipple). */
  layers?: string;
  debug?: Record<string, Float32Array | Uint8Array>;
};

export async function processPhoto(input: ProcessInput): Promise<Processed> {
  const { img, thresholds: th, overrides = [], retouch = [], strokes = [], quiet = [], full = true, seed = 7, layers = "cjhs" } = input;
  const on = (l: string) => layers.includes(l);
  const photo = retouchPhoto(img, retouch);
  const w = Math.min(input.width, photo.width);
  const h = Math.round((w * photo.height) / photo.width);
  const n = w * h;
  const k = w / 1600; // stroke scale

  const small = document.createElement("canvas");
  small.width = w;
  small.height = h;
  const sctx = small.getContext("2d", { willReadFrequently: true })!;
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(photo, 0, 0, w, h);
  const px = sctx.getImageData(0, 0, w, h).data;

  // --- colour analysis ---
  const L = new Float32Array(n);
  const green = new Float32Array(n);
  const sat = new Float32Array(n);
  const val = new Float32Array(n);
  const hue = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = px[i * 4] / 255, g = px[i * 4 + 1] / 255, b = px[i * 4 + 2] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let hh = 0;
    if (d > 1e-5) {
      if (mx === r) hh = ((g - b) / d) % 6;
      else if (mx === g) hh = (b - r) / d + 2;
      else hh = (r - g) / d + 4;
      hh *= 60;
      if (hh < 0) hh += 360;
    }
    const s = mx === 0 ? 0 : d / mx;
    L[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sat[i] = s;
    val[i] = mx;
    hue[i] = hh;
    const isGreen = hh >= th.plantHue[0] && hh <= th.plantHue[1] && ((s > th.plantSat && mx > 0.07) || (s > 0.38 && mx > 0.035));
    green[i] = isGreen ? 1 : 0;
  }
  await tick();
  const greenSoft = blur(green, w, h, 3 * k + 1);
  const greenBig = blur(green, w, h, 9 * k + 2);
  // local texture: open lawn is smooth, a canopy of leaves is busy
  const texture = new Float32Array(n);
  {
    const L2 = new Float32Array(n);
    for (let i = 0; i < n; i++) L2[i] = L[i] * L[i];
    const mu = blur(L, w, h, 3 * k + 1), mu2 = blur(L2, w, h, 3 * k + 1);
    for (let i = 0; i < n; i++) texture[i] = Math.sqrt(Math.max(0, mu2[i] - mu[i] * mu[i]));
  }
  await tick();

  // --- classes ---
  // where beds give way to trees: an irregular line, not a ruler
  const topLine = new Float32Array(w);
  for (let x = 0; x < w; x++) topLine[x] = th.plantTop + (fbm(x / (240 * k + 30), 3.3) - 0.5) * 0.16;
  // with hand-drawn stone areas, stone lives only inside them
  const stonePolys = overrides.some((o) => o.kind === "stone");
  const cls = new Uint8Array(n);
  const farRaw = new Float32Array(n);
  /** the whole bright distance, leaves and all: the evening's air (the drawing uses `far`, which spares the canopy) */
  const airRaw = new Float32Array(n);
  for (let y = 0; y < h; y++) {
    const yn = y / h;
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (greenSoft[i] > 0.5) cls[i] = yn > topLine[x] ? PLANT : 0;
      else if (!stonePolys && sat[i] < th.stoneSat && yn > th.stoneTop) cls[i] = STONE;
      const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
      if (yn < 0.5 && ((val[i] > 0.82 && sat[i] < 0.16) || (b > r + 12 && b >= g && val[i] > 0.5 && sat[i] > 0.12))) cls[i] = SKY;
    }
  }
  // Hand-drawn stone areas, grown a little to the photo's real stone edge (a polygon is only
  // ever roughly on it), then given a slightly irregular boundary: no ruler-straight fronts.
  const stoneArea = new Uint8Array(n);
  const noBase = new Uint8Array(n);
  const planter = new Uint8Array(n);
  {
    const polyAll = new Uint8Array(n);
    for (const o of overrides) {
      if (o.kind !== "stone" && o.kind !== "planter") continue;
      await tick();
      const m = polygonMask(o.points, w, h);
      for (let i = 0; i < n; i++) {
        if (!m[i]) continue;
        if (o.kind === "planter") planter[i] = 1;
        else {
          polyAll[i] = 1;
          if (o.base === false) noBase[i] = 1;
        }
      }
    }
    // grow: stone-coloured pixels within a short reach of the polygons, connected to them
    const reach = blur(Float32Array.from(polyAll), w, h, 9 * k + 2);
    const grown = polyAll.slice();
    const stack: number[] = [];
    for (let i = 0; i < n; i++) if (polyAll[i]) stack.push(i);
    const like = (i: number) =>
      !grown[i] && reach[i] > 0.04 && sat[i] < th.stoneSat && val[i] > 0.17 && val[i] < 0.9 && !green[i] && greenSoft[i] < 0.3 && i / w / h > th.stoneTop;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % w, y = (i / w) | 0;
      if (x > 0 && like(i - 1)) { grown[i - 1] = 1; stack.push(i - 1); }
      if (x < w - 1 && like(i + 1)) { grown[i + 1] = 1; stack.push(i + 1); }
      if (y > 0 && like(i - w)) { grown[i - w] = 1; stack.push(i - w); }
      if (y < h - 1 && like(i + w)) { grown[i + w] = 1; stack.push(i + w); }
    }
    await tick();
    const soft = blur(Float32Array.from(grown), w, h, 4 * k + 1);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const edge = (fbm(x / (26 * k + 5) + 91, y / (26 * k + 5) + 13) - 0.5) * 0.75;
      stoneArea[i] = soft[i] > 0.5 + edge ? 1 : 0;
    }
  }
  // hardscape: everything but a real mass of leaves (moss in the joints stays stone)
  for (let i = 0; i < n; i++) if (stoneArea[i]) cls[i] = greenBig[i] > 0.5 && greenSoft[i] > 0.55 ? PLANT : STONE;
  for (const o of overrides) {
    if (o.kind === "stone" || o.kind === "planter") continue;
    await tick();
    const m = polygonMask(o.points, w, h);
    for (let i = 0; i < n; i++) {
      if (!m[i]) continue;
      if (o.kind === "planting") cls[i] = PLANT;
      else if (o.kind === "rest") cls[i] = 0;
      else if (o.kind === "sky") cls[i] = SKY;
      // distance is the open, bright, smooth part; leaves overhead stay near (and get drawn)
      else if (val[i] > 0.42 || (green[i] && val[i] > 0.3)) {
        airRaw[i] = 1;
        if (texture[i] < 0.075) farRaw[i] = 1;
      }
    }
  }
  // majority smoothing: no speckle of one class inside another
  await tick();
  {
    const ind = [0, STONE, PLANT, SKY].map((c) => {
      const a = new Float32Array(n);
      for (let i = 0; i < n; i++) a[i] = cls[i] === c ? 1 : 0;
      return blur(a, w, h, 1.8 * k + 0.6);
    });
    const order = [0, STONE, PLANT, SKY];
    for (let i = 0; i < n; i++) {
      let best = 0, bv = -1;
      for (let c = 0; c < 4; c++) if (ind[c][i] > bv) { bv = ind[c][i]; best = order[c]; }
      cls[i] = best;
    }
  }
  // Islands in the terrace (a tuft of moss, a leaf, a shadow) are part of the stone: they
  // are built with it, never left as paper in a finished terrace. Planters keep their own timing.
  await tick();
  {
    const notStone = new Uint8Array(n);
    for (let i = 0; i < n; i++) notStone[i] = cls[i] !== STONE && cls[i] !== SKY && !planter[i] ? 1 : 0;
    const cc = components(notStone, w, h);
    const inside = new Int32Array(cc.count), rim = new Int32Array(cc.count), rimStone = new Int32Array(cc.count);
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, l = cc.lab[i];
      if (!l) continue;
      if (stoneArea[i]) inside[l]++;
      // 4-neighbours that leave the island
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (cc.lab[j] === l) continue;
        rim[l]++;
        if (cls[j] === STONE) rimStone[l]++;
      }
    }
    const small = 0.003 * n;
    const merge = new Uint8Array(cc.count);
    for (let l = 1; l < cc.count; l++) {
      if (cc.size[l] > small) continue;
      if (inside[l] > cc.size[l] * 0.5 || rimStone[l] > rim[l] * 0.6) merge[l] = 1;
    }
    for (let i = 0; i < n; i++) if (merge[cc.lab[i]]) cls[i] = STONE;
  }
  const stoneM = new Float32Array(n), plantM = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    stoneM[i] = cls[i] === STONE ? 1 : 0;
    plantM[i] = cls[i] === PLANT ? 1 : 0;
    if (cls[i] === SKY) farRaw[i] = airRaw[i] = 1;
  }
  const far = blur(farRaw, w, h, 14 * k + 2);
  const hush = new Uint8Array(n);
  for (const q of quiet) {
    const m = polygonMask(q, w, h);
    for (let i = 0; i < n; i++) if (m[i]) hush[i] = 1;
  }
  await tick();

  // --- tone ---
  const Lf = blur(L, w, h, 1.2 * k + 0.4);
  const Lm = blur(L, w, h, 2.2 * k + 0.5);
  const Lc = blur(L, w, h, 5 * k + 1);
  await tick();

  // --- contours: medium scale, weighted by how strong they are at a coarse scale ---
  const em = sobel(Lm, w, h);
  const ec = sobel(Lc, w, h);
  const nm = nms(em.mag, em.dir, w, h);
  await tick();
  const highM = percentile(nm, 0.8) * th.lines;
  const highC = percentile(ec.mag, 0.9) || 1;
  const src = new Float32Array(n);
  const mult = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const c = cls[i];
    src[i] = nm[i] / (highM || 1);
    let m = c === STONE ? 1.3 : c === PLANT ? 1.3 : c === SKY ? 4 : greenSoft[i] > 0.45 ? 1.55 : 1.0;
    m *= 1 + far[i] * 1.2;
    mult[i] = m;
  }
  const E = hysteresis(src, w, h, 1, 0.38, mult);
  await tick();
  const contours = traceChains(E, w, h, Math.round(20 * k + 6));
  await tick();

  // --- ink: dark-line DoG (joints, silhouettes, cracks), cleaned of speckle ---
  // Valleys of luminance are where a pen goes: flagstone joints, the shadow line under a
  // bench, the dark side of a trunk. Speckle is removed by connected-component size.
  const inkChains: { pts: number[]; s: number }[] = [];
  const inkMask = new Uint8Array(n);
  {
    const Lv = blur(L, w, h, 4.2 * k + 0.8);
    const V = new Float32Array(n);
    for (let i = 0; i < n; i++) V[i] = Math.max(0, Lv[i] - Lf[i]);
    const Vs = blur(V, w, h, 0.8 * k + 0.3);
    // local contrast normalisation: a faint joint in flat light counts as much as a bright one
    const Vloc = blur(Vs, w, h, 22 * k + 4);
    const floor = percentile(Vs, 0.5) + 1e-4;
    const Vn = new Float32Array(n);
    for (let i = 0; i < n; i++) Vn[i] = Vs[i] / (Vloc[i] + floor);
    const tau = new Float32Array(n);
    const baseT = percentile(Vn, 0.88, (i) => cls[i] === STONE) || 1;
    for (let i = 0; i < n; i++) {
      const c = cls[i];
      tau[i] = baseT * (c === STONE ? 1 : c === PLANT ? 1.9 : c === SKY ? 99 : greenSoft[i] > 0.45 ? 1.8 : 1.25) * (1 + far[i] * 2) * th.lines;
    }
    const B = hysteresis(Vn, w, h, 1, 0.55, tau);
    thin(B, w, h);
    const raw = traceChains(B, w, h, Math.round(22 * k + 6));
    for (const ch of raw) {
      let s2 = 0, c0 = 0;
      for (let j = 0; j < ch.length; j += 2) {
        const i = ch[j + 1] * w + ch[j];
        s2 += Vn[i] / tau[i];
        c0 = cls[i];
      }
      const len = ch.length / 2;
      const str = s2 / len;
      const need = (c0 === STONE ? 38 : 50) * k + 6;
      const span = Math.hypot(ch[ch.length - 2] - ch[0], ch[ch.length - 1] - ch[1]);
      const wiggle = len / (span + 1);
      // joints are long and fairly straight; texture is short and wiggly
      if (len < need * (str > 1.7 ? 0.6 : 1) || wiggle > (str > 1.7 ? 2.2 : 1.55)) continue;
      inkChains.push({ pts: ch, s: str });
    }
    for (let i = 0; i < n; i++) if (B[i]) inkMask[i] = 1;
    if (input.debug) Object.assign(input.debug, { V: Vn, B });
  }
  await tick();

  // --- flagstone joints ---
  // On an old terrace the joints are moss: thin green lines in grey stone. Their centre lines
  // close each flag's outline, which a Sobel pass on luminance alone never does.
  const jointChains: number[][] = [];
  const jointWide = new Uint8Array(n);
  {
    const M = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (!stoneArea[i] || cls[i] !== STONE || hush[i]) continue;
      const hh = hue[i];
      if (hh >= 45 && hh <= 165 && sat[i] > 0.2 && val[i] > 0.09) M[i] = 1;
    }
    // close pen-width gaps along a joint, then take its centre line
    const Ms = blur(M, w, h, 1.5 * k + 0.5);
    const J = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      J[i] = Ms[i] > 0.16 ? 1 : 0;
      jointWide[i] = Ms[i] > 0.1 || inkMask[i] ? 1 : 0;
    }
    thin(J, w, h);
    const raw = traceChains(J, w, h, Math.round(14 * k + 4));
    for (const ch of raw) {
      const len = ch.length / 2;
      const span = Math.hypot(ch[ch.length - 2] - ch[0], ch[ch.length - 1] - ch[1]);
      if (len / (span + 1) > 1.7) continue; // a tuft, not a joint
      jointChains.push(ch);
    }
  }
  await tick();

  // --- tonal rendering ---
  const sketch = document.createElement("canvas");
  sketch.width = w;
  sketch.height = h;
  const ctx = sketch.getContext("2d")!;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const rnd = mulberry32(seed);
  const jit = (a: number) => (rnd() - 0.5) * a;

  // relative darkness within a class, by percentile, so wet dark stone isn't all "dark"
  const classTone = (test: (i: number) => boolean, lo: number, hi: number) => {
    const pLo = percentile(Lc, lo, test);
    const pHi = percentile(Lc, hi, test);
    return (i: number) => clamp01((pHi - Lc[i]) / (pHi - pLo || 1));
  };
  const isCanopy = (i: number) => cls[i] === 0 && greenSoft[i] > 0.45 && far[i] < 0.5;
  const toneStone = classTone((i) => cls[i] === STONE, 0.04, 0.55);
  const tonePlant = classTone((i) => cls[i] === PLANT || isCanopy(i), 0.05, 0.85);
  const toneRest = classTone((i) => cls[i] === 0 && far[i] < 0.5, 0.05, 0.6);

  /** Hand hatching: short parallel strokes in patches, not endless ruled lines. */
  const hatch = (angle: number, spacing: number | ((y: number) => number), test: (i: number, x: number, y: number) => boolean, alpha: number, width: number, maxLen: number) => {
    const a = (angle * Math.PI) / 180;
    const dx = Math.cos(a), dy = Math.sin(a);
    const nx = -dy, ny = dx;
    const corners = [[0, 0], [w, 0], [0, h], [w, h]];
    const pn = corners.map(([x, y]) => x * nx + y * ny);
    const pd = corners.map(([x, y]) => x * dx + y * dy);
    const nMin = Math.min(...pn), nMax = Math.max(...pn), dMin = Math.min(...pd), dMax = Math.max(...pd);
    const path = new Path2D();
    const step = 1.25;
    const gap = (o: number) => {
      if (typeof spacing === "number") return spacing;
      // spacing that depends on depth: the y where this line crosses the middle of the sheet
      const t = Math.abs(dx) > 0.3 ? (w / 2 - o * nx) / dx : (dMin + dMax) / 2;
      return spacing(o * ny + t * dy);
    };
    for (let o = nMin; o <= nMax; o += gap(o)) {
      const oo = o + jit(gap(o) * 0.3);
      let start = -1, len = 0, limit = maxLen * (0.6 + rnd() * 0.8);
      for (let t = dMin + rnd() * 6; t <= dMax; t += step) {
        const x = oo * nx + t * dx, y = oo * ny + t * dy;
        const xi = x | 0, yi = y | 0;
        const ok = xi >= 0 && yi >= 0 && xi < w && yi < h && test(yi * w + xi, xi, yi);
        if (ok && start < 0) { start = t; len = 0; }
        if (start >= 0) len += step;
        if (start >= 0 && (!ok || len >= limit)) {
          if (len > 4 * k + 2) {
            const sx = oo * nx + start * dx, sy = oo * ny + start * dy;
            const ex = oo * nx + (start + len) * dx, ey = oo * ny + (start + len) * dy;
            const wob = 0.7 * k;
            path.moveTo(sx + jit(wob), sy + jit(wob));
            path.lineTo(ex + jit(wob), ey + jit(wob));
          }
          start = -1;
          t += 1.5 + rnd() * 4 * k; // pen lift
          limit = maxLen * (0.6 + rnd() * 0.8);
        }
      }
    }
    ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
    ctx.lineWidth = width;
    ctx.stroke(path);
  };

  const H = on("h") ? th.hatch : -10;
  const nzs = (x: number, y: number, s: number) => fbm(x / s, y / s) - 0.5;
  // stone, flag by flag: the joints split the terrace into flags; the darker ones get ground-plane
  // hatching that tightens toward the vanishing point, the darkest a second diagonal family.
  // Strokes stop short of the joints, the way a hand lifts at a line.
  {
    const vpY = (input.vp?.[1] ?? th.stoneTop - 0.08) * h;
    const depth = (y: number) => clamp01((y - vpY) / (h - vpY || 1));
    const flagMask = new Uint8Array(n);
    const jd = blur(Float32Array.from(jointWide), w, h, 1.6 * k + 0.5);
    for (let i = 0; i < n; i++) flagMask[i] = cls[i] === STONE && !hush[i] && jd[i] < 0.08 ? 1 : 0;
    const fl = components(flagMask, w, h);
    const sum = new Float32Array(fl.count);
    for (let i = 0; i < n; i++) if (fl.lab[i]) sum[fl.lab[i]] += toneStone(i);
    const minFlag = (22 * k + 6) ** 2;
    const flagTone = new Float32Array(fl.count);
    for (let l = 1; l < fl.count; l++) {
      const m = sum[l] / fl.size[l];
      // a flag reads as one stone: its own tone, nudged per flag so neighbours differ
      // (a flag whose joints never closed is really several: judge those pixel by pixel)
      flagTone[l] = fl.size[l] < minFlag || fl.size[l] > 0.02 * n ? -1 : m + (hash2(l, 71) - 0.5) * 0.4;
    }
    const inFlag = (i: number, x: number, y: number, lim: number) => {
      const l = fl.lab[i];
      if (!l) return false;
      const ft = flagTone[l];
      if (ft < 0) return toneStone(i) * H + nzs(x + 13, y + 7, 36 * k + 6) * 0.6 > lim;
      return ft * H * 0.75 + toneStone(i) * 0.35 > lim;
    };
    const persp = (base: number) => (y: number) => base * (0.42 + 1.0 * depth(y));
    hatch(-4, persp(5.2 * k + 1.2), (i, x, y) => inFlag(i, x, y, 0.46), 0.36, 0.7 * k + 0.3, 30 * k + 8);
    hatch(56, persp(6 * k + 1.4), (i, x, y) => inFlag(i, x, y, 0.8) && nzs(x + 50, y, 40 * k + 6) > -0.15, 0.3, 0.62 * k + 0.3, 22 * k + 6);
  }
  // trunks and deep shade: steep strokes
  hatch(74, 3.8 * k + 1, (i, x, y) => cls[i] === 0 && far[i] < 0.5 && !isCanopy(i) && toneRest(i) * H + nzs(x, y, 30 * k + 5) * 0.3 > 0.55, 0.36, 0.75 * k + 0.3, 24 * k + 6);
  // under-bed shadow at the stone's edge
  hatch(-40, 4 * k + 1, (i, x, y) => cls[i] === PLANT && tonePlant(i) * H + nzs(x, y, 25 * k + 5) * 0.3 > 0.9, 0.28, 0.65 * k + 0.3, 16 * k + 5);
  await tick();

  // stipple: planting dense by relative darkness; canopy lighter; distance nearly blank
  {
    const cell = 2.9 * k + 0.8;
    ctx.beginPath();
    for (let gy = 0; gy < h; gy += cell) {
      for (let gx = 0; gx < w; gx += cell) {
        const x = gx + rnd() * cell, y = gy + rnd() * cell;
        const xi = x | 0, yi = y | 0;
        if (xi >= w || yi >= h) continue;
        const i = yi * w + xi;
        let p = 0;
        if (cls[i] === PLANT) p = 0.02 + Math.pow(tonePlant(i), 1.7) * 0.85;
        else if (isCanopy(i)) p = (0.01 + Math.pow(tonePlant(i), 1.9) * 0.6) * (1 - far[i]);
        else if (cls[i] === 0 && far[i] >= 0.5) p = 0;
        p *= on("s") ? th.stipple : 0;
        if (rnd() < p) {
          const r = (0.5 + rnd() * 0.5) * (0.85 * k + 0.25);
          ctx.moveTo(x + r, y);
          ctx.arc(x, y, r, 0, Math.PI * 2);
        }
      }
    }
    ctx.fillStyle = "rgba(0,0,0,0.86)";
    ctx.fill();
  }
  await tick();

  // --- line work, in four weights ---
  const buckets = [new Path2D(), new Path2D(), new Path2D(), new Path2D()];
  const addChain = (raw: number[], bucket: number, eps: number, overshoot: boolean, sharp = false) => {
    const pts = eps > 0 ? rdp(raw, eps) : raw;
    const m = pts.length / 2;
    if (m < 2) return;
    const p = buckets[bucket];
    if (sharp) {
      // ruled lines, each edge overshooting its corner a little
      for (let j = 0; j < m - 1; j++) {
        const ax = pts[j * 2], ay = pts[j * 2 + 1], bx = pts[j * 2 + 2], by = pts[j * 2 + 3];
        const l = Math.hypot(bx - ax, by - ay) || 1;
        const o = 3 * k;
        p.moveTo(ax - ((bx - ax) / l) * o + jit(0.4 * k), ay - ((by - ay) / l) * o + jit(0.4 * k));
        p.lineTo(bx + ((bx - ax) / l) * o + jit(0.4 * k), by + ((by - ay) / l) * o + jit(0.4 * k));
      }
      return;
    }
    const over = overshoot ? (raw.length / 2 > 40 ? 4 : 2) * k : 0;
    const x0 = pts[0], y0 = pts[1], x1 = pts[2], y1 = pts[3];
    const l0 = Math.hypot(x1 - x0, y1 - y0) || 1;
    p.moveTo(x0 - ((x1 - x0) / l0) * over + jit(0.5 * k), y0 - ((y1 - y0) / l0) * over + jit(0.5 * k));
    for (let j = 1; j < m - 1; j++) {
      const ax = pts[j * 2] + jit(0.7 * k), ay = pts[j * 2 + 1] + jit(0.7 * k);
      const bx = (pts[j * 2] + pts[j * 2 + 2]) / 2, by = (pts[j * 2 + 1] + pts[j * 2 + 3]) / 2;
      p.quadraticCurveTo(ax, ay, bx, by);
    }
    const ex = pts[(m - 1) * 2], ey = pts[(m - 1) * 2 + 1], qx = pts[(m - 2) * 2], qy = pts[(m - 2) * 2 + 1];
    const l1 = Math.hypot(ex - qx, ey - qy) || 1;
    p.lineTo(ex + ((ex - qx) / l1) * over + jit(0.5 * k), ey + ((ey - qy) / l1) * over + jit(0.5 * k));
  };
  const hushed = (pts: number[]) => {
    let q = 0;
    for (let j = 0; j < pts.length; j += 2) q += hush[pts[j + 1] * w + pts[j]];
    return q / (pts.length / 2) > 0.3;
  };
  const canopyFrac = (pts: number[]) => {
    let q = 0;
    for (let j = 0; j < pts.length; j += 2) {
      const i = pts[j + 1] * w + pts[j];
      q += isCanopy(i) || cls[i] === PLANT ? 1 : 0;
    }
    return q / (pts.length / 2);
  };
  /** Leaves make little closed worms; a designer stipples them instead. Keep long, open strokes. */
  const wormy = (pts: number[], minLen: number, maxWiggle: number) => {
    const cnt = pts.length / 2;
    const span = Math.hypot(pts[pts.length - 2] - pts[0], pts[pts.length - 1] - pts[1]);
    return cnt < minLen || cnt / (span + 1) > maxWiggle;
  };
  for (const raw of on("c") ? contours : []) {
    if (hushed(raw)) continue;
    let s = 0, fr = 0, yy = 0;
    const cnt = raw.length / 2;
    if (canopyFrac(raw) > 0.5 && wormy(raw, 70 * k + 10, 1.55)) continue;
    for (let j = 0; j < raw.length; j += 2) {
      const i = raw[j + 1] * w + raw[j];
      s += ec.mag[i] / highC;
      fr += far[i];
      yy += raw[j + 1] / h;
    }
    s /= cnt; fr /= cnt; yy /= cnt;
    // importance: coarse-scale strength, nearer = heavier, distance = lighter
    const imp = s * (0.75 + yy * 0.5) * (1 - fr * 0.55) * Math.min(1.25, 0.8 + cnt / (160 * k + 40));
    if (imp < 0.55 && cnt < 60 * k + 10) continue; // short and weak: texture, not form
    const b = imp > 1.15 ? 3 : imp > 0.75 ? 2 : imp > 0.42 ? 1 : 0;
    addChain(raw, b, 1.5 * k + 0.4, b >= 2);
  }
  for (const c of on("j") ? inkChains : []) {
    if (hushed(c.pts)) continue;
    if (canopyFrac(c.pts) > 0.5 && wormy(c.pts, 80 * k + 10, 1.4)) continue;
    let yy = 0, fr = 0;
    for (let j = 0; j < c.pts.length; j += 2) { yy += c.pts[j + 1]; fr += far[c.pts[j + 1] * w + c.pts[j]]; }
    yy /= (c.pts.length / 2) * h;
    fr /= c.pts.length / 2;
    const imp = c.s * (0.7 + yy * 0.6) * (1 - fr * 0.5);
    addChain(c.pts, imp > 2.3 ? 2 : imp > 1.3 ? 1 : 0, 1.3 * k + 0.4, true);
  }
  // flagstone joints: a steady line, heavier in the foreground
  for (const ch of on("j") ? jointChains : []) {
    let yy = 0;
    for (let j = 1; j < ch.length; j += 2) yy += ch[j];
    yy /= (ch.length / 2) * h;
    const len = ch.length / 2;
    addChain(ch, yy > 0.7 && len > 36 * k ? 2 : yy > 0.52 ? 1 : 0, 1.4 * k + 0.4, true);
  }
  // the designer's own lines
  for (const st of strokes) {
    const pts: number[] = [];
    for (const [x, y] of st.points) pts.push(x * w, y * h);
    if (st.closed) pts.push(pts[0], pts[1]);
    addChain(pts, st.weight ?? 2, 0, !st.closed, st.sharp);
  }
  const styles: [number, number][] = [
    [0.5, 0.75 * k + 0.3],
    [0.7, 1.0 * k + 0.35],
    [0.86, 1.35 * k + 0.4],
    [0.95, 1.8 * k + 0.5],
  ];
  buckets.forEach((p, b) => {
    ctx.strokeStyle = `rgba(0,0,0,${styles[b][0]})`;
    ctx.lineWidth = styles[b][1];
    ctx.stroke(p);
  });
  await tick();

  // --- reveal-time map ---
  const maps = new Uint8Array(n * 4);
  const maps2 = new Uint8Array(n * 4);
  if (full) {
    const stoneS = blur(stoneM, w, h, 1.2 * k + 0.4);
    const plantS = blur(plantM, w, h, 1.2 * k + 0.4);
    const aspect = w / h;
    const [ox, oy] = th.stoneOrigin;
    let dMin = Infinity, dMax = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (cls[i] !== STONE) continue;
      const d = Math.hypot((x / w - ox) * aspect, y / h - oy);
      if (d < dMin) dMin = d;
      if (d > dMax) dMax = d;
    }
    const STONE_END = 0.23;
    const T = new Float32Array(n);
    const nzAt = (x: number, y: number) => fbm(x / (55 * k + 8), y / (55 * k + 8)) - 0.5;
    // stone spreads from the foreground on one front
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (cls[i] !== STONE) continue;
      const d = (Math.hypot((x / w - ox) * aspect, y / h - oy) - dMin) / (dMax - dMin || 1);
      T[i] = 0.015 + (STONE_END - 0.015) * clamp01(d + nzAt(x, y) * 0.08);
    }
    await tick();
    // Planting rises out of its bed: height within the bed (each connected bed from its own
    // lowest to its highest pixel), blended with height across all the beds so neighbouring
    // beds keep one front. A 2-D measure, so no column runs ahead of its neighbours.
    const bed = new Uint8Array(n);
    for (let i = 0; i < n; i++) bed[i] = cls[i] === PLANT && !planter[i] ? 1 : 0;
    const bc = components(bed, w, h);
    let zTop = h, zBot = 0;
    // (a stray clump high in a tree has no bed of its own: it follows the common front)
    const minBed = 0.004 * n;
    for (let l = 1; l < bc.count; l++) {
      if (bc.size[l] < minBed) continue;
      zTop = Math.min(zTop, bc.minY[l]);
      zBot = Math.max(zBot, bc.maxY[l]);
    }
    if (zBot <= zTop) { zTop = 0; zBot = h - 1; }
    const HP = new Float32Array(n), WP = new Float32Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, l = bc.lab[i];
      if (!l) continue;
      const g = clamp01((zBot - y) / (zBot - zTop + 1));
      const own = bc.size[l] < minBed ? g : clamp01((bc.maxY[l] - y) / (bc.maxY[l] - bc.minY[l] + 1));
      HP[i] = 0.55 * own + 0.45 * g;
      WP[i] = 1;
    }
    await tick();
    const HPb = blur(HP, w, h, 6 * k + 1.5), WPs = blur(WP, w, h, 6 * k + 1.5);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!bed[i]) continue;
      const hh = WPs[i] > 0.01 ? HPb[i] / WPs[i] : HP[i];
      const fine = fbm(x / (16 * k + 3) + 7, y / (16 * k + 3) + 3) - 0.5;
      T[i] = 0.36 + 0.25 * clamp01(hh + nzAt(x, y) * 0.16 + fine * 0.06);
    }
    // Set pieces (the benches, the urn) arrive whole, as a crew sets them: one time per piece,
    // with only a slight wipe across it.
    const median = (v: number[]) => (v.length ? v.sort((a, b) => a - b)[Math.floor(v.length / 2)] : STONE_END);
    {
      const piece = new Uint8Array(n);
      for (let i = 0; i < n; i++) piece[i] = noBase[i] && cls[i] === STONE ? 1 : 0;
      const pc = components(piece, w, h);
      const vals: number[][] = Array.from({ length: pc.count }, () => []);
      for (let i = 0; i < n; i++) if (pc.lab[i]) vals[pc.lab[i]].push(T[i]);
      const med = vals.map(median);
      for (let i = 0; i < n; i++) if (pc.lab[i]) T[i] = med[pc.lab[i]] + (T[i] - med[pc.lab[i]]) * 0.15;
    }
    // Planting in a vessel goes in the moment the vessel is set. (Stone runs on a lagging
    // front, 1.1b - 0.06; convert the vessel's time to the plain front the planting uses.)
    {
      const pc = components(planter, w, h);
      const vals: number[][] = Array.from({ length: pc.count }, () => []);
      for (let i = 0; i < n; i++) if (pc.lab[i] && cls[i] === STONE) vals[pc.lab[i]].push(T[i]);
      const med = vals.map(median);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (!pc.lab[i] || cls[i] === STONE) continue;
        T[i] = (Math.min(STONE_END, med[pc.lab[i]]) + 0.06) / 1.1 + 0.0015 + nzAt(x, y) * 0.002;
      }
    }
    // shade and trunk bases in a bed come up with the bed
    const TP = new Float32Array(n), WQ = new Float32Array(n);
    for (let i = 0; i < n; i++) if (bed[i]) { TP[i] = T[i]; WQ[i] = 1; }
    const TPb = blur(TP, w, h, 14 * k + 3), WPb = blur(WQ, w, h, 14 * k + 3);
    await tick();
    for (let y = 0; y < h; y++) {
      const yn = y / h;
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const c = cls[i];
        if (c === STONE || bed[i] || (planter[i] && c !== STONE)) continue;
        const nz = nzAt(x, y);
        let t: number;
        if (c === SKY) {
          t = 0.92 + 0.05 * clamp01(1 - yn + nz * 0.2);
        } else if (yn > topLine[x] + 0.02 && far[i] < 0.5) {
          t = WPb[i] > 0.04 ? TPb[i] / WPb[i] + nz * 0.03 : 0.5 + nz * 0.08;
        } else {
          // trees and distance come up from the ground, in irregular clouds
          const big = fbm(x / (160 * k + 20) + 31, y / (160 * k + 20) + 7) - 0.5;
          t = 0.68 + 0.26 * clamp01(0.62 * (1 - yn) + big * 0.9 + nz * 0.2 + far[i] * 0.08);
        }
        T[i] = t;
      }
    }
    await tick();
    // how much built stone surrounds a pixel, and when: the shader shades any paper that is
    // still unbuilt inside a finished terrace as a pencil study, not a hole
    const ST = new Float32Array(n);
    for (let i = 0; i < n; i++) ST[i] = stoneM[i] * T[i];
    const around = blur(stoneM, w, h, 10 * k + 2), aroundT = blur(ST, w, h, 10 * k + 2);
    const nb = blur(Float32Array.from(noBase), w, h, 1.2 * k + 0.4);
    const air = blur(airRaw, w, h, 14 * k + 2);
    // open lawn in the distance (smooth, bright): it takes the mist; the near canopy does not
    const lawnRaw = new Float32Array(n);
    for (let i = 0; i < n; i++) lawnRaw[i] = farRaw[i] * (1 - clamp01((texture[i] - 0.055) / 0.05));
    const lawn = blur(lawnRaw, w, h, 6 * k + 1.5);
    if (input.debug) Object.assign(input.debug, { cls, T, planter, stoneArea, texture, far });
    for (let i = 0; i < n; i++) {
      maps[i * 4] = Math.round(stoneS[i] * 255);
      maps[i * 4 + 1] = Math.round(plantS[i] * 255);
      maps[i * 4 + 2] = Math.round(clamp01(T[i]) * 255);
      maps[i * 4 + 3] = Math.round(clamp01(air[i]) * 255);
      maps2[i * 4] = Math.round(clamp01(nb[i]) * 255);
      maps2[i * 4 + 1] = Math.round(clamp01(around[i]) * 255);
      maps2[i * 4 + 2] = Math.round(clamp01(around[i] > 0.01 ? aroundT[i] / around[i] : 1) * 255);
      maps2[i * 4 + 3] = Math.round(clamp01(lawn[i] * 1.2) * 255);
    }
  }

  return { w, h, photo, sketch, maps, maps2 };
}

/** A small graphite-on-vellum raster of a processed sketch, for plan sheets and cards. */
export function sketchToPaper(p: Processed, maxW = 900, ghost?: HTMLCanvasElement) {
  const s = Math.min(1, maxW / p.w);
  const c = document.createElement("canvas");
  c.width = Math.round(p.w * s);
  c.height = Math.round(p.h * s);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#f3efe6";
  ctx.fillRect(0, 0, c.width, c.height);
  if (ghost) {
    ctx.globalAlpha = 0.08;
    ctx.drawImage(ghost, 0, 0, c.width, c.height);
    ctx.globalAlpha = 1;
  }
  // graphite: tint the alpha sketch
  const t = document.createElement("canvas");
  t.width = c.width;
  t.height = c.height;
  const tc = t.getContext("2d")!;
  tc.drawImage(p.sketch, 0, 0, c.width, c.height);
  tc.globalCompositeOperation = "source-in";
  tc.fillStyle = "#262826";
  tc.fillRect(0, 0, c.width, c.height);
  ctx.globalAlpha = 0.92;
  ctx.drawImage(t, 0, 0);
  return c;
}
