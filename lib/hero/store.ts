"use client";

import { useSyncExternalStore } from "react";
import type { Light } from "@/lib/site";
import type { Processed } from "./process";
import { HeroGL } from "./gl";

/**
 * The hero publishes what it generated so later sections reuse it without processing twice:
 * the drawing (graphite on vellum) for the plan sheets, and the finished garden at blue hour
 * with every light on for the closing section, so the page ends on the garden it started with.
 */
type Key = "sketch" | "lit";
const values: Record<Key, string | null> = { sketch: null, lit: null };
const subs = new Set<() => void>();

function publish(k: Key, url: string) {
  values[k] = url;
  subs.forEach((f) => f());
}

export const publishSketch = (url: string) => publish("sketch", url);
export const publishLit = (url: string) => publish("lit", url);

function use(k: Key) {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    () => values[k],
    () => null,
  );
}

export const useHeroSketch = () => use("sketch");
export const useHeroLit = () => use("lit");

/** Render the finished, lit garden once on a throwaway context (the whole photo, no crop). */
export function renderLit(p: Processed, lights: Light[], vp: [number, number], maxW = 1600) {
  const c = document.createElement("canvas");
  const gl = HeroGL.create(c);
  if (!gl) return null;
  try {
    gl.vp = vp;
    gl.setLights(lights);
    gl.setProcessed(p);
    const W = Math.min(maxW, p.w), H = Math.round((W * p.photo.height) / p.photo.width);
    gl.setView(W, H, { ox: 0, oy: 0, dw: W, dh: H });
    gl.set({ progress: 1, dusk: 1, draw: 1 });
    gl.setLevels(lights.map(() => 1));
    gl.render();
    return c.toDataURL("image/jpeg", 0.86);
  } catch {
    return null;
  } finally {
    gl.dispose();
  }
}
