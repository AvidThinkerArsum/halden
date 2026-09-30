/**
 * One raw WebGL2 program draws every hero state from the processed maps:
 * vellum + graphite → compacted base → stone on a wet-mortar front → planting → the rest,
 * then a blue-hour relight with up to 8 warm lights.
 */
import type { Light } from "@/lib/site";
import type { Processed } from "./process";

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
uniform sampler2D uPhoto;
uniform sampler2D uSketch;
uniform sampler2D uMaps;
uniform sampler2D uDuskTex;
uniform sampler2D uMaps2;
uniform float uHasDusk;
uniform vec2 uVP;
uniform vec2 uView;
uniform vec4 uRect;
uniform vec2 uMapSize;
uniform float uAspect;
uniform float uProgress;
uniform float uDusk;
uniform float uDraw;
uniform vec4 uL[8];
uniform vec4 uLB[8];
uniform int uMode;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) {
  return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.07 + 11.3) + 0.15 * vnoise(p * 4.3 + 3.7);
}

void main() {
  vec2 frag = vec2(gl_FragCoord.x, uView.y - gl_FragCoord.y);
  vec2 uv = clamp((frag - uRect.xy) / uRect.zw, 0.0, 1.0);
  vec2 mp = uv * uMapSize;
  vec3 photo = texture(uPhoto, uv).rgb;
  vec4 m = texture(uMaps, uv);
  float stone = m.r, plant = m.g, t = m.b, far = m.a;
  vec4 m2 = texture(uMaps2, uv);
  float noBase = m2.r, around = m2.g, aroundT = m2.b, lawn = m2.a;
  float ink = texture(uSketch, uv).a;
  // distance: the open lawn beyond sits in wet air, never bright lime
  float lumP = dot(photo, vec3(0.2126, 0.7152, 0.0722));
  // and out of focus, as a camera focused on the terrace would see it
  photo = mix(photo, textureLod(uPhoto, uv, 2.4).rgb, clamp(lawn * 1.3, 0.0, 1.0));
  lumP = dot(photo, vec3(0.2126, 0.7152, 0.0722));
  vec3 mist = mix(vec3(lumP), photo, 0.26) * 0.66 + vec3(0.06, 0.09, 0.1);
  photo = mix(photo, mist, clamp(lawn * (0.8 + 0.4 * (0.4 - uv.y)), 0.0, 0.92));
  lumP = dot(photo, vec3(0.2126, 0.7152, 0.0722));

  if (uMode == 1) {
    vec3 c = vec3(stone, plant, far * 0.85) * 0.85 + 0.08;
    float bands = step(0.86, fract(t * 24.0));
    c = mix(c, vec3(1.0), bands * 0.7);
    c = mix(c, vec3(0.0), ink * 0.6);
    outColor = vec4(c, 1.0);
    return;
  }

  // --- the sheet ---
  float fib = fbm(mp * vec2(0.011, 0.085)) * 0.55 + vnoise(mp * 0.07) * 0.45;
  vec3 vellum = vec3(0.953, 0.937, 0.902) * (0.972 + 0.05 * fib);
  vec3 graphite = vec3(0.15, 0.157, 0.15);
  vec2 sv = frag / uView;
  float edgeD = min(min(sv.x, 1.0 - sv.x) * uView.x, min(sv.y, 1.0 - sv.y) * uView.y) / min(uView.x, uView.y);
  float wob = vnoise(mp * 0.012) - 0.5;
  float margin = smoothstep(0.02, 0.13, edgeD + wob * 0.05);
  float order = clamp(length((uv - vec2(0.5, 0.62)) * vec2(uAspect, 1.0)) * 0.95 + wob * 0.3, 0.0, 1.0);
  float plotted = smoothstep(order, order + 0.07, uDraw * 1.12);
  float grain = 0.74 + 0.26 * hash(floor(mp * 1.3));
  float a = ink * margin * plotted * grain;
  vec3 drawing = mix(vellum, graphite, a * 0.94);

  // --- crew order ---
  float p = uProgress;
  float n1 = fbm(mp * 0.028) - 0.5;
  float grit = hash(floor(mp * 0.85) + 7.0);
  float tt = t + n1 * 0.035;
  float stoneFront = p * 1.1 - 0.06;
  float baseFront = stoneFront + 0.045;
  float front = mix(p, stoneFront, stone);
  float edgeW = mix(0.0055, 0.0035, stone);
  float built = smoothstep(-edgeW, edgeW, front - tt + (grit - 0.5) * 0.007 * stone);
  // compacted base runs just ahead of the stone; set pieces (benches) skip it
  float base = stone * (1.0 - noBase) * smoothstep(-0.003, 0.003, baseFront - tt + (grit - 0.5) * 0.012);
  // and stops short of the terrace's edge on a ragged line, not along the drawn polygon
  base *= smoothstep(0.47, 0.53, around + (fbm(mp * 0.013 + 3.0) - 0.5) * 0.95);

  // crushed rock, not static: aggregate cells that shrink and flatten toward the vanishing point
  float persp = clamp((uv.y - uVP.y) / max(1.0 - uVP.y, 0.1), 0.05, 1.0);
  vec2 q = mp / (mix(2.3, 8.5, persp) * vec2(1.0, 0.42 + 0.58 * persp));
  vec2 ip = floor(q), fp = fract(q);
  float d1 = 9.0, d2 = 9.0;
  vec2 cid = ip;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = vec2(hash(ip + g), hash(ip + g + 19.19)) * 0.8 + 0.1;
      vec2 r = g + o - fp;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; cid = ip + g; } else if (d < d2) { d2 = d; }
    }
  }
  float seam = sqrt(d2) - sqrt(d1);
  float sh = hash(cid + 5.3);
  vec3 baseCol = mix(vec3(0.435, 0.416, 0.38), vec3(0.541, 0.518, 0.475), sh);
  baseCol *= mix(0.8, 1.0, smoothstep(0.02, 0.2, seam));
  baseCol *= 0.93 + 0.14 * vnoise(mp * 0.045);
  baseCol *= 0.94 + 0.12 * hash(floor(mp * 1.25) + 2.3); // fines
  // the plate compactor's passes: long, faint, slightly glossy swaths
  float pass = smoothstep(0.6, 0.95, fbm(vec2(mp.x * 0.0032, mp.y * 0.02) + 4.0));
  baseCol += vec3(0.055, 0.055, 0.05) * pass * smoothstep(0.03, 0.24, seam);
  float crumbs = stone * (1.0 - noBase) * (1.0 - base) * smoothstep(0.03, 0.0, tt - baseFront) * step(0.84, hash(floor(mp * 0.9) + 3.1));
  float behind = front - tt;
  float mortar = stone * smoothstep(0.0, 0.004, behind) * (1.0 - smoothstep(0.004, 0.022, behind));
  vec3 mortarCol = vec3(0.23, 0.225, 0.215) * (0.78 + 0.4 * hash(floor(mp * 1.4) + 1.7));
  mortarCol += vec3(0.5, 0.55, 0.6) * step(0.965, hash(floor(mp * 1.1) + 9.0)) * 0.5;
  float sprout = plant * (1.0 - built) * smoothstep(0.045, 0.0, tt - front);

  // paper still unbuilt inside finished stone is shaded as a pencil study, never a hole
  float aroundBuilt = around * smoothstep(-0.01, 0.01, baseFront - aroundT);
  float wash = (1.0 - built) * (1.0 - stone * (1.0 - noBase)) * smoothstep(0.4, 0.75, aroundBuilt);
  vec3 study = mix(vellum, graphite, clamp((0.9 - lumP) * 0.6, 0.0, 0.55));
  study = mix(study, graphite, a * 0.94);

  vec3 col = drawing;
  col = mix(col, study, wash);
  col = mix(col, graphite, crumbs * 0.45 * margin);
  col = mix(col, baseCol, base * (1.0 - built));
  col = mix(col, vec3(0.58, 0.63, 0.45), sprout * 0.22);
  col = mix(col, photo, built);
  col = mix(col, mortarCol, mortar * 0.85);
  float ghost = ink * margin * mix(0.24, 0.1, smoothstep(0.82, 1.0, p));
  col = mix(col, col * 0.42, ghost * built * (1.0 - uDusk));

  // --- blue hour ---
  if (uDusk > 0.001) {
    vec3 L = pow(photo, vec3(2.2));
    float lum = dot(L, vec3(0.2126, 0.7152, 0.0722));
    vec3 amb = mix(vec3(lum), L, 0.42) * vec3(0.11, 0.18, 0.31);
    if (uHasDusk > 0.5) amb = pow(texture(uDuskTex, uv).rgb, vec3(2.2));
    vec3 twi = mix(vec3(0.06, 0.1, 0.18), vec3(0.018, 0.035, 0.06), clamp(uv.y * 2.4, 0.0, 1.0));
    amb = mix(amb, twi * (0.7 + 0.6 * fbm(mp * 0.006)) + amb * 0.35, far * 0.7 * (1.0 - uHasDusk));
    // evening falls off toward the edges
    vec2 vq = frag / uView - 0.5;
    amb *= 1.0 - dot(vq, vq) * 0.9;
    amb *= 1.0 - stone * 0.3;
    amb += stone * vec3(0.008, 0.016, 0.03) * (0.5 + fbm(mp * 0.05));
    vec3 warm = vec3(1.0, 0.64, 0.33);
    vec3 add = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      vec4 Li = uL[i];
      vec4 Bi = uLB[i];
      if (Li.w <= 0.001) continue;
      vec2 d = (uv - Li.xy) * vec2(uAspect, 1.0);
      if (Bi.x < 0.5) {
        vec2 e = d * vec2(1.0, 2.5);
        float f = exp(-dot(e, e) / (Li.z * Li.z));
        add += L * warm * f * Li.w * 11.0 * (1.0 - far * 0.85);
        // wet stone throws a streak of the fixture toward the camera
        vec2 s = d * vec2(9.0, 1.1) - vec2(0.0, 0.02);
        add += warm * stone * exp(-dot(s, s) / 0.004) * Li.w * lum * 3.0;
        vec2 g = d - vec2(0.0, -0.013);
        add += warm * (exp(-dot(g, g) / 0.000014) * 1.6 + exp(-dot(g, g) / 0.0011) * 0.07) * Li.w;
      } else {
        float up = (Li.y - uv.y) / Bi.y;
        float spread = Li.z * (0.3 + max(up, 0.0) * 1.5);
        float f = smoothstep(-0.03, 0.08, up) * exp(-max(up, 0.0) * 1.15) * exp(-(d.x * d.x) / (spread * spread));
        add += L * warm * f * Li.w * 8.0 * (1.0 - far) * (0.35 + 0.65 * (1.0 - stone));
        add += warm * exp(-dot(d, d) / 0.00004) * Li.w * 0.9;
      }
    }
    vec3 night = amb + add;
    night = night / (1.0 + night * 0.85);
    night = pow(max(night * 1.4, 0.0), vec3(1.0 / 2.2));
    col = mix(col, night, uDusk);
    col = mix(col, col * 0.62, ink * margin * 0.1 * uDusk);
  }
  outColor = vec4(col, 1.0);
}`;

export type Rect = { ox: number; oy: number; dw: number; dh: number };

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) || "shader");
  return s;
}

export class HeroGL {
  gl: WebGL2RenderingContext;
  prog: WebGLProgram;
  canvas: HTMLCanvasElement;
  u: Record<string, WebGLUniformLocation | null> = {};
  tex: WebGLTexture[] = [];
  state = { progress: 0, dusk: 0, draw: 0, mode: 0 };
  lights: Light[] = [];
  levels = new Float32Array(8);
  rect: Rect = { ox: 0, oy: 0, dw: 1, dh: 1 };
  size = { w: 1, h: 1 };
  mapSize = { w: 1, h: 1 };
  aspect = 4 / 3;
  hasDusk = false;
  vp: [number, number] = [0.5, 0.35];
  ready = false;
  raf = 0;

  static create(canvas: HTMLCanvasElement) {
    try {
      const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: "high-performance" });
      if (!gl) return null;
      return new HeroGL(canvas, gl);
    } catch {
      return null;
    }
  }

  constructor(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext) {
    this.canvas = canvas;
    this.gl = gl;
    const p = gl.createProgram()!;
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) || "link");
    this.prog = p;
    gl.useProgram(p);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(p, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const n of ["uPhoto", "uSketch", "uMaps", "uDuskTex", "uMaps2", "uVP", "uHasDusk", "uView", "uRect", "uMapSize", "uAspect", "uProgress", "uDusk", "uDraw", "uL", "uLB", "uMode"]) {
      this.u[n] = gl.getUniformLocation(p, n);
    }
    gl.uniform1i(this.u.uPhoto, 0);
    gl.uniform1i(this.u.uSketch, 1);
    gl.uniform1i(this.u.uMaps, 2);
    gl.uniform1i(this.u.uDuskTex, 3);
    gl.uniform1i(this.u.uMaps2, 4);
    for (let i = 0; i < 5; i++) this.tex.push(gl.createTexture()!);
  }

  private upload(unit: number, src: TexImageSource | { data: Uint8Array; w: number; h: number }, mip: boolean) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.tex[unit]);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if ("w" in src) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, src.w, src.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, src.data);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (mip) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  }

  setProcessed(p: Processed, duskImg?: HTMLImageElement | null) {
    this.upload(0, p.photo, true);
    this.upload(1, p.sketch, true);
    this.upload(2, { data: p.maps, w: p.w, h: p.h }, false);
    this.upload(4, { data: p.maps2, w: p.w, h: p.h }, false);
    this.hasDusk = !!duskImg;
    this.upload(3, duskImg ?? { data: new Uint8Array(4), w: 1, h: 1 }, !!duskImg);
    this.mapSize = { w: p.w, h: p.h };
    this.aspect = p.photo.width / p.photo.height;
    this.ready = true;
    this.request();
  }

  setLights(lights: Light[]) {
    this.lights = lights.slice(0, 8);
    this.request();
  }

  setLevels(levels: ArrayLike<number>) {
    let changed = false;
    for (let i = 0; i < 8; i++) {
      const v = levels[i] ?? 0;
      if (this.levels[i] !== v) {
        this.levels[i] = v;
        changed = true;
      }
    }
    if (changed) this.request();
  }

  /** Canvas size in device px and the cover rect in device px. */
  setView(w: number, h: number, rect: Rect) {
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.size = { w, h };
    this.rect = rect;
    this.request();
  }

  set(s: Partial<HeroGL["state"]>) {
    let changed = false;
    for (const k of Object.keys(s) as (keyof HeroGL["state"])[]) {
      if (this.state[k] !== s[k]) {
        this.state[k] = s[k]!;
        changed = true;
      }
    }
    if (changed) this.request();
  }

  request() {
    if (this.raf || !this.ready) return;
    this.raf = requestAnimationFrame(() => {
      this.raf = 0;
      this.render();
    });
  }

  render() {
    const gl = this.gl;
    if (!this.ready) return;
    gl.viewport(0, 0, this.size.w, this.size.h);
    gl.useProgram(this.prog);
    for (let i = 0; i < 5; i++) {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.tex[i]);
    }
    gl.uniform2f(this.u.uView, this.size.w, this.size.h);
    gl.uniform4f(this.u.uRect, this.rect.ox, this.rect.oy, this.rect.dw, this.rect.dh);
    gl.uniform2f(this.u.uMapSize, this.mapSize.w, this.mapSize.h);
    gl.uniform1f(this.u.uAspect, this.aspect);
    gl.uniform2f(this.u.uVP, this.vp[0], this.vp[1]);
    gl.uniform1f(this.u.uProgress, this.state.progress);
    gl.uniform1f(this.u.uDusk, this.state.dusk);
    gl.uniform1f(this.u.uDraw, this.state.draw);
    gl.uniform1f(this.u.uHasDusk, this.hasDusk ? 1 : 0);
    gl.uniform1i(this.u.uMode, this.state.mode);
    const L = new Float32Array(32), B = new Float32Array(32);
    this.lights.forEach((l, i) => {
      L.set([l.at[0], l.at[1], l.radius, this.levels[i] * (l.intensity ?? 1)], i * 4);
      B.set([l.kind === "up" ? 1 : 0, l.height ?? 0.4, 0, 0], i * 4);
    });
    gl.uniform4fv(this.u.uL, L);
    gl.uniform4fv(this.u.uLB, B);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    const gl = this.gl;
    this.tex.forEach((t) => gl.deleteTexture(t));
    gl.deleteProgram(this.prog);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}

/** Where a cover-fitted image lands, honouring a focal point. Shared by the shader and the SVG overlay. */
export function coverRect(vw: number, vh: number, aspect: number, focal: [number, number]): Rect {
  let dw = vw, dh = vw / aspect;
  if (dh < vh) {
    dh = vh;
    dw = vh * aspect;
  }
  const ox = Math.min(0, Math.max(vw - dw, vw / 2 - focal[0] * dw));
  const oy = Math.min(0, Math.max(vh - dh, vh / 2 - focal[1] * dh));
  return { ox, oy, dw, dh };
}
