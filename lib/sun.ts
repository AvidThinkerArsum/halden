/**
 * Sunset for a place and a day (NOAA's sunrise equation, good to a minute or so at
 * these latitudes), formatted in the place's own time zone.
 */
const rad = Math.PI / 180;

export function sunsetUTC(date: Date, lat: number, lon: number): Date | null {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const n = Math.round(jd - 2451545.0 + 0.0008);
  const jStar = n - lon / 360;
  const M = (357.5291 + 0.98560028 * jStar) % 360;
  const C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const jTransit = 2451545.0 + jStar + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);
  const sinD = Math.sin(lambda * rad) * Math.sin(23.4397 * rad);
  const cosD = Math.cos(Math.asin(sinD));
  const cosW = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * sinD) / (Math.cos(lat * rad) * cosD);
  if (cosW < -1 || cosW > 1) return null;
  const w0 = Math.acos(cosW) / rad;
  const jSet = jTransit + w0 / 360;
  return new Date((jSet - 2440587.5) * 86400000);
}

export function fmtTime(d: Date, tz: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d).replace(" AM", " am").replace(" PM", " pm");
}

/** Local noon (roughly) in the given zone for "today", so the date never slips a day. */
export function localNoon(tz: string, monthOverride?: number) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = monthOverride ?? Number(parts.find((p) => p.type === "month")?.value) - 1;
  const d = monthOverride === undefined ? Number(parts.find((p) => p.type === "day")?.value) : 15;
  // 20:00 UTC is lunchtime on the West Coast
  return new Date(Date.UTC(y, m, d, 20, 0, 0));
}
