// gb-tools v8: bump it in every script and the fetch line on any change.
// gb-fidelity: a draft against its hero, pixels and the DOM only, no AI; the hero and refs are read in memory
import { guard } from './gb-guard.mjs';
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process'; import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { createHash } from 'node:crypto';

// Far limits (scores are closeness 0 to 1)
export const FAR = { layout: 0.5, palette: 15, type: 1.6, imagery: 0.5, density: 2 };
export const AXES = ['layout', 'palette', 'type', 'imagery', 'density'];

// sRGB 0 to 255 to OKLab
export function oklab(r, g, b) {
  const f = (x) => ((x /= 255) <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4), R = f(r), G = f(g), B = f(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);

// Images are { w, h, d }: d holds RGBA bytes, row by row
export function crop(img, x, y, w, h) {
  x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y)); w = Math.min(img.w - x, Math.round(w)); h = Math.min(img.h - y, Math.round(h));
  const d = new Uint8ClampedArray(w * h * 4);
  for (let j = 0; j < h; j++) d.set(img.d.subarray(((y + j) * img.w + x) * 4, ((y + j) * img.w + x + w) * 4), j * w * 4);
  return { w, h, d };
}
// Box-average resize
export function resize(img, W, H) {
  const d = new Uint8ClampedArray(W * H * 4), sx = img.w / W, sy = img.h / H;
  for (let j = 0; j < H; j++) {
    const y0 = Math.floor(j * sy), y1 = Math.max(y0 + 1, Math.floor((j + 1) * sy));
    for (let i = 0; i < W; i++) {
      const x0 = Math.floor(i * sx), x1 = Math.max(x0 + 1, Math.floor((i + 1) * sx)); let r = 0, g = 0, b = 0, n = 0;
      for (let y = y0; y < y1 && y < img.h; y++) for (let x = x0; x < x1 && x < img.w; x++) { const k = (y * img.w + x) * 4; r += img.d[k]; g += img.d[k + 1]; b += img.d[k + 2]; n++; }
      const o = (j * W + i) * 4; d[o] = r / n; d[o + 1] = g / n; d[o + 2] = b / n; d[o + 3] = 255;
    }
  }
  return { w: W, h: H, d };
}
const labOf = (img) => { const n = img.w * img.h, L = new Float32Array(n), A = new Float32Array(n), B = new Float32Array(n); for (let i = 0; i < n; i++) { const [l, a, b] = oklab(img.d[i * 4], img.d[i * 4 + 1], img.d[i * 4 + 2]); L[i] = l; A[i] = a; B[i] = b; } return { L, A, B }; };

// A phone mockup: a device on a plain backdrop, or filling a tall capture
export function findScreen(img) {
  const { w, h } = img, lab = labOf(img), at = (x, y) => { const i = y * w + x; return [lab.L[i], lab.A[i], lab.B[i]]; };
  const t = Math.max(2, Math.round(Math.min(w, h) * 0.02)), sides = [[], [], [], []];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = at(x, y); if (y < t) sides[0].push(p); if (y >= h - t) sides[1].push(p); if (x < t) sides[2].push(p); if (x >= w - t) sides[3].push(p); }
  const ring = sides.flat(), med = [0, 1, 2].map((c) => ring.map((p) => p[c]).sort((a, b) => a - b)[ring.length >> 1]);
  const fill = sides.filter((s) => s.filter((p) => dist(p, med) < 0.06).length >= s.length * 0.8).length < 3; if (fill && h < w * 1.6) return null;
  const on = (x, y) => fill || dist(at(x, y), med) > 0.06, segs = (count, n, min) => { const s = []; let a = -1; for (let i = 0; i <= n; i++) { const yes = i < n && count[i] > min; if (yes && a < 0) a = i; if (!yes && a >= 0) { s.push([a, i - 1]); a = -1; } } return s; };
  let dev = { x0: 0, x1: w - 1, y0: 0, y1: h - 1 };
  if (!fill) {
    const col = new Array(w).fill(0); for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (on(x, y)) col[x]++;
    const cs = segs(col, w, h * 0.05).map(([a, b]) => ({ a, b, m: col.slice(a, b + 1).reduce((s, v) => s + v, 0) })).sort((p, q) => q.m - p.m)[0]; if (!cs) return null;
    const row = new Array(h).fill(0); for (let y = 0; y < h; y++) for (let x = cs.a; x <= cs.b; x++) if (on(x, y)) row[y]++;
    const rs = segs(row, h, (cs.b - cs.a) * 0.05).sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0]; if (!rs) return null;
    dev = { x0: cs.a, x1: cs.b, y0: rs[0], y1: rs[1] }; const a = (dev.x1 - dev.x0) * (dev.y1 - dev.y0);
    if (a < w * h * 0.08 || a > w * h * 0.97 || (dev.x1 - dev.x0) / (dev.y1 - dev.y0) > 0.75) return null;
  }
  const dw = dev.x1 - dev.x0, dh = dev.y1 - dev.y0;
  // Filling the capture: a near-black bezel inside a lighter rim, on all 4 sides
  const walk = (pts) => { let i = 0; while (i < pts.length && !on(...pts[i])) i++; const lim = Math.min(pts.length, i + Math.round(pts.length * 0.25)); let best = null;
    for (let a = i; a < lim;) { const c = at(...pts[a]); let b = a + 1; while (b < lim && (dist(at(...pts[b]), c) < 0.03 || (fill && Math.max(c[0], at(...pts[b])[0]) < 0.1))) b++;
      if (b - a >= 2 && c[0] < (fill ? 0.12 : 0.3) && (!fill || pts.slice(Math.max(0, a - 3), a).some((q) => at(...q)[0] > c[0] + 0.1)) && (!best || c[0] < best.L - 0.02)) best = { s: a, e: b, L: c[0] };
      a = b; }
    return best; };
  const line = (fixed, from, to, vertical) => { const p = [], s = from < to ? 1 : -1; for (let v = from; v !== to; v += s) p.push(vertical ? [fixed, v] : [v, fixed]); return p; };
  const side = (fn) => { const v = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8].map(fn).filter(Boolean).sort((a, b) => a.e - b.e); return v.length >= 2 ? v[0] : null; };
  const bez = [side((f) => walk(line(Math.round(dev.y0 + dh * f), 0, w, false))), side((f) => walk(line(Math.round(dev.y0 + dh * f), w - 1, -1, false))),
    side((f) => walk(line(Math.round(dev.x0 + dw * f), 0, h, true))), side((f) => walk(line(Math.round(dev.x0 + dw * f), h - 1, -1, true)))];
  if (bez.filter(Boolean).length < (fill ? 4 : 3)) return null;
  const thick = bez.filter(Boolean).map((v) => v.e - v.s).sort((a, b) => a - b), usual = thick[Math.min(1, thick.length - 1)];
  const [L0, R0, T0, B0] = bez.map((v) => (v == null ? null : v.e - v.s > usual * 1.6 + 2 ? v.s + usual : v.e));
  const x = L0 ?? dev.x0 + dw * 0.04, xr = R0 != null ? w - 1 - R0 : dev.x1 - dw * 0.04, y = T0 ?? dev.y0 + dh * 0.03, yb = B0 != null ? h - 1 - B0 : dev.y1 - dh * 0.03;
  if (xr - x < dw * 0.6 || yb - y < dh * 0.6 || (!fill && yb - y > h * 0.95) || yb - y < (xr - x) * 1.15 || x < dev.x0 - 2 || xr > dev.x1 + 2 || y < dev.y0 - 2 || yb > dev.y1 + 2) return null; // a portrait screen inside the device
  const edge = []; for (let k = 0; k < 40; k++) { const fx = Math.round(x + (xr - x) * (k + 0.5) / 40), fy = Math.round(y + (yb - y) * (k + 0.5) / 40); edge.push([fx, Math.round(y) - 2], [fx, Math.round(yb) + 2], [Math.round(x) - 2, fy], [Math.round(xr) + 2, fy]); }
  const inside = edge.filter(([px, py]) => px >= 0 && py >= 0 && px < w && py < h);
  if (inside.filter(([px, py]) => at(px, py)[0] < 0.3).length < inside.length * 0.6) return null;
  return { x: Math.round(x), y: Math.round(y), w: Math.round(xr - x + 1), h: Math.round(yb - y + 1) };
}

// Source chrome is not design
const rgbAt = (img, x, y) => { const k = (y * img.w + x) * 4; return [img.d[k], img.d[k + 1], img.d[k + 2]]; };
const near = (p, c, t = 14) => Math.abs(p[0] - c[0]) <= t && Math.abs(p[1] - c[1]) <= t && Math.abs(p[2] - c[2]) <= t;
const medianRGB = (ps) => [0, 1, 2].map((c) => ps.map((p) => p[c]).sort((a, b) => a - b)[ps.length >> 1]);
const rowOf = (img, y, x0 = 0, x1 = img.w) => { const o = []; for (let x = x0; x < x1; x++) o.push(rgbAt(img, x, y)); return o; };
const colOf = (img, x, y0 = 0, y1 = img.h) => { const o = []; for (let y = y0; y < y1; y++) o.push(rgbAt(img, x, y)); return o; };
const shareNear = (ps, c) => ps.filter((p) => near(p, c)).length / (ps.length || 1);
// A presentation backdrop
export function findBackdrop(img) {
  const { w, h } = img, t = Math.max(2, Math.round(Math.min(w, h) * 0.01)), sides = [[], [], [], []];
  for (let k = 0; k < t; k++) { sides[0].push(...rowOf(img, k)); sides[1].push(...rowOf(img, h - 1 - k)); sides[2].push(...colOf(img, k)); sides[3].push(...colOf(img, w - 1 - k)); }
  const bg = medianRGB(sides.flat()); if (sides.some((s) => shareNear(s, bg) < 0.9)) return null;
  const off = new Uint8Array(w * h), rowOn = new Float32Array(h), colOn = new Float32Array(w);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (!near(rgbAt(img, x, y), bg)) { off[y * w + x] = 1; rowOn[y]++; colOn[x]++; }
  for (let y = 0; y < h; y++) rowOn[y] /= w; for (let x = 0; x < w; x++) colOn[x] /= h;
  const span = (a) => { const lim = Math.max(...a) * 0.5; let i = 0, j = a.length - 1; while (i < a.length && a[i] < lim) i++; while (j > i && a[j] < lim) j--; return [i, j]; };
  const [y0, y1] = span(rowOn), [x0, x1] = span(colOn), bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  if (Math.min(x0, w - 1 - x1) < w * 0.01 || Math.min(y0, h - 1 - y1) < h * 0.01 || bw * bh < w * h * 0.5 || bw * bh > w * h * 0.97) return null;
  const inS = (pts) => pts.filter(([x, y]) => off[y * w + x]).length / pts.length, line = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  const d = 2, ins = [line(bw, (i) => [x0 + i, y0 + d]), line(bw, (i) => [x0 + i, y1 - d]), line(bh, (i) => [x0 + d, y0 + i]), line(bh, (i) => [x1 - d, y0 + i])];
  const outs = [line(bw, (i) => [x0 + i, y0 - d]), line(bw, (i) => [x0 + i, y1 + d]), line(bh, (i) => [x0 - d, y0 + i]), line(bh, (i) => [x1 + d, y0 + i])];
  if (ins.some((p) => inS(p) < 0.85) || outs.some((p) => inS(p) > 0.1)) return null;
  let o = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (off[y * w + x] && (x < x0 || x > x1 || y < y0 || y > y1)) o++;
  if (o > (w * h - bw * bh) * 0.05) return null;
  return { x: x0, y: y0, w: bw, h: bh };
}
// A credit bar: a uniform band at the bottom
export function findCreditBar(img) {
  const { w, h } = img, tall = h > w * 1.6, m = Math.max(2, Math.round(w * 0.02));
  for (const side of ['bottom']) {
    const row = (i) => rowOf(img, side === 'bottom' ? h - 1 - i : i), first = row(0), C = medianRGB(first);
    if (shareNear(first, C) < 0.9) continue;
    const barRow = (i) => { const ps = row(i), s = shareNear(ps, C); return s >= 0.5 || (tall && side === 'bottom' && i < h * 0.06 && s >= 0.25 && shareNear([...ps.slice(0, m), ...ps.slice(-m)], C) >= 0.9); };
    let n = 0; while (n < h && barRow(n)) n++;
    if (n > h * 0.08 || n < Math.max(8, h * 0.015)) continue;
    if ([0, 1, 2].map((k) => shareNear(row(n + k), C)).reduce((s, v) => s + v, 0) / 3 > 0.3) continue;
    if (shareNear(row(n - 1), C) < 0.9) continue; // a clean edge between the screen and the bar
    const inkCol = new Uint8Array(w); let ink = 0, inkRows = 0;
    for (let i = 0; i < n; i++) { let r = 0; const ps = row(i); for (let x = 0; x < w; x++) if (!near(ps[x], C, 40)) { inkCol[x] = 1; r++; } ink += r; if (r) inkRows++; }
    const share = ink / (n * w); if (share < 0.003 || share > 0.35 || inkRows < n * 0.2) continue;
    let a = inkCol.indexOf(1), b = inkCol.lastIndexOf(1), gap = 0, run = 0; for (let x = a; x <= b; x++) { run = inkCol[x] ? 0 : run + 1; gap = Math.max(gap, run); }
    if (gap < w * 0.15) continue;
    return { side, px: n, box: side === 'bottom' ? { x: 0, y: 0, w, h: h - n } : { x: 0, y: n, w, h: h - n } };
  }
  return null;
}
// A screen-recording frame
const lumOf = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
export function findRecordingFrame(img) {
  const { w, h } = img, line = (side, k) => (side === 'top' ? rowOf(img, k) : side === 'bottom' ? rowOf(img, h - 1 - k) : side === 'left' ? colOf(img, k) : colOf(img, w - 1 - k));
  const mid = (ps) => ps.slice(Math.floor(ps.length * 0.03), Math.ceil(ps.length * 0.97)), flatC = (ps, t = 0.9) => { const q = mid(ps), c = medianRGB(q); return shareNear(q, c) >= t ? c : null; };
  const lines = (side, from, max) => { let k = from; while (k < from + max) { const c = flatC(line(side, k), 0.8); if (!c || near(c, medianRGB(mid(line(side, k + 1))), 5)) break; k++; } return k; };
  let dark = null;
  for (const side of ['bottom', 'top']) {
    let d = 0; while (d < 9) { const c = flatC(line(side, d)); if (!c || lumOf(c) > 40) break; d++; }
    if (d < 2 || d > 8) continue;
    const k = lines(side, d, 2), inner = medianRGB(mid(line(side, k)));
    if (lumOf(inner) <= 40) continue; // a dark page running to the edge, not a frame
    // Rounded: just inside the edge
    const y = (j) => (side === 'bottom' ? h - 1 - k - j : k + j), round = [0, w - 1].some((x) => { let n = 0; for (let j = 0; j < 14 && y(j) >= 0 && y(j) < h; j++) if (Math.abs(lumOf(rgbAt(img, x, y(j))) - lumOf(rgbAt(img, w >> 1, y(j)))) > 30) n++; return n >= 3; });
    if (round) { dark = { side, px: k }; break; }
  }
  if (!dark) return null;
  const cut = { top: 0, bottom: 0, left: 0, right: 0 };
  for (const side of Object.keys(cut).filter((s) => s !== dark.side)) { const t = lines(side, 0, 3); if (t >= 1 && t <= 3) cut[side] = t; }
  if (!Object.values(cut).some(Boolean)) return null;
  cut[dark.side] = dark.px;
  return { cut, box: { x: cut.left, y: cut.top, w: w - cut.left - cut.right, h: h - cut.top - cut.bottom } };
}
// A mouse cursor left in a screen recording: a small arrow
export function findCursors(img) {
  const { w, h } = img, n = w * h, Y = new Float32Array(n), W1 = w + 1, I = new Float64Array(W1 * (h + 1)), out = [];
  for (let i = 0; i < n; i++) Y[i] = lumOf([img.d[i * 4], img.d[i * 4 + 1], img.d[i * 4 + 2]]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) I[(y + 1) * W1 + x + 1] = Y[y * w + x] + I[y * W1 + x + 1] + I[(y + 1) * W1 + x] - I[y * W1 + x];
  const mean = (x, y) => { const x0 = Math.max(0, x - 7), x1 = Math.min(w, x + 8), y0 = Math.max(0, y - 7), y1 = Math.min(h, y + 8); return (I[y1 * W1 + x1] - I[y0 * W1 + x1] - I[y1 * W1 + x0] + I[y0 * W1 + x0]) / ((x1 - x0) * (y1 - y0)); };
  for (const sign of [1, -1]) {
    const ink = new Uint8Array(n); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (sign * (Y[y * w + x] - mean(x, y)) > 30) ink[y * w + x] = 1;
    const seen = new Uint8Array(n), st = [];
    for (let s = 0; s < n; s++) {
      if (!ink[s] || seen[s]) continue; const px = []; seen[s] = 1; st.push(s);
      while (st.length) { const i = st.pop(); px.push(i); if (px.length > 4000) continue; const x = i % w, y = (i / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Yy = y + dy, j = Yy * w + X; if (X >= 0 && Yy >= 0 && X < w && Yy < h && ink[j] && !seen[j]) { seen[j] = 1; st.push(j); } } }
      if (px.length < 12 || px.length > 4000) continue;
      let x0 = w, x1 = 0, y0 = h, y1 = 0; for (const i of px) { const x = i % w, y = (i / w) | 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      const bw = x1 - x0 + 1, bh = y1 - y0 + 1; if (bw < 6 || bh < 10 || bw > 48 || bh > 72 || bh < bw * 1.2 || bh > bw * 2.6) continue;
      const lo = new Array(bh).fill(w), hi = new Array(bh).fill(-1); for (const i of px) { const x = i % w, r = ((i / w) | 0) - y0; lo[r] = Math.min(lo[r], x); hi[r] = Math.max(hi[r], x); }
      if (hi.some((v) => v < 0) || hi[0] - lo[0] + 1 > Math.max(2, bw * 0.35) || lo[0] - x0 > bw * 0.3) continue; // the tip, top left
      const top = Math.ceil(bh * 0.6); if (lo.slice(0, top).filter((v) => v - x0 <= Math.max(1, bw * 0.15)).length < top * 0.8) continue; // a straight left edge
      const p = hi.findIndex((v) => v >= x1 - 1); if (p < bh * 0.3 || p > bh * 0.85) continue; // widest past the first third
      const slack = Math.max(2, bw * 0.25); let off = 0; for (let r = 0; r <= p; r++) if (Math.abs(hi[r] - x0 - (r / p) * (bw - 1)) > slack) off++; if (off) continue;
      const tail = Math.max(2, Math.round(bh * 0.15)); if (lo.slice(bh - tail).some((v) => v - x0 < bw * 0.25)) continue; // the tail, to the right
      // Two tones, as a cursor is drawn
      const inC = new Set(px); let hol = 0, holN = 0, holY = 0, inkY = 0, ring = 0, ringN = 0;
      for (const i of px) inkY += Y[i];
      for (let r = Math.floor(bh * 0.15); r < Math.ceil(bh * 0.6); r++) for (let x = lo[r] + 1; x < hi[r]; x++) { const i = (y0 + r) * w + x; holN++; if (!inC.has(i)) { hol++; holY += Y[i]; } }
      for (let r = 0; r < bh; r++) for (const x of [lo[r] - 1, hi[r] + 1]) if (x >= 0 && x < w) { ringN++; if (sign * (Y[(y0 + r) * w + x] - mean(x, y0 + r)) < -20) ring++; }
      const hollow = holN && hol >= holN * 0.4 && Math.abs(holY / hol - inkY / px.length) >= 60;
      if (!hollow && !(ringN && ring >= ringN * 0.6)) continue;
      const band = []; for (let y = y0 - 4; y <= y1 + 4; y++) for (let x = x0 - 4; x <= x1 + 4; x++) if (x >= 0 && y >= 0 && x < w && y < h && (x < x0 - 1 || x > x1 + 1 || y < y0 - 1 || y > y1 + 1)) band.push(Y[y * w + x]);
      const bm = band.reduce((a, v) => a + v, 0) / (band.length || 1); if (!band.length || Math.sqrt(band.reduce((a, v) => a + (v - bm) ** 2, 0) / band.length) > 30) continue;
      out.push({ x: x0, y: y0, w: bw, h: bh });
    }
  }
  return out.slice(0, 3);
}
// The trims in turn: the backdrop, a recording frame, a credit bar
export function trimChrome(img, k = 1) {
  let box = { x: 0, y: 0, w: img.w, h: img.h }; const cut = [], P = (v) => `${Math.round(v * k)}px`;
  const b = findBackdrop(img);
  if (b) {
    const s = [b.x, img.w - b.x - b.w, b.y, img.h - b.y - b.h].map((v) => Math.round(v * k));
    cut.push(Math.max(...s) - Math.min(...s) <= 2 ? `backdrop ${s[0]}px each side` : `backdrop ${s[0]}px left, ${s[1]}px right, ${s[2]}px top, ${s[3]}px bottom`); box = b;
  }
  const at = () => (box.x || box.y || box.w !== img.w || box.h !== img.h ? crop(img, box.x, box.y, box.w, box.h) : img);
  const f = findRecordingFrame(at());
  if (f) { cut.push(`recording frame ${Object.entries(f.cut).filter(([, v]) => v).map(([s, v]) => `${P(v)} ${s}`).join(', ')}`); box = { x: box.x + f.box.x, y: box.y + f.box.y, w: f.box.w, h: f.box.h }; }
  const c = findCreditBar(at());
  if (c) { cut.push(`credit bar ${P(c.px)} ${c.side}`); box = { x: box.x + c.box.x, y: box.y + c.box.y, w: c.box.w, h: c.box.h }; }
  return { box: cut.length ? box : null, cut };
}

// Photo blocks: many colours, none of them ruling
export function photoMask(img, lab) {
  const bs = Math.max(8, Math.round(Math.max(img.w, img.h) / 50)), cw = Math.floor(img.w / bs), ch = Math.floor(img.h / bs), m = new Uint8Array(cw * ch);
  for (let by = 0; by < ch; by++) for (let bx = 0; bx < cw; bx++) {
    const bins = new Map(); let n = 0;
    for (let y = by * bs; y < (by + 1) * bs; y++) for (let x = bx * bs; x < (bx + 1) * bs; x++) { const i = y * img.w + x, k = Math.floor(lab.L[i] / 0.04) * 4096 + (Math.floor(lab.A[i] / 0.02) + 32) * 64 + Math.floor(lab.B[i] / 0.02) + 32; bins.set(k, (bins.get(k) || 0) + 1); n++; }
    const v = [...bins.values()].sort((p, q) => q - p);
    if (v.filter((c) => c >= n * 0.04).length >= 3 && (v[0] + (v[1] || 0)) / n < 0.6) m[by * cw + bx] = 1;
  }
  const near = (g, x, y) => { let c = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if ((dx || dy) && X >= 0 && Y >= 0 && X < cw && Y < ch && g[Y * cw + X]) c++; } return c; };
  const step = (g, keep) => { const o = new Uint8Array(cw * ch); for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) o[y * cw + x] = keep(g[y * cw + x], near(g, x, y)) ? 1 : 0; return o; };
  // Lone blocks are text fringes
  const k = step(step(step(m, (v, c) => v && c >= 3), (v, c) => v || c >= 3), (v, c) => v && c >= 6);
  return { cw, ch, bs, m: k, share: k.reduce((s, v) => s + v, 0) / (cw * ch || 1) };
}
// Dominant colours: k-means in OKLab, deterministic seeds
function palette(lab, n, k = 6) {
  const idx = []; for (let i = 0; i < n; i += 3) idx.push(i); const P = idx.map((i) => [lab.L[i], lab.A[i], lab.B[i]]);
  const C = [P[0]]; while (C.length < k) { let best = P[0], bd = -1; for (const p of P) { const d = Math.min(...C.map((c) => dist(p, c))); if (d > bd) { bd = d; best = p; } } C.push(best); }
  const as = new Int32Array(P.length);
  for (let it = 0; it < 10; it++) {
    for (let i = 0; i < P.length; i++) { let bi = 0, bd = 9; for (let c = 0; c < k; c++) { const d = dist(P[i], C[c]); if (d < bd) { bd = d; bi = c; } } as[i] = bi; }
    for (let c = 0; c < k; c++) { const s = [0, 0, 0]; let m = 0; for (let i = 0; i < P.length; i++) if (as[i] === c) { s[0] += P[i][0]; s[1] += P[i][1]; s[2] += P[i][2]; m++; } if (m) C[c] = s.map((v) => v / m); }
  }
  const w = new Array(k).fill(0); for (const a of as) w[a]++;
  return C.map((c, i) => ({ lab: c, w: w[i] / P.length })).filter((c) => c.w > 0.01).sort((a, b) => b.w - a.w);
}
// Every number the comparison needs
export function features(img, [vw, vh]) {
  const W = Math.round(Math.sqrt(120000 * vw / vh)), H = Math.round(W * vh / vw), a = resize(img, W, H), lab = labOf(a);
  const fit = (n) => { const k = Math.min(1, n / Math.max(img.w, img.h)); return k < 1 ? resize(img, Math.max(1, Math.round(img.w * k)), Math.max(1, Math.round(img.h * k))) : img; };
  const p = fit(800), mask = photoMask(p, labOf(p)), inPhoto = (x, y) => mask.m[Math.min(mask.ch - 1, Math.floor(y * mask.ch / H)) * mask.cw + Math.min(mask.cw - 1, Math.floor(x * mask.cw / W))];
  const gw = Math.max(4, Math.round(Math.sqrt(150 * vw / vh))), gh = Math.max(4, Math.round(gw * vh / vw)), lum = new Array(gw * gh).fill(0), edge = new Array(gw * gh).fill(0), cnt = new Array(gw * gh).fill(0);
  let ink = 0, inkN = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, c = Math.min(gh - 1, Math.floor(y * gh / H)) * gw + Math.min(gw - 1, Math.floor(x * gw / W)), e = Math.hypot(lab.L[i + 1] - lab.L[i - 1], lab.L[i + W] - lab.L[i - W]);
    lum[c] += lab.L[i]; edge[c] += e; cnt[c]++; if (!inPhoto(x, y)) { ink += e; inkN++; }
  }
  for (let c = 0; c < lum.length; c++) { lum[c] /= cnt[c] || 1; edge[c] /= cnt[c] || 1; }
  return { size: [W, H], grid: [gw, gh], lum, edge, ink: ink / (W * H), palette: palette(lab, W * H), photo: mask.share };
}
// Structural similarity of two grids: 1 is the same pattern
const ssim = (x, y, c) => { const n = x.length, mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n; let cv = 0, vx = 0, vy = 0; for (let i = 0; i < n; i++) { cv += (x[i] - mx) * (y[i] - my); vx += (x[i] - mx) ** 2; vy += (y[i] - my) ** 2; } return (2 * cv / n + c) / ((vx + vy) / n + c); };
export function paletteDE(p, q) {
  const a = p.map((c) => c.w), b = q.map((c) => c.w), sa = a.reduce((s, v) => s + v, 0) || 1, sb = b.reduce((s, v) => s + v, 0) || 1, pairs = [];
  for (let i = 0; i < p.length; i++) { a[i] /= sa; for (let j = 0; j < q.length; j++) pairs.push([dist(p[i].lab, q[j].lab), i, j]); } for (let j = 0; j < q.length; j++) b[j] /= sb;
  let cost = 0; for (const [d, i, j] of pairs.sort((x, y) => x[0] - y[0])) { const m = Math.min(a[i], b[j]); if (m > 0) { cost += m * d; a[i] -= m; b[j] -= m; } }
  return cost * 100;
}
// --diff: pixel match of two same-size images
export const DIFF_TOL = 16;
export function pixelDiff(a, b, tol = DIFF_TOL) {
  const n = a.w * a.h, d = new Uint8ClampedArray(n * 4); let ok = 0;
  for (let i = 0; i < n * 4; i += 4) {
    let worst = 0;
    for (let c = 0; c < 3; c++) { const v = Math.abs(a.d[i + c] - b.d[i + c]); if (v > worst) worst = v; d[i + c] = (a.d[i + c] + b.d[i + c]) / 4 + v * 4; }
    d[i + 3] = 255; if (worst <= tol) ok++;
  }
  return { match: Math.round((ok / (n || 1)) * 1000) / 10, panel: { w: a.w, h: a.h, d } };
}
// Structure: pixels alone pass a black page on a dark, sparse hero
const STRUCT = { reach: 2, flat: 0.004 };
export function edgeMap(img) {
  const { w, h } = img, n = w * h, Y = new Float32Array(n), B = new Float32Array(n), g = new Float32Array(n), m = new Float32Array(n), t = new Float32Array(n);
  for (let i = 0; i < n; i++) Y[i] = (0.2126 * img.d[i * 4] + 0.7152 * img.d[i * 4 + 1] + 0.0722 * img.d[i * 4 + 2]) / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0, k = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Yy = y + dy; if (X >= 0 && Yy >= 0 && X < w && Yy < h) { v += Y[Yy * w + X]; k++; } } B[y * w + x] = v / k; }
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; g[i] = Math.hypot(B[i + 1] - B[i - 1], B[i + w] - B[i - w]); }
  const r = STRUCT.reach;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let k = Math.max(0, x - r); k <= Math.min(w - 1, x + r); k++) v = Math.max(v, g[y * w + k]); t[y * w + x] = v; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let k = Math.max(0, y - r); k <= Math.min(h - 1, y + r); k++) v = Math.max(v, t[k * w + x]); m[y * w + x] = v; }
  return { w, h, g, m };
}
export function structureMatch(ea, eb, x, y, w, h) {
  let sa = 0, sb = 0, ra = 0, rb = 0;
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { const k = j * ea.w + i, a = ea.g[k], b = eb.g[k]; sa += a; sb += b; ra += Math.min(a, eb.m[k]); rb += Math.min(b, ea.m[k]); }
  if (sa < w * h * STRUCT.flat && sb < w * h * STRUCT.flat) return null;
  const rec = sa ? ra / sa : 0, pre = sb ? rb / sb : 0;
  return rec + pre ? Math.round(2000 * rec * pre / (rec + pre)) / 10 : 0;
}
// --diff regions: a 3 by 3 grid; DIFF: the dark tolerance, the edge weight
export const DONE = { overall: 92, region: 85, structure: 60 }, DIFF = { dark: 8, darkLum: 64, edge: 4, at: 0.02 };
const REGION_NAMES = ['top left', 'top', 'top right', 'middle left', 'middle', 'middle right', 'bottom left', 'bottom', 'bottom right'];
export function regionMatch(a, b, tol = DIFF_TOL) {
  const xs = [0, 1, 2, 3].map((i) => Math.round(a.w * i / 3)), ys = [0, 1, 2, 3].map((i) => Math.round(a.h * i / 3)), out = [], ea = edgeMap(a), eb = edgeMap(b);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const x = xs[c], y = ys[r], w = xs[c + 1] - x, h = ys[r + 1] - y; let ok = 0, n = 0;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { const p = j * a.w + i, k = p * 4, t = 0.2126 * a.d[k] + 0.7152 * a.d[k + 1] + 0.0722 * a.d[k + 2] < DIFF.darkLum ? DIFF.dark : tol, q = Math.max(ea.m[p], eb.m[p]) > DIFF.at ? DIFF.edge : 1; n += q; if (Math.abs(a.d[k] - b.d[k]) <= t && Math.abs(a.d[k + 1] - b.d[k + 1]) <= t && Math.abs(a.d[k + 2] - b.d[k + 2]) <= t) ok += q; }
    out.push({ name: REGION_NAMES[r * 3 + c], x, y, w, h, match: Math.round((ok / (n || 1)) * 1000) / 10, structure: structureMatch(ea, eb, x, y, w, h) });
  }
  return out;
}
// How far a region is from done, both numbers against their limits
export const regionScore = (r) => Math.min(r.match - DONE.region, (r.structure ?? 100) - DONE.structure);
export const MAX_SKIP = 3; // not scored: picture or floor-raised regions
export function markSkips(regions, rects) {
  for (const r of regions) {
    const share = (kind) => { const m = new Uint8Array(r.w * r.h); let n = 0;
      for (const b of rects.filter((q) => q.kind === kind)) { const x0 = Math.max(r.x, Math.round(b.x)), x1 = Math.min(r.x + r.w, Math.round(b.x + b.w)), y0 = Math.max(r.y, Math.round(b.y)), y1 = Math.min(r.y + r.h, Math.round(b.y + b.h));
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y - r.y) * r.w + x - r.x; if (!m[i]) { m[i] = 1; n++; } } }
      return n / (r.w * r.h || 1); };
    const skip = share('picture') >= 0.5 ? 'picture' : share('floor-raised') >= 0.5 ? 'floor-raised' : null; if (skip) r.skip = skip;
  }
  return regions;
}
// The pixel match over the scored regions only
export function scoredMatch(regions) { const s = regions.filter((r) => !r.skip), a = s.reduce((t, r) => t + r.w * r.h, 0); return a ? Math.round(s.reduce((t, r) => t + r.match * r.w * r.h, 0) / a * 10) / 10 : 0; }
// The lowest and the mean structure among the scored regions
const sv = (regions) => regions.filter((r) => !r.skip && r.structure != null).map((r) => r.structure);
export const minStructure = (regions) => { const v = sv(regions); return v.length ? Math.min(...v) : null; };
export const meanStructure = (regions) => { const v = sv(regions); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length * 10) / 10 : null; };
// The done line: done, or what is short
export function doneLine(match, regions) {
  const all = regions; regions = all.filter((r) => !r.skip); const skipped = all.length - regions.length;
  const low = regions.filter((r) => r.match < DONE.region).sort((p, q) => p.match - q.match), flat = regions.filter((r) => r.structure != null && r.structure < DONE.structure).sort((p, q) => p.structure - q.structure), short = [];
  if (skipped > MAX_SKIP) short.push(`${skipped} regions not scored, at most ${MAX_SKIP} of 9`);
  if (match < DONE.overall) short.push(`overall ${match}% (needs ${DONE.overall}%)`);
  if (low.length) short.push(`${low.length} region${low.length > 1 ? 's' : ''} under ${DONE.region}% pixels, worst ${low.slice(0, 3).map((r) => `${r.name} ${r.match}%`).join(', ')}`);
  if (flat.length) short.push(`${flat.length} region${flat.length > 1 ? 's' : ''} under ${DONE.structure} structure (edges not where the hero has them), worst ${flat.slice(0, 3).map((r) => `${r.name} ${r.structure}`).join(', ')}`);
  const left = skipped ? ` (${skipped} region${skipped > 1 ? 's' : ''} not scored: ${all.filter((r) => r.skip).map((r) => `${r.name} ${r.skip}`).join(', ')})` : '';
  return short.length ? `Not done: ${short.join('; ')}. Fix the worst regions first (regions.jpg).` : `Done: overall >= ${DONE.overall}%, every region >= ${DONE.region}% pixels and >= ${DONE.structure} structure${left}`;
}
// A phone status bar row: in the top 6 to 50 CSS px
export function statusBarRow(img, k = 1) {
  const { w } = img, y0 = Math.round(6 * k), y1 = Math.min(img.h, Math.round(50 * k)); if (y1 - y0 < 8 || w < 100) return false;
  const II = lumIntegral(img), W1 = img.w + 1, r = Math.max(3, Math.round(7 * k)), col = new Uint8Array(w), inkRows = new Set();
  const mean = (x, y) => { const ax = Math.max(0, x - r), bx = Math.min(w, x + r + 1), ay = Math.max(0, y - r), by = Math.min(img.h, y + r + 1); return (II.s[by * W1 + bx] - II.s[ay * W1 + bx] - II.s[by * W1 + ax] + II.s[ay * W1 + ax]) / ((bx - ax) * (by - ay)); };
  const ls = []; for (let y = y0; y < y1; y++) for (let x = 0; x < w; x += 3) ls.push(lumOf(rgbAt(img, x, y))); ls.sort((a, b) => a - b); const md = ls[ls.length >> 1];
  for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) { const v = lumOf(rgbAt(img, x, y)); if (Math.abs(v - mean(x, y)) > 40 && Math.abs(v - md) > 40) { col[x] = 1; if (x < w * 0.36) inkRows.add(y); } }
  const runs = (a, b) => { let n = 0, on = false, first = -1, last = -1; for (let x = Math.round(a); x < Math.round(b); x++) { if (col[x] && !on) n++; on = !!col[x]; if (col[x]) { if (first < 0) first = x; last = x; } } return { n, first, last }; };
  const L = runs(w * 0.03, w * 0.36), R = runs(w * 0.62, w * 0.97), tall = inkRows.size;
  const span = (g) => g.last - g.first + 1;
  return L.n >= 1 && L.n <= 4 && L.first < w * 0.2 && span(L) >= w * 0.06 && span(L) <= w * 0.22 && !col[Math.round(w * 0.37)] && R.n >= 1 && span(R) >= w * 0.08 && span(R) <= w * 0.32 && tall >= 5 * k && tall <= 20 * k;
}
export const COPY = { min: 64, bits: 6, flat: 16 }; // copied art: dHash (9x8 means) of same-size blocks
export function lumIntegral(img) {
  const { w, h } = img, W1 = w + 1, s = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { const i = (y * w + x) * 4; row += 0.2126 * img.d[i] + 0.7152 * img.d[i + 1] + 0.0722 * img.d[i + 2]; s[(y + 1) * W1 + x + 1] = s[y * W1 + x + 1] + row; } }
  return { w, h, s };
}
export function dhash(II, x, y, bw, bh) {
  const W1 = II.w + 1, m = new Float64Array(72), bits = new Uint8Array(64);
  for (let j = 0; j < 8; j++) { const ay = Math.round(y + bh * j / 8), by = Math.max(ay + 1, Math.round(y + bh * (j + 1) / 8));
    for (let i = 0; i < 9; i++) { const ax = Math.round(x + bw * i / 9), bx = Math.max(ax + 1, Math.round(x + bw * (i + 1) / 9)); m[j * 9 + i] = (II.s[by * W1 + bx] - II.s[ay * W1 + bx] - II.s[by * W1 + ax] + II.s[ay * W1 + ax]) / ((bx - ax) * (by - ay)); } }
  let lo = Infinity, hi = -Infinity; for (const v of m) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) bits[j * 8 + i] = m[j * 9 + i] < m[j * 9 + i + 1] - 1 ? 1 : 0; // 1 grey level of slack: flat neighbours read 0 on both sides
  return { bits, range: hi - lo };
}
export const hamming = (a, b) => { let n = 0; for (let i = 0; i < 64; i++) n += a[i] !== b[i]; return n; };
// The closest same-size block of src.img to a hash
export function findBlock(hash, bw, bh, src) {
  let L = 0; while (L < 4 && Math.min(bw, bh) / 2 ** (L + 1) >= 24) L++;
  src.lv = src.lv || []; if (!src.lv[L]) { const f = 2 ** L; src.lv[L] = { f, II: lumIntegral(L ? resize(src.img, Math.max(1, Math.round(src.img.w / f)), Math.max(1, Math.round(src.img.h / f))) : src.img) }; }
  const { f, II } = src.lv[L], w = bw / f, h = bh / f, step = Math.max(1, Math.floor(Math.min(w, h) / 24)); if (w > II.w || h > II.h || w < 9 || h < 8) return null;
  let best = null;
  for (let y = 0; y + h <= II.h; y += step) for (let x = 0; x + w <= II.w; x += step) { const g = dhash(II, x, y, w, h); if (g.range < COPY.flat) continue; const d = hamming(hash.bits, g.bits); if (d <= COPY.bits && (!best || d < best.d)) best = { x: x * f, y: y * f, d }; }
  return best;
}
// arts: [{ sel, w, h, img }]; sources: [{ ref, img, c, nat }]
export function copiedArt(arts, sources) {
  const hits = [];
  for (const a of arts) {
    if (!a.img) continue; const h = dhash(lumIntegral(a.img), 0, 0, a.img.w, a.img.h); if (h.range < COPY.flat) continue;
    for (const s of sources) { const m = findBlock(h, a.w * s.c, a.h * s.c, s); if (m) { hits.push({ sel: a.sel, ref: s.ref, at: [Math.round(m.x * s.nat), Math.round(m.y * s.nat)], bits: m.d }); break; } }
  }
  return hits;
}
export const imageryFar = (d, h) => Math.max(d, h) >= 0.12 && Math.min(d, h) < Math.max(d, h) * FAR.imagery;
const ratioFar = (v, lim) => v != null && (v > lim || v < 1 / lim);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// Draft against hero: scores 0 to 1 per axis
export function compare(d, h, { draftType = null, heroType = null, pixel = null } = {}) {
  const layout = Math.max(0, (ssim(d.lum, h.lum, 0.002) + ssim(d.edge, h.edge, 0.0005)) / 2, pixel == null ? 0 : (pixel - 50) / 50); // the --diff pixel match floors it
  const paletteDE_ = paletteDE(d.palette, h.palette);
  const typeRatio_ = draftType && heroType ? draftType / heroType : null;
  const top = Math.max(d.photo, h.photo), imageryGap = Math.abs(d.photo - h.photo);
  const densityRatio = (d.ink + 0.002) / (h.ink + 0.002);
  const byRatio = (v, lim) => clamp01(1 - Math.abs(Math.log(v)) / (2 * Math.log(lim)));
  const scores = { layout: r2(clamp01(layout)), palette: r2(clamp01(1 - paletteDE_ / (2 * FAR.palette))), type: typeRatio_ == null ? null : r2(byRatio(typeRatio_, FAR.type)),
    imagery: r2(clamp01(1 - imageryGap / (top >= 0.12 ? top : 0.24))), density: r2(byRatio(densityRatio, FAR.density)) };
  const far = [layout < FAR.layout && 'layout', paletteDE_ > FAR.palette && 'palette', ratioFar(typeRatio_, FAR.type) && 'type', imageryFar(d.photo, h.photo) && 'imagery', ratioFar(densityRatio, FAR.density) && 'density'].filter(Boolean);
  return { scores, far, raw: { layout: r2(layout), pixel, paletteDE: r2(paletteDE_), typeRatio: r2(typeRatio_), imageryDraft: r2(d.photo), imageryHero: r2(h.photo), densityRatio: r2(densityRatio) } };
}
export function axisLines(scores, far, raw, detail = {}) {
  const f = (a) => (far.includes(a) ? 'FAR ' : 'ok  '), dh = detail.hero || {}, dd = detail.draft || {}, sc = (a) => String(scores[a]).padEnd(5);
  return [
    `${f('layout')}layout   ${sc('layout')} where light, dark and busy areas sit (similarity ${raw.layout}${raw.pixel != null ? `, pixel match ${raw.pixel}%` : ''}; far under ${FAR.layout})`,
    `${f('palette')}palette  ${sc('palette')} dominant colours (dE ${raw.paletteDE}; far over ${FAR.palette})`,
    scores.type == null ? `ok  type     -     not measured: ${dh.typeRatio ? 'needs the page, not a screenshot' : 'pass --hero-type 56/16 or tokens with typeScale'}`
      : `${f('type')}type     ${sc('type')} largest over body text px (draft ${dd.typeRatio} vs hero ${dh.typeRatio}, ${raw.typeRatio}x; far past ${FAR.type}x)`,
    `${f('imagery')}imagery  ${sc('imagery')} photo share of the first screen (draft ${raw.imageryDraft} vs hero ${raw.imageryHero}; far when one has photos and the other under half as much)`,
    `${f('density')}density  ${sc('density')} edges outside photos (draft ${dd.ink} vs hero ${dh.ink}, ${raw.densityRatio}x; far past ${FAR.density}x)`,
  ];
}

// The draft's own numbers, in the page
function DOM() {
  const W = innerWidth, H = innerHeight, area = (r) => Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0));
  const S = 24, cells = new Uint8Array(S * S), mark = (r) => { for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const x = (i + 0.5) * W / S, y = (j + 0.5) * H / S; if (x >= r.left && x < r.right && y >= r.top && y < r.bottom) cells[j * S + i] = 1; } };
  for (const e of document.body.querySelectorAll('*')) {
    const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || +cs.opacity < 0.1) continue;
    const pic = e.matches('img,video,canvas') || (e.matches('svg') && e.querySelector('image')) || /url\(/.test(cs.backgroundImage); if (!pic) continue;
    const r = e.getBoundingClientRect(); if (area(r) > 64) mark(r);
  }
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), els = new Map(), rg = document.createRange();
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { const t = n.nodeValue.trim(), el = n.parentElement; if (!t || !el || el.closest('script,style,noscript,[hidden],[aria-hidden="true"]')) continue; rg.selectNodeContents(n); const r = rg.getBoundingClientRect(); if (!area(r)) continue; const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue; els.set(el, { px: parseFloat(cs.fontSize), len: (els.get(el)?.len || 0) + t.length }); }
  const T = [...els.values()], byLen = new Map(); for (const e of T) byLen.set(e.px, (byLen.get(e.px) || 0) + e.len);
  const body = [...byLen.entries()].filter(([px]) => px >= 12).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null, largest = T.reduce((m, e) => Math.max(m, e.px), 0) || null;
  return { imageShare: cells.reduce((s, v) => s + v, 0) / (S * S), bodyPx: body, largestPx: largest, typeRatio: body && largest ? largest / body : null, textPer100k: Math.round(T.length / (W * H) * 1e6) / 10 };
}
// The page part a ref pairs with: sel:<css>, else data-part
function PART({ part, selector }) {
  if (selector) return document.querySelector(selector) ? selector : null;
  const p = part.toLowerCase().trim(), slug = p.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), mark = (e) => { e.setAttribute('data-gb-part', slug); return `[data-gb-part="${slug}"]`; };
  for (const q of [`[data-part="${slug}" i]`, `[data-part="${p}" i]`, `[data-section="${slug}" i]`, `[data-section="${p}" i]`, `#${CSS.escape(slug)}`]) { const e = document.querySelector(q); if (e) return mark(e); }
  const land = { header: 'header,[role=banner]', nav: 'nav,[role=navigation]', footer: 'footer,[role=contentinfo]', main: 'main,[role=main]', sidebar: 'aside,[role=complementary]', aside: 'aside' }[slug];
  if (land && document.querySelector(land)) return mark(document.querySelector(land));
  const boxes = [...document.querySelectorAll('section,article,header,footer,aside,nav,main,[role=region],[aria-label]')].filter((e) => e.getBoundingClientRect().height > 40);
  const hit = boxes.find((e) => (e.getAttribute('aria-label') || '').toLowerCase().includes(p)) || boxes.find((e) => (e.querySelector('h1,h2,h3')?.textContent || '').toLowerCase().includes(p));
  if (hit) return mark(hit);
  if (slug === 'hero') { const e = boxes.find((b) => b.getBoundingClientRect().top < 120 && b.tagName !== 'HEADER' && b.tagName !== 'NAV'); return e ? mark(e) : 'viewport'; }
  return null;
}
// --diff, in the page: the boxes left out of done
function COVERS({ sel }) {
  const root = sel ? document.querySelector(sel) : null, o = root ? root.getBoundingClientRect() : { left: 0, top: 0 }, out = [];
  for (const [kind, q] of [['picture', 'img,picture,video,canvas,[data-sample-image]'], ['floor-raised', '[data-floor-raised]']]) for (const e of (root || document.body).querySelectorAll(q)) {
    const cs = getComputedStyle(e), r = e.getBoundingClientRect(); if (cs.visibility === 'hidden' || +cs.opacity < 0.1 || r.width < 1 || r.height < 1) continue;
    out.push({ kind, x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height });
  }
  return out;
}
// --diff, in the page: does the top 48px show a time?
function TIME() {
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), rg = document.createRange();
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (!/(^|\D)([01]?\d|2[0-3])[:.][0-5]\d(\D|$)/.test(n.nodeValue)) continue; rg.selectNodeContents(n); const r = rg.getBoundingClientRect(); if (r.width >= 1 && r.top < 48 && r.bottom > 0) return true; }
  return false;
}
// A part's box in CSS px, or null
function BOX(sel) { const e = document.querySelector(sel), r = e?.getBoundingClientRect(); return r && r.width >= 1 && r.height >= 1 ? { w: Math.round(r.width), h: Math.round(r.height) } : null; }
// Copied art, in the page: every picture
function ARTS({ min }) {
  const name = (e) => { const p = []; for (let a = e; a && a !== document.body && p.length < 3; a = a.parentElement) { const c = (a.getAttribute('class') || '').trim(); p.unshift(a.localName + (a.id ? '#' + a.id : '') + (c ? '.' + c.split(/\s+/)[0] : '')); if (a.id) break; } return p.join(' > '); };
  const out = [];
  for (const e of document.body.querySelectorAll('*')) {
    if (e.closest('svg') && e.localName !== 'svg') continue; const cs = getComputedStyle(e);
    const art = e.matches('img,canvas,video') || (e.localName === 'svg' && !!e.querySelector('path,circle,rect,ellipse,polygon,polyline,line,image,use')) || /url\(/.test(cs.backgroundImage); if (!art) continue;
    const r = e.getBoundingClientRect(); let op = 1; for (let a = e; a && a !== document.documentElement; a = a.parentElement) op *= +getComputedStyle(a).opacity;
    if (r.width < min || r.height < min || cs.visibility === 'hidden' || op < 0.1) continue;
    out.push({ e, sel: name(e), w: Math.round(r.width), h: Math.round(r.height) });
  }
  return out.sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 24).map((a, i) => { a.e.setAttribute('data-gb-art', String(i)); return { i, sel: a.sel, w: a.w, h: a.h }; });
}
// In a blank page: decode an image to RGBA
async function DECODE({ src, max }) {
  const img = new Image(); img.src = src; await img.decode(); const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k)), c = Object.assign(document.createElement('canvas'), { width: w, height: h }), x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data; let s = ''; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
  return { w, h, b64: btoa(s), nw: img.naturalWidth, nh: img.naturalHeight };
}
async function SHEET({ rows, foot }) {
  const load = async (r) => { if (!r.src) return null; const i = new Image(); i.src = r.src; await i.decode(); if (r.crop) { const c = Object.assign(document.createElement('canvas'), { width: r.crop.w, height: r.crop.h }); c.getContext('2d').drawImage(i, -r.crop.x, -r.crop.y); return c; } return i; };
  const pad = 24, gap = 24, lab = 30, out = [];
  const dims = (i) => (i ? [i.naturalWidth || i.width, i.naturalHeight || i.height] : null);
  for (const row of rows) {
    const a = await load(row.a), b = await load(row.b), da = dims(a), db = dims(b), ar = (d) => (d ? d[0] / d[1] : 0.6);
    let H = Math.min(row.h, Math.max(200, da?.[1] ?? row.h)); H = Math.max(120, Math.min(H, Math.floor((1800 - gap) / (ar(da) + ar(db)))));
    out.push({ ...row, h: H, a, b, wa: Math.round(ar(da) * H), wb: Math.round(ar(db) * H) });
  }
  const m = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d'); m.font = '600 18px system-ui,sans-serif';
  const W = Math.max(...out.map((r) => r.wa + gap + Math.max(r.wb, m.measureText(r.labelB).width)), ...foot.map((l) => l.length * 9.6)) + pad * 2, Ht = out.reduce((s, r) => s + r.h + lab + gap, pad) + foot.length * 24 + pad;
  const c = Object.assign(document.createElement('canvas'), { width: W, height: Ht }), x = c.getContext('2d'); x.fillStyle = '#d9dadc'; x.fillRect(0, 0, W, Ht); x.font = '600 18px system-ui,sans-serif'; x.fillStyle = '#1b1b1b';
  let y = pad;
  for (const r of out) { x.fillText(r.labelA, pad, y + 20); x.fillText(r.labelB, pad + r.wa + gap, y + 20); y += lab;
    if (r.a) x.drawImage(r.a, pad, y, r.wa, r.h); else { x.strokeRect(pad, y, r.wa, r.h); x.fillText(r.missing || 'not found', pad + 12, y + 30); }
    if (r.b) x.drawImage(r.b, pad + r.wa + gap, y, r.wb, r.h); y += r.h + gap; }
  x.font = '500 16px ui-monospace,monospace'; for (const l of foot) { x.fillText(l, pad, y + 16); y += 24; }
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}
// In a blank page: the --diff sheet
async function DIFFSHEET({ panels, labels, foot }) {
  const pad = 24, gap = 24, lab = 30, W = panels.reduce((s, p) => s + p.w, 0) + gap * (panels.length - 1) + pad * 2, H = Math.max(...panels.map((p) => p.h)) + lab + pad * 2 + 24;
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H }), x = c.getContext('2d'); x.fillStyle = '#d9dadc'; x.fillRect(0, 0, W, H); x.fillStyle = '#1b1b1b'; x.font = '600 18px system-ui,sans-serif';
  let left = pad;
  for (let i = 0; i < panels.length; i++) {
    const p = panels[i], raw = atob(p.b64), d = new Uint8ClampedArray(raw.length); for (let k = 0; k < raw.length; k++) d[k] = raw.charCodeAt(k);
    x.fillText(labels[i], left, pad + 20); x.putImageData(new ImageData(d, p.w, p.h), left, pad + lab); left += p.w + gap;
  }
  x.font = '500 16px ui-monospace,monospace'; x.fillText(foot, pad, H - pad + 4);
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}

// In a blank page: one box of an image at its own pixels, as PNG
async function CROPPNG({ src, box }) {
  const img = new Image(); img.src = src; await img.decode(); const b = box || { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
  const c = Object.assign(document.createElement('canvas'), { width: b.w, height: b.h }); c.getContext('2d').drawImage(img, -b.x, -b.y);
  return c.toDataURL('image/png').split(',')[1];
}
// In a blank page: regions.jpg
async function REGIONSHEET({ rows }) {
  const pad = 24, gap = 24, lab = 30, toCanvas = (p) => { const raw = atob(p.b64), d = new Uint8ClampedArray(raw.length); for (let k = 0; k < raw.length; k++) d[k] = raw.charCodeAt(k); const c = Object.assign(document.createElement('canvas'), { width: p.w, height: p.h }); c.getContext('2d').putImageData(new ImageData(d, p.w, p.h), 0, 0); return c; };
  const R = rows.map((r) => { const z = Math.max(1, Math.min(3, 820 / r.a.w, 640 / r.a.h)); return { ...r, z, W: Math.round(r.a.w * z), H: Math.round(r.a.h * z) }; });
  const W = Math.max(...R.map((r) => r.W * 2 + gap)) + pad * 2, H = R.reduce((s, r) => s + r.H + lab + gap, pad) + pad;
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H }), x = c.getContext('2d'); x.fillStyle = '#d9dadc'; x.fillRect(0, 0, W, H); x.imageSmoothingEnabled = false;
  let y = pad;
  for (const r of R) { x.fillStyle = '#1b1b1b'; x.font = '600 18px system-ui,sans-serif'; x.fillText(r.label, pad, y + 20); y += lab; x.drawImage(toCanvas(r.a), pad, y, r.W, r.H); x.drawImage(toCanvas(r.b), pad + r.W + gap, y, r.W, r.H); y += r.H + gap; }
  return c.toDataURL('image/jpeg', 0.88).split(',')[1];
}

const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif', svg: 'image/svg+xml' };
// An image as a data URL, in memory: http fetched, file
export async function imageData(src) {
  if (/^https?:/i.test(src)) {
    const r = await fetch(src, { signal: AbortSignal.timeout(20000), headers: { accept: 'image/*' } }); if (!r.ok) throw new Error(`HTTP ${r.status} for ${src}`);
    const b = Buffer.from(await r.arrayBuffer()); if (b.length > 20 << 20) throw new Error(`over 20 MB: ${src}`);
    const ct = (r.headers.get('content-type') || '').split(';')[0].trim(), ext = new URL(src).pathname.split('.').pop().toLowerCase();
    return `data:${/^image\//.test(ct) ? ct : MIME[ext] || 'image/jpeg'};base64,${b.toString('base64')}`;
  }
  const p = /^file:/i.test(src) ? fileURLToPath(src) : resolve(src), ext = p.split('.').pop().toLowerCase();
  return `data:${MIME[ext] || 'image/png'};base64,${readFileSync(p).toString('base64')}`;
}
// "part=url,part=sel:<css>|url" or a .json file of [{ part
export function parseRefs(v) {
  if (!v) return [];
  if (/\.json$/i.test(v) && existsSync(v)) return JSON.parse(readFileSync(v, 'utf8')).map((r) => ({ part: String(r.part), selector: r.selector || null, url: String(r.url) }));
  return v.split(/,(?=\s*[^,=/:|]+=\s*(?:sel:|https?:|file:|[.~/]|[\w-]+\.(?:jpe?g|png|webp|avif|gif)))/i).map((s) => s.trim()).filter(Boolean).map((s) => {
    const i = s.indexOf('='), part = s.slice(0, i).trim(), rest = s.slice(i + 1).trim(), m = /^sel:(.*)\|([^|]+)$/.exec(rest);
    return m ? { part, selector: m[1].trim(), url: m[2].trim() } : { part, selector: null, url: rest };
  });
}
// A typeScale such as "56/32/20/16/14"
export function typeRatio(v) {
  const n = String(v ?? '').match(/\d+(?:\.\d+)?/g)?.map(Number).filter((x) => x > 0) ?? [];
  if (n.length === 1) return n[0] >= 1 && n[0] <= 12 ? n[0] : null;
  const body = n.filter((x) => x >= 12).sort((a, b) => Math.abs(a - 16) - Math.abs(b - 16))[0];
  return n.length && body ? Math.max(...n) / body : null;
}
const sizeOf = (s) => { const m = /^(\d{3,4})x(\d{3,4})$/.exec(String(s).trim()); return m ? [+m[1], +m[2]] : null; };

async function main() {
  const args = process.argv.slice(2), opt = (n) => { const i = args.indexOf('--' + n); return i < 0 ? null : args.splice(i, 2)[1]; }, flag = (n) => { const i = args.indexOf('--' + n); return i < 0 ? false : (args.splice(i, 1), true); };
  const heroArg = opt('hero'), heroTypeArg = opt('hero-type'), refsArg = opt('refs'), vpArg = opt('viewport'), tp = opt('tokens'), heroCropArg = opt('hero-crop'), draftImage = opt('draft-image'), asJson = flag('json'), diff = flag('diff'), noTrim = flag('no-trim');
  const part = opt('part'), refArg = opt('ref'), refCropArg = opt('ref-crop'), selArg = opt('sel'), hero = part ? refArg : heroArg, cropArg = part ? refCropArg : heroCropArg;
  const slug = (v) => String(v).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'part', cf = part ? '--ref-crop' : '--hero-crop';
  const out = join(resolve(opt('out') || join(process.env.TMPDIR || '/tmp', 'gb', 'fidelity')), part ? `part-${slug(part)}` : ''), target = args[0];
  const usage = (why) => { if (why) console.error(why); console.error('usage: node gb-fidelity.mjs <draft.html|url> --hero <image> [--diff] [--refs "part=url,part=sel:<css>|url"] [--tokens t.json] [--hero-type 56/16] [--hero-crop x,y,w,h|none]\n   or: node gb-fidelity.mjs <draft.html|url> --diff --part <name> --ref <image> [--ref-crop x,y,w,h] --sel "<css>"\n   or: --draft-image <png> in place of the page; all take [--viewport 390x844] [--no-trim] [--out dir] [--json]'); process.exit(2); };
  if (!hero || (!target && !draftImage) || [heroArg, heroTypeArg, refsArg, vpArg, tp, heroCropArg, draftImage, part, refArg, refCropArg, selArg].some((v) => v === undefined || /^--/.test(v ?? ''))) usage();
  if (part != null && (!diff || !refArg || !selArg || !target || draftImage)) usage('--part needs --diff, --ref <image>, --sel "<css>" and the draft page');
  if (vpArg && !sizeOf(vpArg)) usage(`--viewport takes WIDTHxHEIGHT, for example 390x844 (got "${vpArg}")`);
  const tokens = tp ? JSON.parse(readFileSync(tp, 'utf8')) : (() => { try { return target && !/^https?:/.test(target) ? JSON.parse(readFileSync(join(dirname(target.startsWith('file:') ? fileURLToPath(target.split('?')[0]) : resolve(target.split('?')[0])), 'tokens.json'), 'utf8')) : null; } catch { return null; } })();
  const refs = parseRefs(refsArg), t0 = Date.now(), req = createRequire(import.meta.url), gbDir = join(process.env.TMPDIR || '/tmp', 'gb');
  const cannot = (e) => { try { mkdirSync(gbDir, { recursive: true }); writeFileSync(join(gbDir, '.gb-norender'), `${new Date().toISOString()} ${String(e?.message || e).split('\n')[0]}\n`); } catch {} console.error(`This machine cannot render: ${String(e?.message || e).split('\n')[0]}`); process.exit(3); };
  let pw; try { try { pw = req('playwright'); } catch { pw = createRequire(join(execSync('npm root -g').toString().trim(), '_'))('playwright'); } } catch (e) { cannot(e); }
  const browser = guard(await pw.chromium.launch().catch(cannot)), blank = await browser.newPage();
  const decode = async (src, max = 1600) => { const r = await blank.evaluate(DECODE, { src, max }); return { w: r.w, h: r.h, d: new Uint8ClampedArray(Buffer.from(r.b64, 'base64')), nw: r.nw, nh: r.nh }; };
  let heroSrc; try { heroSrc = await imageData(hero); } catch (e) { await browser.close(); console.log(`${part ? `Part ${part}: FAIL ref-unreadable` : 'FAIL hero-unreadable'}: ${String(e.message || e).split('\n')[0]}`); process.exit(0); }
  let heroImg = await decode(heroSrc, 16000), heroCrop = null, cropWhy = 'whole image';
  if (cropArg && cropArg !== 'none') { const n = cropArg.split(',').map(Number); if (n.length !== 4 || n.some((v) => !(v >= 0))) usage(`${cf} takes x,y,w,h in the image px (or fractions of it), or none`); const k = n.every((v) => v <= 1) ? [heroImg.w, heroImg.h] : [heroImg.w / heroImg.nw, heroImg.h / heroImg.nh]; heroCrop = { x: n[0] * k[0], y: n[1] * k[1], w: n[2] * k[0], h: n[3] * k[1] }; cropWhy = cf; }
  else if (cropArg !== 'none') { const s = findScreen(heroImg.w > 1600 ? resize(heroImg, 1600, Math.round(heroImg.h * 1600 / heroImg.w)) : heroImg); if (s) { const k = heroImg.w > 1600 ? heroImg.w / 1600 : 1; heroCrop = { x: s.x * k, y: s.y * k, w: s.w * k, h: s.h * k }; cropWhy = `device screen found (pass ${cf} none to keep the whole image)`; } }
  const heroNat = heroImg.nw / heroImg.w;
  // Source chrome is not design
  let trimmed = noTrim ? 'off (--no-trim)' : cropWhy === cf ? `the ${cf} box` : cropWhy.startsWith('device') ? 'device bezel (cut to the screen)' : cropArg === 'none' ? `nothing (${cf} none)` : 'nothing (no credit bar or backdrop found)', trim = [];
  if (!noTrim && !heroCrop && cropArg !== 'none') { const t = trimChrome(heroImg, heroNat); if (t.box) { heroCrop = t.box; trim = t.cut; trimmed = t.cut.join('; '); cropWhy = `trimmed ${trimmed}`; } }
  if (heroCrop) heroImg = crop(heroImg, heroCrop.x, heroCrop.y, heroCrop.w, heroCrop.h);
  mkdirSync(out, { recursive: true }); const natBox = heroCrop ? Object.fromEntries(Object.entries(heroCrop).map(([q, v]) => [q, Math.round(v * heroNat)])) : null, trimmedFile = join(out, part ? 'ref-trimmed.png' : 'hero-trimmed.png');
  writeFileSync(trimmedFile, Buffer.from(await blank.evaluate(CROPPNG, { src: heroSrc, box: natBox }), 'base64'));
  const cursors = noTrim ? [] : findCursors(heroImg.w > 1600 ? resize(heroImg, 1600, Math.round(heroImg.h * 1600 / heroImg.w)) : heroImg).map((c) => { const q = (heroImg.w > 1600 ? heroImg.w / 1600 : 1) * heroNat; return { x: Math.round(c.x * q), y: Math.round(c.y * q), w: Math.round(c.w * q), h: Math.round(c.h * q) }; });
  const trimLine = `trimmed: ${trimmed}${cursors.map((c) => `; cursor at ${c.x},${c.y} (leave it out)`).join('')}. Copy from ${trimmedFile} (${natBox ? `${natBox.w}x${natBox.h}` : `${heroImg.nw}x${heroImg.nh}`} px; local only, never upload it).`;
  // The viewport: --viewport
  const ar = heroImg.w / heroImg.h, natW = heroImg.w * heroNat, phone = cropWhy.startsWith('device') || (ar < 0.6 && !(natW >= 1000 && (ar < 0.42 || ar > 0.5)));
  const tvs = (Array.isArray(tokens?.viewports) ? tokens.viewports : [tokens?.viewports]).flatMap((x) => String(x || '').split(',')).map(sizeOf).filter(Boolean).sort((a, b) => a[0] - b[0]);
  const vp = vpArg ? sizeOf(vpArg) : tvs.length ? (phone ? tvs[0] : tvs[tvs.length - 1]) : phone ? [390, 844] : [1440, 900];
  if (diff) {
    const [vw, vh] = vp, P = part ? `Part ${part}: ` : '';
    let dpr = Math.max(1, Math.min(3, Math.round(heroImg.w / vw))), shotSrc, covers = [], hasTime = null, box = null;
    const open = async (d) => {
      const dp = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: d }), [fp, q] = target.split('?'), u = new URL(/^https?:|^file:/.test(target) ? target : pathToFileURL(resolve(fp)).href + (q ? '?' + q : '')); u.searchParams.set('shot', '1');
      try { await dp.goto(u.href, { waitUntil: 'load', timeout: 30000 }); await dp.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {}); } catch (e) { await browser.close(); console.log(`${P}FAIL draft-unreadable: ${String(e.message || e).split('\n')[0]}`); process.exit(0); }
      await dp.evaluate(() => document.fonts?.ready).catch(() => {}); await dp.waitForTimeout(300); return dp;
    };
    if (draftImage) shotSrc = await imageData(draftImage);
    else if (part) {
      let dp = await open(1); box = await dp.evaluate(BOX, selArg).catch(() => null);
      if (!box) { await browser.close(); writeFileSync(join(out, 'diff.json'), JSON.stringify({ v: 1, tool: 'gb-fidelity', mode: 'part', part, sel: selArg, ref: hero, done: false, error: 'no element matches the selector' }, null, 1)); console.log(`${P}FAIL part-missing: no element matches "${selArg}" at ${vw}x${vh}; mark the part's box and pass its selector with --sel`); return; }
      dpr = Math.max(1, Math.min(3, Math.round(heroImg.w / box.w))); if (dpr !== 1) { await dp.close(); dp = await open(dpr); }
      const loc = dp.locator(selArg).first(); await loc.scrollIntoViewIfNeeded().catch(() => {});
      covers = await dp.evaluate(COVERS, { sel: selArg }); shotSrc = 'data:image/png;base64,' + (await loc.screenshot({ type: 'png', timeout: 10000 })).toString('base64');
    } else {
      const dp = await open(dpr); covers = await dp.evaluate(COVERS, { sel: null }); hasTime = await dp.evaluate(TIME);
      shotSrc = 'data:image/png;base64,' + (await dp.screenshot({ type: 'png' })).toString('base64');
    }
    // At the hero's own pixels when it is the smaller: never upscale it
    let dImg = await decode(shotSrc, 16000), H, band = 0;
    const cw = part ? box.w : vw, W = Math.min(part ? dImg.w : vw * dpr, heroImg.w), f = W / cw, hs = Math.round(cw * dpr / heroImg.w * 100) / 100, sz = (im) => (im.w === W ? im : resize(im, W, Math.max(1, Math.round(im.h * W / im.w))));
    let hImg = sz(heroImg); dImg = sz(dImg);
    const fit = (im, h) => { if (im.h > h) return crop(im, 0, 0, im.w, h); if (im.h === h) return im; const d = new Uint8ClampedArray(im.w * h * 4); d.set(im.d); for (let i = im.d.length; i < d.length; i += 4) d.set([255, 0, 255, 255], i); return { w: im.w, h, d }; };
    if (part) { if (dImg.h > hImg.h) { band = dImg.h - hImg.h; dImg = crop(dImg, 0, 0, W, hImg.h); } H = Math.min(4000, Math.max(dImg.h, hImg.h)); hImg = fit(hImg, H); dImg = fit(dImg, H); }
    else { H = Math.min(Math.round(vh * f), hImg.h); hImg = crop(hImg, 0, 0, W, H); dImg = dImg.h >= H ? crop(dImg, 0, 0, W, H) : resize(dImg, W, H); }
    const cssPerHeroPx = Math.round(cw / heroImg.w * 1000) / 1000, regions = regionMatch(hImg, dImg), match = scoredMatch(regions), { panel } = pixelDiff(hImg, dImg);
    markSkips(regions, covers.map((c) => ({ kind: c.kind, x: c.x * f, y: c.y * f, w: c.w * f, h: c.h * f })));
    const skipped = regions.filter((r) => r.skip), pixel = skipped.length ? scoredMatch(regions) : match, done = P + doneLine(pixel, regions), k = Math.min(1, 2400 / H, 800 / W), small = (im) => (k < 1 ? resize(im, Math.max(1, Math.round(W * k)), Math.max(1, Math.round(H * k))) : im);
    const jf = join(out, 'diff.json'), shot = createHash('sha1').update(shotSrc).digest('hex').slice(0, 16); let prev = null; try { prev = JSON.parse(readFileSync(jf, 'utf8')); if ((prev.ref ?? prev.hero) !== hero || prev.sel !== (part ? selArg : undefined) || prev.pixel == null) prev = null; } catch {}
    const warns = !part && vw <= 500 && hasTime === false && statusBarRow(hImg, f) ? [`WARN no-status-bar: the hero has a status bar row and the draft's top 48px shows no time; keep it (time, signal, battery)`] : [];
    if (prev && (prev.last?.shot ?? prev.shot) === shot) warns.push(`WARN same-render: the draft rendered as in the last run; is the edit saved in ${target} (not a copy or a cached file) and inside the compared box?`);
    const b64 = (im) => Buffer.from(im.d.buffer, im.d.byteOffset, im.d.byteLength).toString('base64'), panels = [hImg, dImg, panel].map(small).map((im) => ({ w: im.w, h: im.h, b64: b64(im) }));
    const foot = `pixel match ${match}%, ${W}x${H} px, the ${part ? 'ref' : 'hero'} x${hs}, ${cropWhy}`;
    const file = join(out, 'diff.jpg'), at = `${vw}x${vh}${dpr !== 1 ? ` at ${dpr}x` : ''}`;
    writeFileSync(file, Buffer.from(await blank.evaluate(DIFFSHEET, { panels, labels: [part ? `ref: ${part}` : 'hero', `draft ${part ? `${selArg} ` : ''}${at}`, 'difference x4 over both at 50%'], foot }), 'base64'));
    const worst = regions.filter((r) => !r.skip).sort((p, q) => regionScore(p) - regionScore(q)).slice(0, 3), rfile = join(out, 'regions.jpg');
    const rows = worst.map((r) => ({ label: `${r.name}: ${r.match}% pixels, structure ${r.structure ?? '-'}   ${part ? 'ref' : 'hero'} | draft`, a: crop(hImg, r.x, r.y, r.w, r.h), b: crop(dImg, r.x, r.y, r.w, r.h) })).map((r) => ({ ...r, a: { w: r.a.w, h: r.a.h, b64: b64(r.a) }, b: { w: r.b.w, h: r.b.h, b64: b64(r.b) } }));
    if (rows.length) writeFileSync(rfile, Buffer.from(await blank.evaluate(REGIONSHEET, { rows }), 'base64'));
    await browser.close();
    // A part keeps its best run: done first, then pixels
    const now = { pixel, structure: meanStructure(regions), structureMin: minStructure(regions), done: done.startsWith(P + 'Done'), shot }, runs = (prev?.runs || 0) + 1;
    const rec = { v: 1, tool: 'gb-fidelity', mode: part ? 'part' : 'diff', ...(part ? { part, sel: selArg, ref: hero, box, noRefBand: Math.round(band / f) } : { hero }), ...now, run: runs, size: [W, H], viewport: `${vw}x${vh}`, dpr, heroScale: hs, cssPerHeroPx, tolerance: DIFF_TOL, weights: DIFF, pixelMatch: match, regions, notScored: skipped.map((r) => ({ name: r.name, kind: r.skip })), limits: { ...DONE, maxNotScored: MAX_SKIP }, trimmed: trim, cursors, warns: warns.map((w) => w.split(':')[0].slice(5)), crop: heroCrop ? Object.fromEntries(Object.entries(heroCrop).map(([q, v]) => [q, Math.round(v)])) : null, ms: Date.now() - t0 };
    const best = part && prev && (prev.done !== now.done ? prev.done : prev.pixel > pixel) ? prev : rec;
    writeFileSync(jf, JSON.stringify({ ...best, runs, last: { run: runs, ...now } }, null, 1));
    console.log(trimLine);
    if (part) console.log(`${P}the ${heroImg.w}x${heroImg.h} px ref at the width of ${selArg} (${box.w}x${box.h} CSS px) is ${Math.round(heroImg.h * cw / heroImg.w)} CSS px tall; 1 ref px is ${cssPerHeroPx} CSS px.${band ? ` no-ref band: ${Math.round(band / f)}px at the bottom (not scored)` : ''}`);
    else console.log(`Hero scale: the ${heroImg.w}x${heroImg.h} px hero is shown ${hs}x, at the ${vw} px viewport width${dpr !== 1 ? ` (${dpr}x pixels)` : ''}: 1 hero px is ${cssPerHeroPx} CSS px. Build at ${vw}x${vh}.`);
    console.log(`Pixel match: ${pixel}%${skipped.length ? ` over scored regions (${match}% all)` : ''}`);
    console.log('Regions, pixel match % / structure % (edges where the hero has them; - when flat in both):');
    for (let r = 0; r < 3; r++) console.log('  ' + regions.slice(r * 3, r * 3 + 3).map((x) => (x.skip ? `${x.name} ${x.skip}, not scored` : `${x.name} ${x.match}% / ${x.structure ?? '-'}`).padEnd(25)).join(' ').trimEnd());
    console.log(`The draft's ${part ? `${selArg} box (${box.w}x${box.h} CSS px)` : 'first screen'} at ${at} against the ${part ? `ref for ${part}` : 'hero'} (${cropWhy}); a pixel matches when every channel is within ${DIFF_TOL} (${DIFF.dark} on dark), edge pixels count ${DIFF.edge}x. Look at ${file}${rows.length ? ` and ${rfile} (the ${rows.length} worst regions)` : ''}, local only: never upload them.`);
    for (const w of warns) console.log(w);
    console.log(done);
    if (part) console.log(`${P}best run ${best.run} kept: pixel ${best.pixel}, structure ${best.structure} (the mean of the scored regions, lowest ${best.structureMin}), done ${best.done}; send these from ${jf} as fidelity.parts${best !== rec ? `. This run ${runs} scored ${pixel}%: go back to run ${best.run}'s code` : ''}`);
    return;
  }
  // The same first screen as --diff
  let heroCut = false; const heroFull = heroImg, ch = Math.round(heroImg.w * vp[1] / vp[0]);
  if (heroImg.h > ch + 1) { heroImg = crop(heroImg, 0, 0, heroImg.w, ch); heroCrop = { x: heroCrop?.x ?? 0, y: heroCrop?.y ?? 0, w: heroImg.w, h: ch }; heroCut = true; cropWhy = (heroCrop && cropWhy !== 'whole image' ? cropWhy + ', ' : '') + 'cut to its first screen'; }
  let draftImg, dom = null, page = null, draftSrc, arts = [];
  if (draftImage) { draftSrc = await imageData(draftImage); const full = await decode(draftSrc, 4000), h = Math.min(full.h, Math.round(full.w * vp[1] / vp[0])); draftImg = crop(full, 0, 0, full.w, h); }
  else {
    page = await browser.newPage({ viewport: { width: vp[0], height: vp[1] } }); const [fp, q] = target.split('?'), u = new URL(/^https?:|^file:/.test(target) ? target : pathToFileURL(resolve(fp)).href + (q ? '?' + q : '')); u.searchParams.set('shot', '1');
    try { await page.goto(u.href, { waitUntil: 'load', timeout: 30000 }); await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {}); } catch (e) { await browser.close(); console.log(`FAIL draft-unreadable: ${String(e.message || e).split('\n')[0]}`); process.exit(0); }
    await page.evaluate(() => document.fonts?.ready).catch(() => {}); await page.waitForTimeout(500);
    const png = await page.screenshot({ type: 'png' }); draftSrc = 'data:image/png;base64,' + png.toString('base64'); draftImg = await decode(draftSrc, 4000); dom = await page.evaluate(DOM);
    // Copied art: each picture
    arts = await page.evaluate(ARTS, { min: COPY.min }).catch(() => []);
    for (const a of arts) { const shot = await page.locator(`[data-gb-art="${a.i}"]`).screenshot({ type: 'png', timeout: 5000 }).catch(() => null); if (shot) a.img = await decode('data:image/png;base64,' + shot.toString('base64'), 4000); }
  }
  const shape = [vp[0], Math.round(vp[0] * heroImg.h / heroImg.w)], dh = Math.round(draftImg.w * shape[1] / shape[0]); if (draftImg.h > dh + 1) draftImg = crop(draftImg, 0, 0, draftImg.w, dh);
  const ts = heroTypeArg ?? tokens?.craft?.spec?.typeScale ?? tokens?.typeScale, heroType = typeRatio(ts), draftType = dom?.typeRatio ?? null, pixel = scoredMatch(regionMatch(resize(heroImg, draftImg.w, draftImg.h), draftImg));
  const fd = features(draftImg, shape), fh = features(heroImg, shape), { scores, far, raw } = compare(fd, fh, { draftType, heroType, pixel });
  const detail = { draft: { imageShare: r2(fd.photo), domImageShare: dom ? r2(dom.imageShare) : null, typeRatio: r2(draftType), bodyPx: dom?.bodyPx ?? null, largestPx: dom?.largestPx ?? null, ink: r2(fd.ink * 1000), textPer100k: dom?.textPer100k ?? null, ground: fd.palette[0] ? hexOf(fd.palette[0].lab) : null },
    hero: { imageShare: r2(fh.photo), typeRatio: r2(heroType), typeFrom: heroType ? (heroTypeArg ? '--hero-type' : tokens?.craft?.spec?.typeScale ? 'tokens craft.spec.typeScale' : 'tokens typeScale') : null, ink: r2(fh.ink * 1000), ground: fh.palette[0] ? hexOf(fh.palette[0].lab) : null, size: [heroImg.w, heroImg.h], crop: heroCrop ? Object.fromEntries(Object.entries(heroCrop).map(([k, v]) => [k, Math.round(v * heroNat)])) : null, cut: heroCut, cropWhy, trimmed: trim } };
  // Section and region pairs
  const pairs = [];
  for (const r of refs) {
    const row = { part: r.part, url: r.url, selector: r.selector || null };
    try {
      const src = await imageData(r.url); let ref = await decode(src); const rc = findScreen(ref.w > 700 ? resize(ref, 700, Math.round(ref.h * 700 / ref.w)) : ref), rk = ref.w > 700 ? ref.w / 700 : 1, nat = ref.nw / ref.w;
      if (rc) { ref = crop(ref, rc.x * rk, rc.y * rk, rc.w * rk, rc.h * rk); row.refCrop = Object.fromEntries(Object.entries(rc).map(([k, v]) => [k, Math.round(v * rk * nat)])); }
      row.img = ref; row.nat = nat;
      if (!page) { row.error = 'section pairs need the page, not --draft-image'; pairs.push(row); continue; }
      let ps = r.selector; if (!ps) try { ps = JSON.parse(readFileSync(join(out, `part-${slug(r.part)}`, 'diff.json'), 'utf8')).sel; } catch {} // the part run's element
      const sel = await page.evaluate(PART, { part: r.part, selector: ps || null }).catch((e) => { row.why = String(e.message || e).split('\n')[0]; return null; });
      let shot; if (sel === 'viewport') shot = await page.screenshot({ type: 'png' }); else if (sel) shot = await page.locator(sel).first().screenshot({ type: 'png', timeout: 10000 }).catch(() => null);
      if (!shot) { row.error = `no element for "${r.part}": run its part diff first, or pass ${r.part}=sel:<css>|<url>`; row.refSrc = src; pairs.push(row); continue; }
      row.found = sel; row.draftSrc = 'data:image/png;base64,' + shot.toString('base64'); row.refSrc = src;
      const di = await decode(row.draftSrc, 4000), shape = [di.w, di.h]; const c = compare(features(di, shape), features(resize(ref, Math.round(ref.h * shape[0] / shape[1]) || 1, ref.h), shape)); row.scores = c.scores; row.raw = c.raw;
    } catch (e) { row.error = String(e.message || e).split('\n')[0]; }
    pairs.push(row);
  }
  const fails = far.length >= 2 ? [`FAIL hero-far: ${far.length} of 5 axes far from the hero (${far.join(', ')}); copy the hero's structure again (grid, type sizes, pictures, density)`] : [];
  const copied = copiedArt(arts, [{ ref: 'hero', img: heroFull, c: heroFull.w / vp[0], nat: heroNat }, ...pairs.filter((x) => x.img).map((x) => ({ ref: x.part, img: x.img, c: x.img.w / vp[0], nat: x.nat }))]);
  for (const c of copied) fails.push(`FAIL copied-art: ${c.sel} matches ${c.ref === 'hero' ? 'the hero' : `the ref "${c.ref}"`} at ${c.at[0]},${c.at[1]}; draw or pick the product's own`);
  const lines = axisLines(scores, far, raw, detail);
  const H0 = Math.min(900, vp[1]), sheetRows = [{ a: { src: draftSrc, crop: draftImage ? { x: 0, y: 0, w: draftImg.w, h: draftImg.h } : null }, b: { src: heroSrc, crop: heroCrop && { x: heroCrop.x * heroNat, y: heroCrop.y * heroNat, w: heroCrop.w * heroNat, h: heroCrop.h * heroNat } }, h: H0, labelA: `draft ${vp[0]}x${vp[1]}, first screen`, labelB: 'hero' }];
  for (const p of pairs.filter((x) => x.refSrc)) sheetRows.push({ a: { src: p.draftSrc }, b: { src: p.refSrc, crop: p.refCrop }, h: 520, labelA: `draft: ${p.part}`, labelB: `ref: ${p.part}${p.scores ? `  layout ${p.scores.layout}, palette ${p.scores.palette}` : ''}`, missing: p.error });
  mkdirSync(out, { recursive: true });
  const shot = join(out, 'fidelity.jpg'); writeFileSync(shot, Buffer.from(await blank.evaluate(SHEET, { rows: sheetRows, foot: [...lines, ...fails] }), 'base64'));
  await browser.close();
  const summary = { v: 1, tool: 'gb-fidelity', hero, viewport: `${vp[0]}x${vp[1]}`, scores, far, limits: FAR, raw, detail, refs: pairs.map(({ draftSrc, refSrc, img, nat, ...p }) => p), copiedArt: copied.map(({ sel, ref, at }) => ({ sel, ref, at })), cursors, ms: Date.now() - t0 };
  writeFileSync(join(out, 'fidelity.json'), JSON.stringify(summary, null, 1));
  if (asJson) console.log(JSON.stringify(summary, null, 1));
  else {
    console.log(trimLine);
    console.log(`Draft first screen at ${vp[0]}x${vp[1]} against the hero (${cropWhy}):`);
    for (const l of lines) console.log(l);
    for (const p of pairs) console.log(p.error ? `pair ${p.part}: ${p.error}` : `pair ${p.part}: layout ${p.scores.layout}, palette ${p.scores.palette}, imagery ${p.scores.imagery} (${p.found})`);
    for (const f of fails) console.log(f);
    console.log(`Look at ${shot} (local only, never upload it). Pass ${join(out, 'fidelity.json')} as fidelity.`);
  }
}
function hexOf(lab) { // OKLab back to sRGB hex, for the report only
  const [L, a, b] = lab, l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const f = (x) => Math.round(255 * Math.min(1, Math.max(0, x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)));
  return '#' + [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((x) => f(x).toString(16).padStart(2, '0')).join('');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
