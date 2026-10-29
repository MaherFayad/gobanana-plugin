// gb-tools v5: a fetch line refetches a cached copy without this tag. Bump it in every script and fetch line when any script changes.
// gb-fidelity: how far is a draft's first screen from its hero? Pixels and the DOM only, no AI. The hero and refs are read in memory, never saved alone.
//   node gb-fidelity.mjs <draft.html|url> --hero <image url|file> [--refs "part=url,part=sel:<css>|url"] [--viewport 390x844] [--tokens tokens.json] [--hero-type 56/16] [--hero-crop x,y,w,h|none] [--out dir] [--json]
//   node gb-fidelity.mjs --draft-image <screenshot> --hero <image url|file> [--viewport 390x844] [--hero-type 56/16] [--out dir]   a screenshot instead of a page (no section pairs)
//   node gb-fidelity.mjs <draft.html|url> --hero <image url|file> --diff [--viewport 1440x900] [--hero-crop x,y,w,h|none] [--out dir]   the 1:1 copy check: one render at the hero's exact pixel size
// Source chrome first, in every mode: a credit bar ("curated by Mobbin", a uniform band at the top or bottom, 8% of the height
// at most, holding small text) and a presentation backdrop (a flat colour around a screen covering 50% or more) are trimmed,
// printed as "trimmed: ...", and the hero without them is written to <out>/hero-trimmed.png, the image to copy (local only).
// --no-trim keeps them; --hero-crop (a box or none) replaces the trim.
// --diff: the viewport is the trimmed hero's own size (a phone hero over 430px wide renders at 2x or 3x, so the shot has the
// hero's pixels; --viewport sets the width the page renders at, scaled to the hero's pixels). Writes <out>/diff.jpg (hero, draft,
// difference: the absolute per-pixel difference x4 over a 50% overlay of both), <out>/regions.jpg (the 3 worst regions of a
// 3 by 3 grid, hero beside draft, zoomed; both local only, never uploaded) and <out>/diff.json, and prints the pixel match %
// (the share of pixels within DIFF_TOL per channel), the match per region, and a done line: done at DONE.overall overall
// with every region at DONE.region, else what is short.
// Viewport: --viewport, else phone (390x844) or desktop (1440x900) by the hero's shape, the tokens.viewports size of that kind when given.
// A hero taller than the viewport (a full page capture) is cut to its first screen.
// A hero shot as a phone mockup (a device on a plain backdrop) is cropped to its screen; --hero-crop sets the box, --hero-crop none keeps it whole.
// Writes <out>/hero-trimmed.png in every mode (see source chrome above).
// --refs: one pair per part, the draft's part beside its ref; the part is sel:<css>, else [data-part], [data-section], #part, a landmark or a heading.
// Writes <out>/fidelity.jpg (draft and hero side by side, then each pair; local only, never uploaded) and <out>/fidelity.json
// { v, scores (closeness 0 to 1, type null when not measured), far, raw, detail }. Exit 0 always; FAIL hero-far is the signal.
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process'; import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';

// Scores are closeness, 0 to 1 (1 is the hero's own; 0.5 at each limit). Far from the hero when: layout under 0.5; palette dE over 15; type ratio past 1.6x either way; imagery: one side has photos and the
// other under half as much; density past 2x either way. 2 or more far: FAIL hero-far. Tuned on the round 2 drafts against their heroes.
export const FAR = { layout: 0.5, palette: 15, type: 1.6, imagery: 0.5, density: 2 };
export const AXES = ['layout', 'palette', 'type', 'imagery', 'density'];

// sRGB 0 to 255 to OKLab (Ottosson).
export function oklab(r, g, b) {
  const f = (x) => ((x /= 255) <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4), R = f(r), G = f(g), B = f(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);

// Images are { w, h, d }: d holds RGBA bytes, row by row.
export function crop(img, x, y, w, h) {
  x = Math.max(0, Math.round(x)); y = Math.max(0, Math.round(y)); w = Math.min(img.w - x, Math.round(w)); h = Math.min(img.h - y, Math.round(h));
  const d = new Uint8ClampedArray(w * h * 4);
  for (let j = 0; j < h; j++) d.set(img.d.subarray(((y + j) * img.w + x) * 4, ((y + j) * img.w + x + w) * 4), j * w * 4);
  return { w, h, d };
}
// Box-average resize (each target pixel averages the source pixels it covers).
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

// A phone mockup: a device on a plain backdrop. Returns the screen box inside the largest device, or null.
export function findScreen(img) {
  const { w, h } = img, lab = labOf(img), at = (x, y) => { const i = y * w + x; return [lab.L[i], lab.A[i], lab.B[i]]; };
  const t = Math.max(2, Math.round(Math.min(w, h) * 0.02)), sides = [[], [], [], []];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = at(x, y); if (y < t) sides[0].push(p); if (y >= h - t) sides[1].push(p); if (x < t) sides[2].push(p); if (x >= w - t) sides[3].push(p); }
  const ring = sides.flat(), med = [0, 1, 2].map((c) => ring.map((p) => p[c]).sort((a, b) => a - b)[ring.length >> 1]);
  // A plain backdrop on 3 of 4 sides (a shadow may darken one); else a screenshot, kept whole.
  if (sides.filter((s) => s.filter((p) => dist(p, med) < 0.06).length >= s.length * 0.8).length < 3) return null;
  const on = (x, y) => dist(at(x, y), med) > 0.06, segs = (count, n, min) => { const s = []; let a = -1; for (let i = 0; i <= n; i++) { const yes = i < n && count[i] > min; if (yes && a < 0) a = i; if (!yes && a >= 0) { s.push([a, i - 1]); a = -1; } } return s; };
  const col = new Array(w).fill(0); for (let x = 0; x < w; x++) for (let y = 0; y < h; y++) if (on(x, y)) col[x]++;
  const cs = segs(col, w, h * 0.05).map(([a, b]) => ({ a, b, m: col.slice(a, b + 1).reduce((s, v) => s + v, 0) })).sort((p, q) => q.m - p.m)[0]; if (!cs) return null;
  const row = new Array(h).fill(0); for (let y = 0; y < h; y++) for (let x = cs.a; x <= cs.b; x++) if (on(x, y)) row[y]++;
  const rs = segs(row, h, (cs.b - cs.a) * 0.05).sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0]; if (!rs) return null;
  const dev = { x0: cs.a, x1: cs.b, y0: rs[0], y1: rs[1] }, dw = dev.x1 - dev.x0, dh = dev.y1 - dev.y0;
  // A device is portrait (a phone) and covers a fair part of the image; a desktop page with plain margins is neither.
  if (dw * dh < w * h * 0.08 || dw * dh > w * h * 0.97 || dw / dh > 0.75) return null;
  // Along a line from the device edge inward: through the dark bezel, the screen starts where it ends. null: no bezel on this line.
  const walk = (pts) => { let i = 0; while (i < pts.length && !on(...pts[i])) i++; const lim = Math.min(pts.length, i + Math.round(pts.length * 0.15)); let dark = -1;
    for (; i < lim; i++) { const L = at(...pts[i])[0]; if (L < 0.2 && dark < 0) dark = i; if (dark >= 0 && L >= 0.2) return i; }
    return dark >= 0 ? dark + Math.round(pts.length * 0.03) : null; };
  const line = (fixed, from, to, vertical) => { const p = [], s = from < to ? 1 : -1; for (let v = from; v !== to; v += s) p.push(vertical ? [fixed, v] : [v, fixed]); return p; };
  const side = (fn) => { const v = [0.25, 0.5, 0.75].map(fn).filter((x) => x != null).sort((a, b) => a - b); return v.length >= 2 ? v[v.length >> 1] : null; };
  const L0 = side((f) => walk(line(Math.round(dev.y0 + dh * f), 0, w, false))), R0 = side((f) => walk(line(Math.round(dev.y0 + dh * f), w - 1, -1, false)));
  const T0 = side((f) => walk(line(Math.round(dev.x0 + dw * f), 0, h, true))), B0 = side((f) => walk(line(Math.round(dev.x0 + dw * f), h - 1, -1, true)));
  if ([L0, R0, T0, B0].filter((v) => v != null).length < 3) return null; // a dark bezel on 3 sides at least
  const x = L0 ?? dev.x0 + dw * 0.04, xr = R0 != null ? w - 1 - R0 : dev.x1 - dw * 0.04, y = T0 ?? dev.y0 + dh * 0.03, yb = B0 != null ? h - 1 - B0 : dev.y1 - dh * 0.03;
  if (xr - x < dw * 0.6 || yb - y < dh * 0.6 || yb - y > h * 0.95) return null;
  // Dark bezel pixels just outside the box, on most of its edge.
  const edge = []; for (let k = 0; k < 40; k++) { const fx = Math.round(x + (xr - x) * (k + 0.5) / 40), fy = Math.round(y + (yb - y) * (k + 0.5) / 40); edge.push([fx, Math.round(y) - 3], [fx, Math.round(yb) + 3], [Math.round(x) - 3, fy], [Math.round(xr) + 3, fy]); }
  const inside = edge.filter(([px, py]) => px >= 0 && py >= 0 && px < w && py < h);
  if (inside.filter(([px, py]) => at(px, py)[0] < 0.3).length < inside.length * 0.6) return null;
  return { x: Math.round(x), y: Math.round(y), w: Math.round(xr - x + 1), h: Math.round(yb - y + 1) };
}

// Source chrome is not design (round 6): a credit bar or a presentation backdrop is cut off before any comparison.
const rgbAt = (img, x, y) => { const k = (y * img.w + x) * 4; return [img.d[k], img.d[k + 1], img.d[k + 2]]; };
const near = (p, c, t = 14) => Math.abs(p[0] - c[0]) <= t && Math.abs(p[1] - c[1]) <= t && Math.abs(p[2] - c[2]) <= t;
const medianRGB = (ps) => [0, 1, 2].map((c) => ps.map((p) => p[c]).sort((a, b) => a - b)[ps.length >> 1]);
const rowOf = (img, y, x0 = 0, x1 = img.w) => { const o = []; for (let x = x0; x < x1; x++) o.push(rgbAt(img, x, y)); return o; };
const colOf = (img, x, y0 = 0, y1 = img.h) => { const o = []; for (let y = y0; y < y1; y++) o.push(rgbAt(img, x, y)); return o; };
const shareNear = (ps, c) => ps.filter((p) => near(p, c)).length / (ps.length || 1);
// A presentation backdrop: one flat colour on all 4 sides around an inner screen rectangle covering 50% or more, with a
// strong edge on all 4 sides. Returns the screen box, or null (a page whose own ground runs to the edges is never cut).
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
  // The edge: just inside the box differs from the backdrop, just outside it is the backdrop, on every side.
  const inS = (pts) => pts.filter(([x, y]) => off[y * w + x]).length / pts.length, line = (n, f) => Array.from({ length: n }, (_, i) => f(i));
  const d = 2, ins = [line(bw, (i) => [x0 + i, y0 + d]), line(bw, (i) => [x0 + i, y1 - d]), line(bh, (i) => [x0 + d, y0 + i]), line(bh, (i) => [x1 - d, y0 + i])];
  const outs = [line(bw, (i) => [x0 + i, y0 - d]), line(bw, (i) => [x0 + i, y1 + d]), line(bh, (i) => [x0 - d, y0 + i]), line(bh, (i) => [x1 + d, y0 + i])];
  if (ins.some((p) => inS(p) < 0.85) || outs.some((p) => inS(p) > 0.1)) return null;
  // Flat: almost nothing outside the box (a small credit line on the backdrop is fine).
  let o = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (off[y * w + x] && (x < x0 || x > x1 || y < y0 || y > y1)) o++;
  if (o > (w * h - bw * bh) * 0.05) return null;
  return { x: x0, y: y0, w: bw, h: bh };
}
// A credit bar ("curated by Mobbin"): a uniform band at the bottom or top, 8% of the height at most, distinct from the
// screen next to it, holding small text in groups with a wide gap between them (a tab bar spreads its items evenly).
export function findCreditBar(img) {
  const { w, h } = img;
  for (const side of ['bottom', 'top']) {
    const row = (i) => rowOf(img, side === 'bottom' ? h - 1 - i : i), first = row(0), C = medianRGB(first);
    if (shareNear(first, C) < 0.9) continue;
    let n = 0; while (n < h && shareNear(row(n), C) >= 0.5) n++;
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
// Both trims in turn, the backdrop first. Returns the box to keep (in img px) and what was cut, in the image's own px (k).
export function trimChrome(img, k = 1) {
  let box = { x: 0, y: 0, w: img.w, h: img.h }; const cut = [], P = (v) => `${Math.round(v * k)}px`;
  const b = findBackdrop(img);
  if (b) {
    const s = [b.x, img.w - b.x - b.w, b.y, img.h - b.y - b.h].map((v) => Math.round(v * k));
    cut.push(Math.max(...s) - Math.min(...s) <= 2 ? `backdrop ${s[0]}px each side` : `backdrop ${s[0]}px left, ${s[1]}px right, ${s[2]}px top, ${s[3]}px bottom`); box = b;
  }
  const inner = box === b ? crop(img, b.x, b.y, b.w, b.h) : img, c = findCreditBar(inner);
  if (c) { cut.push(`credit bar ${P(c.px)} ${c.side}`); box = { x: box.x + c.box.x, y: box.y + c.box.y, w: c.box.w, h: c.box.h }; }
  return { box: cut.length ? box : null, cut };
}

// Photo blocks: many colours, none of them ruling (text and icons are two tones, fills one). Closed once so a photo's calm sky stays in.
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
  // Lone blocks are text fringes; then close (grow, shrink) to fill the calm parts of a photo.
  const k = step(step(step(m, (v, c) => v && c >= 3), (v, c) => v || c >= 3), (v, c) => v && c >= 6);
  return { cw, ch, bs, m: k, share: k.reduce((s, v) => s + v, 0) / (cw * ch || 1) };
}
// Dominant colours: k-means in OKLab, deterministic seeds.
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
// Every number the comparison needs, from one first-screen image at the viewport's shape.
export function features(img, [vw, vh]) {
  const W = Math.round(Math.sqrt(120000 * vw / vh)), H = Math.round(W * vh / vw), a = resize(img, W, H), lab = labOf(a);
  // Photos are found at most 800px on the long side.
  const fit = (n) => { const k = Math.min(1, n / Math.max(img.w, img.h)); return k < 1 ? resize(img, Math.max(1, Math.round(img.w * k)), Math.max(1, Math.round(img.h * k))) : img; };
  const p = fit(800), mask = photoMask(p, labOf(p)), inPhoto = (x, y) => mask.m[Math.min(mask.ch - 1, Math.floor(y * mask.ch / H)) * mask.cw + Math.min(mask.cw - 1, Math.floor(x * mask.cw / W))];
  const gw = Math.max(4, Math.round(Math.sqrt(150 * vw / vh))), gh = Math.max(4, Math.round(gw * vh / vw)), lum = new Array(gw * gh).fill(0), edge = new Array(gw * gh).fill(0), cnt = new Array(gw * gh).fill(0);
  let ink = 0, inkN = 0;
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x, c = Math.min(gh - 1, Math.floor(y * gh / H)) * gw + Math.min(gw - 1, Math.floor(x * gw / W)), e = Math.hypot(lab.L[i + 1] - lab.L[i - 1], lab.L[i + W] - lab.L[i - W]);
    lum[c] += lab.L[i]; edge[c] += e; cnt[c]++; if (!inPhoto(x, y)) { ink += e; inkN++; }
  }
  for (let c = 0; c < lum.length; c++) { lum[c] /= cnt[c] || 1; edge[c] /= cnt[c] || 1; }
  // ink: the mean edge strength outside photos, per pixel of the whole screen (text, rules and controls; photos left out).
  return { size: [W, H], grid: [gw, gh], lum, edge, ink: ink / (W * H), palette: palette(lab, W * H), photo: mask.share };
}
// Structural similarity of two grids: 1 is the same pattern; c keeps two calm grids from reading as opposites.
const ssim = (x, y, c) => { const n = x.length, mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n; let cv = 0, vx = 0, vy = 0; for (let i = 0; i < n; i++) { cv += (x[i] - mx) * (y[i] - my); vx += (x[i] - mx) ** 2; vy += (y[i] - my) ** 2; } return (2 * cv / n + c) / ((vx + vy) / n + c); };
// Palette distance: the colour mass moved from one palette to the other (greedy transport, nearest pairs first), as OKLab dE x 100.
export function paletteDE(p, q) {
  const a = p.map((c) => c.w), b = q.map((c) => c.w), sa = a.reduce((s, v) => s + v, 0) || 1, sb = b.reduce((s, v) => s + v, 0) || 1, pairs = [];
  for (let i = 0; i < p.length; i++) { a[i] /= sa; for (let j = 0; j < q.length; j++) pairs.push([dist(p[i].lab, q[j].lab), i, j]); } for (let j = 0; j < q.length; j++) b[j] /= sb;
  let cost = 0; for (const [d, i, j] of pairs.sort((x, y) => x[0] - y[0])) { const m = Math.min(a[i], b[j]); if (m > 0) { cost += m * d; a[i] -= m; b[j] -= m; } }
  return cost * 100;
}
// --diff: two images of one size. match: % of pixels whose channels all sit within tol; panel: the absolute per-pixel
// difference x4 over a 50% overlay of both, dimmed to half, so what moved shows bright on a faint copy of both.
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
// --diff regions: a 3 by 3 grid of the (trimmed) hero, the pixel match in each. Done at DONE.overall and DONE.region.
export const DONE = { overall: 92, region: 85 };
const REGION_NAMES = ['top left', 'top', 'top right', 'middle left', 'middle', 'middle right', 'bottom left', 'bottom', 'bottom right'];
export function regionMatch(a, b, tol = DIFF_TOL) {
  const xs = [0, 1, 2, 3].map((i) => Math.round(a.w * i / 3)), ys = [0, 1, 2, 3].map((i) => Math.round(a.h * i / 3)), out = [];
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    const x = xs[c], y = ys[r], w = xs[c + 1] - x, h = ys[r + 1] - y; let ok = 0;
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) { const k = (j * a.w + i) * 4; if (Math.abs(a.d[k] - b.d[k]) <= tol && Math.abs(a.d[k + 1] - b.d[k + 1]) <= tol && Math.abs(a.d[k + 2] - b.d[k + 2]) <= tol) ok++; }
    out.push({ name: REGION_NAMES[r * 3 + c], x, y, w, h, match: Math.round((ok / (w * h || 1)) * 1000) / 10 });
  }
  return out;
}
// The done line: done, or what is short.
export function doneLine(match, regions) {
  const low = regions.filter((r) => r.match < DONE.region).sort((p, q) => p.match - q.match), short = [];
  if (match < DONE.overall) short.push(`overall ${match}% (needs ${DONE.overall}%)`);
  if (low.length) short.push(`${low.length} region${low.length > 1 ? 's' : ''} under ${DONE.region}%, worst ${low.slice(0, 3).map((r) => `${r.name} ${r.match}%`).join(', ')}`);
  return short.length ? `Not done: ${short.join('; ')}. Fix the worst regions first (regions.jpg).` : `Done: overall >= ${DONE.overall}% and every region >= ${DONE.region}%`;
}
// Imagery is far when one side has photos (12% of the screen or more) and the other has under half as much.
export const imageryFar = (d, h) => Math.max(d, h) >= 0.12 && Math.min(d, h) < Math.max(d, h) * FAR.imagery;
const ratioFar = (v, lim) => v != null && (v > lim || v < 1 / lim);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// Draft against hero. raw: the measured numbers. scores: closeness 0 to 1 per axis (1 is the hero's own), 0.5 at each
// limit, so far is always a score under 0.5; type is null when not measured. Type ratios (largest over body px) come from
// the page and the hero's typeScale.
export function compare(d, h, { draftType = null, heroType = null } = {}) {
  const layout = Math.max(0, (ssim(d.lum, h.lum, 0.002) + ssim(d.edge, h.edge, 0.0005)) / 2);
  const paletteDE_ = paletteDE(d.palette, h.palette);
  const typeRatio_ = draftType && heroType ? draftType / heroType : null;
  const top = Math.max(d.photo, h.photo), imageryGap = Math.abs(d.photo - h.photo); // pixels on both sides; the page's own image share is reported, not scored
  const densityRatio = (d.ink + 0.002) / (h.ink + 0.002);
  const byRatio = (v, lim) => clamp01(1 - Math.abs(Math.log(v)) / (2 * Math.log(lim)));
  const scores = { layout: r2(clamp01(layout)), palette: r2(clamp01(1 - paletteDE_ / (2 * FAR.palette))), type: typeRatio_ == null ? null : r2(byRatio(typeRatio_, FAR.type)),
    imagery: r2(clamp01(1 - imageryGap / (top >= 0.12 ? top : 0.24))), density: r2(byRatio(densityRatio, FAR.density)) };
  const far = [layout < FAR.layout && 'layout', paletteDE_ > FAR.palette && 'palette', ratioFar(typeRatio_, FAR.type) && 'type', imageryFar(d.photo, h.photo) && 'imagery', ratioFar(densityRatio, FAR.density) && 'density'].filter(Boolean);
  return { scores, far, raw: { layout: r2(layout), paletteDE: r2(paletteDE_), typeRatio: r2(typeRatio_), imageryDraft: r2(d.photo), imageryHero: r2(h.photo), densityRatio: r2(densityRatio) } };
}
export function axisLines(scores, far, raw, detail = {}) {
  const f = (a) => (far.includes(a) ? 'FAR ' : 'ok  '), dh = detail.hero || {}, dd = detail.draft || {}, sc = (a) => String(scores[a]).padEnd(5);
  return [
    `${f('layout')}layout   ${sc('layout')} where light, dark and busy areas sit (similarity ${raw.layout}; far under ${FAR.layout})`,
    `${f('palette')}palette  ${sc('palette')} dominant colours (dE ${raw.paletteDE}; far over ${FAR.palette})`,
    scores.type == null ? `ok  type     -     not measured: ${dh.typeRatio ? 'needs the page, not a screenshot' : 'pass --hero-type 56/16 or tokens with craft.spec.typeScale'}`
      : `${f('type')}type     ${sc('type')} largest over body text px (draft ${dd.typeRatio} vs hero ${dh.typeRatio}, ${raw.typeRatio}x; far past ${FAR.type}x)`,
    `${f('imagery')}imagery  ${sc('imagery')} photo share of the first screen (draft ${raw.imageryDraft} vs hero ${raw.imageryHero}; far when one has photos and the other under half as much)`,
    `${f('density')}density  ${sc('density')} edges outside photos (draft ${dd.ink} vs hero ${dh.ink}, ${raw.densityRatio}x; far past ${FAR.density}x)`,
  ];
}

// The draft's own numbers, in the page: image share of the first screen, largest and body text px, text elements per 100k px.
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
// The page part a ref pairs with: sel:<css>, else data-part, data-section, an id, a landmark, a heading.
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
// In a blank page: decode an image to RGBA (at most `max` px on its long side), and lay out the side by side sheet.
async function DECODE({ src, max }) {
  const img = new Image(); img.src = src; await img.decode(); const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k)), c = Object.assign(document.createElement('canvas'), { width: w, height: h }), x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h); const d = x.getImageData(0, 0, w, h).data; let s = ''; for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000));
  return { w, h, b64: btoa(s), nw: img.naturalWidth, nh: img.naturalHeight };
}
async function SHEET({ rows, foot }) {
  const load = async (r) => { if (!r.src) return null; const i = new Image(); i.src = r.src; await i.decode(); if (r.crop) { const c = Object.assign(document.createElement('canvas'), { width: r.crop.w, height: r.crop.h }); c.getContext('2d').drawImage(i, -r.crop.x, -r.crop.y); return c; } return i; };
  const pad = 24, gap = 24, lab = 30, out = [];
  // Each pair at one height: the draft part's own height (200 to row.h px), lowered until the pair fits 1800px across.
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
// In a blank page: the --diff sheet, three RGBA panels side by side with a label each and a foot line.
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

// In a blank page: one box of an image at its own pixels, as PNG (hero-trimmed.png).
async function CROPPNG({ src, box }) {
  const img = new Image(); img.src = src; await img.decode(); const b = box || { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
  const c = Object.assign(document.createElement('canvas'), { width: b.w, height: b.h }); c.getContext('2d').drawImage(img, -b.x, -b.y);
  return c.toDataURL('image/png').split(',')[1];
}
// In a blank page: regions.jpg, each worst region of the hero beside the draft's, zoomed (pixels kept sharp).
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
// An image as a data URL, in memory: http(s) fetched (20 MB at most), file: or a path read.
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
// "part=url,part=sel:<css>|url" or a .json file of [{ part, selector, url }].
export function parseRefs(v) {
  if (!v) return [];
  if (/\.json$/i.test(v) && existsSync(v)) return JSON.parse(readFileSync(v, 'utf8')).map((r) => ({ part: String(r.part), selector: r.selector || null, url: String(r.url) }));
  return v.split(/,(?=\s*[^,=/:|]+=\s*(?:sel:|https?:|file:|[.~/]|[\w-]+\.(?:jpe?g|png|webp|avif|gif)))/i).map((s) => s.trim()).filter(Boolean).map((s) => {
    const i = s.indexOf('='), part = s.slice(0, i).trim(), rest = s.slice(i + 1).trim(), m = /^sel:(.*)\|([^|]+)$/.exec(rest);
    return m ? { part, selector: m[1].trim(), url: m[2].trim() } : { part, selector: null, url: rest };
  });
}
// A typeScale such as "56/32/20/16/14" (or "56/16", or a ratio such as 3.5): the largest over the body size (the one nearest 16).
export function typeRatio(v) {
  const n = String(v ?? '').match(/\d+(?:\.\d+)?/g)?.map(Number).filter((x) => x > 0) ?? [];
  if (n.length === 1) return n[0] >= 1 && n[0] <= 12 ? n[0] : null;
  const body = n.filter((x) => x >= 12).sort((a, b) => Math.abs(a - 16) - Math.abs(b - 16))[0];
  return n.length && body ? Math.max(...n) / body : null;
}
const sizeOf = (s) => { const m = /^(\d{3,4})x(\d{3,4})$/.exec(String(s).trim()); return m ? [+m[1], +m[2]] : null; };

async function main() {
  const args = process.argv.slice(2), opt = (n) => { const i = args.indexOf('--' + n); return i < 0 ? null : args.splice(i, 2)[1]; }, flag = (n) => { const i = args.indexOf('--' + n); return i < 0 ? false : (args.splice(i, 1), true); };
  const hero = opt('hero'), heroTypeArg = opt('hero-type'), refsArg = opt('refs'), vpArg = opt('viewport'), tp = opt('tokens'), cropArg = opt('hero-crop'), draftImage = opt('draft-image'), asJson = flag('json'), diff = flag('diff'), noTrim = flag('no-trim');
  const out = resolve(opt('out') || join(process.env.TMPDIR || '/tmp', 'gb', 'fidelity')), target = args[0];
  const usage = (why) => { if (why) console.error(why); console.error('usage: node gb-fidelity.mjs <draft.html|url> --hero <image url|file> [--refs "part=url,part=sel:<css>|url"] [--viewport 390x844] [--tokens tokens.json] [--hero-type 56/16] [--hero-crop x,y,w,h|none] [--no-trim] [--out dir] [--json]\n   or: node gb-fidelity.mjs <draft.html|url> --hero <image url|file> --diff [--viewport 1440x900] [--no-trim] [--out dir]\n   or: node gb-fidelity.mjs --draft-image <screenshot> --hero <image url|file> [--viewport 390x844] [--hero-type 56/16] [--out dir]'); process.exit(2); };
  if (!hero || (!target && !draftImage) || [hero, heroTypeArg, refsArg, vpArg, tp, cropArg, draftImage].some((v) => v === undefined || /^--/.test(v ?? ''))) usage();
  if (vpArg && !sizeOf(vpArg)) usage(`--viewport takes WIDTHxHEIGHT, for example 390x844 (got "${vpArg}")`);
  const tokens = tp ? JSON.parse(readFileSync(tp, 'utf8')) : (() => { try { return target && !/^https?:/.test(target) ? JSON.parse(readFileSync(join(dirname(target.startsWith('file:') ? fileURLToPath(target.split('?')[0]) : resolve(target.split('?')[0])), 'tokens.json'), 'utf8')) : null; } catch { return null; } })();
  const refs = parseRefs(refsArg), t0 = Date.now(), req = createRequire(import.meta.url), gbDir = join(process.env.TMPDIR || '/tmp', 'gb');
  const cannot = (e) => { try { mkdirSync(gbDir, { recursive: true }); writeFileSync(join(gbDir, '.gb-norender'), `${new Date().toISOString()} ${String(e?.message || e).split('\n')[0]}\n`); } catch {} console.error(`This machine cannot render: ${String(e?.message || e).split('\n')[0]}`); process.exit(3); };
  let pw; try { try { pw = req('playwright'); } catch { pw = createRequire(join(execSync('npm root -g').toString().trim(), '_'))('playwright'); } } catch (e) { cannot(e); }
  const browser = await pw.chromium.launch().catch(cannot), blank = await browser.newPage();
  const decode = async (src, max = 1600) => { const r = await blank.evaluate(DECODE, { src, max }); return { w: r.w, h: r.h, d: new Uint8ClampedArray(Buffer.from(r.b64, 'base64')), nw: r.nw, nh: r.nh }; };
  let heroSrc; try { heroSrc = await imageData(hero); } catch (e) { await browser.close(); console.log(`FAIL hero-unreadable: ${String(e.message || e).split('\n')[0]}`); process.exit(0); }
  // The hero, cropped to the screen when it is a phone mockup (--diff reads it at full size: its pixels are the target).
  let heroImg = await decode(heroSrc, diff ? 16000 : 1600), heroCrop = null, cropWhy = 'whole image';
  if (cropArg && cropArg !== 'none') { const n = cropArg.split(',').map(Number); if (n.length !== 4 || n.some((v) => !(v >= 0))) usage('--hero-crop takes x,y,w,h in the image px (or fractions of it), or none'); const k = n.every((v) => v <= 1) ? [heroImg.w, heroImg.h] : [heroImg.w / heroImg.nw, heroImg.h / heroImg.nh]; heroCrop = { x: n[0] * k[0], y: n[1] * k[1], w: n[2] * k[0], h: n[3] * k[1] }; cropWhy = '--hero-crop'; }
  else if (cropArg !== 'none') { const s = findScreen(heroImg.w > 700 ? resize(heroImg, 700, Math.round(heroImg.h * 700 / heroImg.w)) : heroImg); if (s) { const k = heroImg.w > 700 ? heroImg.w / 700 : 1; heroCrop = { x: s.x * k, y: s.y * k, w: s.w * k, h: s.h * k }; cropWhy = 'device screen found (pass --hero-crop none to keep the whole image)'; } }
  const heroNat = heroImg.nw / heroImg.w;
  // Source chrome is not design: a credit bar or a presentation backdrop is trimmed (not after --hero-crop or a device screen).
  let trimmed = noTrim ? 'off (--no-trim)' : cropWhy === '--hero-crop' ? 'the --hero-crop box' : cropWhy.startsWith('device') ? 'device bezel (the phone mockup cut to its screen)' : cropArg === 'none' ? 'nothing (--hero-crop none)' : 'nothing (no credit bar or backdrop found)', trim = [];
  if (!noTrim && !heroCrop && cropArg !== 'none') { const t = trimChrome(heroImg, heroNat); if (t.box) { heroCrop = t.box; trim = t.cut; trimmed = t.cut.join('; '); cropWhy = `trimmed ${trimmed}`; } }
  if (heroCrop) heroImg = crop(heroImg, heroCrop.x, heroCrop.y, heroCrop.w, heroCrop.h);
  // hero-trimmed.png: the hero without its chrome at its own pixels, the image step 1 copies (local only, never uploaded).
  mkdirSync(out, { recursive: true }); const natBox = heroCrop ? Object.fromEntries(Object.entries(heroCrop).map(([q, v]) => [q, Math.round(v * heroNat)])) : null, trimmedFile = join(out, 'hero-trimmed.png');
  writeFileSync(trimmedFile, Buffer.from(await blank.evaluate(CROPPNG, { src: heroSrc, box: natBox }), 'base64'));
  const trimLine = `trimmed: ${trimmed}. Copy from ${trimmedFile} (${natBox ? `${natBox.w}x${natBox.h}` : `${heroImg.nw}x${heroImg.nh}`} px; local only, never upload it).`;
  // The viewport: --viewport; else phone or desktop by the hero's shape (a phone screen is under 0.6 wide for its height; a full
  // page capture 1000px wide or more is a desktop page unless it is shaped like a phone screen), then the tokens' size of that kind.
  const ar = heroImg.w / heroImg.h, natW = heroImg.w * heroNat, phone = cropWhy.startsWith('device') || (ar < 0.6 && !(natW >= 1000 && (ar < 0.42 || ar > 0.5)));
  if (diff) {
    // One render at the hero's own size: a phone screen over 430px wide is a 2x or 3x capture, so the page renders at that scale.
    // --viewport: the page renders at that width, scaled to the hero's pixels (its height follows the hero's shape).
    const W = heroImg.w, H = heroImg.h, dpr = vpArg ? W / sizeOf(vpArg)[0] : phone ? Math.max(1, Math.round(W / 430)) : W > 2000 ? 2 : 1, vw = Math.round(W / dpr), vh = Math.round(H / dpr);
    let shotSrc;
    if (draftImage) shotSrc = await imageData(draftImage);
    else {
      const dp = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: dpr }), [fp, q] = target.split('?'), u = new URL(/^https?:|^file:/.test(target) ? target : pathToFileURL(resolve(fp)).href + (q ? '?' + q : '')); u.searchParams.set('shot', '1');
      try { await dp.goto(u.href, { waitUntil: 'load', timeout: 30000 }); await dp.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {}); } catch (e) { await browser.close(); console.log(`FAIL draft-unreadable: ${String(e.message || e).split('\n')[0]}`); process.exit(0); }
      await dp.evaluate(() => document.fonts?.ready).catch(() => {}); await dp.waitForTimeout(300);
      shotSrc = 'data:image/png;base64,' + (await dp.screenshot({ type: 'png' })).toString('base64');
    }
    // A draft of another size is cut to the hero's shape from the top, then scaled to its pixels.
    let dImg = await decode(shotSrc, 16000); const ch = Math.min(dImg.h, Math.round(dImg.w * H / W)); if (ch !== dImg.h) dImg = crop(dImg, 0, 0, dImg.w, ch); if (dImg.w !== W || dImg.h !== H) dImg = resize(dImg, W, H);
    const { match, panel } = pixelDiff(heroImg, dImg), regions = regionMatch(heroImg, dImg), done = doneLine(match, regions), k = Math.min(1, 2400 / H, 800 / W), small = (im) => (k < 1 ? resize(im, Math.max(1, Math.round(W * k)), Math.max(1, Math.round(H * k))) : im);
    const b64 = (im) => Buffer.from(im.d.buffer, im.d.byteOffset, im.d.byteLength).toString('base64'), panels = [heroImg, dImg, panel].map(small).map((im) => ({ w: im.w, h: im.h, b64: b64(im) }));
    const foot = `pixel match ${match}% (within ${DIFF_TOL} per channel), ${W}x${H} px, ${cropWhy}`;
    const file = join(out, 'diff.jpg'), at = `${vw}x${vh}${dpr !== 1 ? ` at ${Math.round(dpr * 100) / 100}x` : ''}`;
    writeFileSync(file, Buffer.from(await blank.evaluate(DIFFSHEET, { panels, labels: ['hero', `draft ${at}`, 'difference x4 over both at 50%'], foot }), 'base64'));
    // regions.jpg: the 3 worst regions, hero beside draft, zoomed.
    const worst = [...regions].sort((p, q) => p.match - q.match).slice(0, 3), rfile = join(out, 'regions.jpg');
    const rows = worst.map((r) => ({ label: `${r.name}: ${r.match}%   hero | draft`, a: crop(heroImg, r.x, r.y, r.w, r.h), b: crop(dImg, r.x, r.y, r.w, r.h) })).map((r) => ({ ...r, a: { w: r.a.w, h: r.a.h, b64: b64(r.a) }, b: { w: r.b.w, h: r.b.h, b64: b64(r.b) } }));
    writeFileSync(rfile, Buffer.from(await blank.evaluate(REGIONSHEET, { rows }), 'base64'));
    await browser.close();
    writeFileSync(join(out, 'diff.json'), JSON.stringify({ v: 1, tool: 'gb-fidelity', mode: 'diff', hero, size: [W, H], viewport: `${vw}x${vh}`, dpr: Math.round(dpr * 1000) / 1000, tolerance: DIFF_TOL, pixelMatch: match, regions, done: done.startsWith('Done'), limits: DONE, trimmed: trim, crop: heroCrop ? Object.fromEntries(Object.entries(heroCrop).map(([q, v]) => [q, Math.round(v)])) : null, ms: Date.now() - t0 }, null, 1));
    console.log(trimLine);
    console.log(`Pixel match: ${match}%`);
    for (let r = 0; r < 3; r++) console.log('  ' + regions.slice(r * 3, r * 3 + 3).map((x) => `${x.name} ${x.match}%`.padEnd(22)).join('').trimEnd());
    console.log(`The draft at the hero's ${W}x${H} px (${at}, ${cropWhy}); a pixel matches when every channel is within ${DIFF_TOL}. Look at ${file} (hero, draft, and the difference, bright where they differ) and ${rfile} (the 3 worst regions, hero beside draft). Local only: they hold the hero, never upload them.`);
    console.log(done);
    return;
  }
  const tvs = (Array.isArray(tokens?.viewports) ? tokens.viewports : [tokens?.viewports]).flatMap((x) => String(x || '').split(',')).map(sizeOf).filter(Boolean).sort((a, b) => a[0] - b[0]);
  const vp = vpArg ? sizeOf(vpArg) : tvs.length ? (phone ? tvs[0] : tvs[tvs.length - 1]) : phone ? [390, 844] : [1440, 900];
  // A hero much taller than the viewport (a full page capture) is cut to its first screen.
  let heroCut = false;
  if (heroImg.h / heroImg.w > (vp[1] / vp[0]) * 1.25) { const ch = Math.round(heroImg.w * vp[1] / vp[0]); heroImg = crop(heroImg, 0, 0, heroImg.w, ch); heroCrop = { x: heroCrop?.x ?? 0, y: heroCrop?.y ?? 0, w: heroImg.w, h: ch }; heroCut = true; cropWhy = (heroCrop && cropWhy !== 'whole image' ? cropWhy + ', ' : '') + 'cut to its first screen'; }
  // The draft's first screen: rendered, or a screenshot cut to the viewport's shape from the top.
  let draftImg, dom = null, page = null, draftSrc;
  if (draftImage) { draftSrc = await imageData(draftImage); const full = await decode(draftSrc, 4000), h = Math.min(full.h, Math.round(full.w * vp[1] / vp[0])); draftImg = crop(full, 0, 0, full.w, h); }
  else {
    page = await browser.newPage({ viewport: { width: vp[0], height: vp[1] } }); const [fp, q] = target.split('?'), u = new URL(/^https?:|^file:/.test(target) ? target : pathToFileURL(resolve(fp)).href + (q ? '?' + q : '')); u.searchParams.set('shot', '1');
    try { await page.goto(u.href, { waitUntil: 'load', timeout: 30000 }); await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {}); } catch (e) { await browser.close(); console.log(`FAIL draft-unreadable: ${String(e.message || e).split('\n')[0]}`); process.exit(0); }
    await page.evaluate(() => document.fonts?.ready).catch(() => {}); await page.waitForTimeout(500);
    const png = await page.screenshot({ type: 'png' }); draftSrc = 'data:image/png;base64,' + png.toString('base64'); draftImg = await decode(draftSrc, 4000); dom = await page.evaluate(DOM);
  }
  // Type: the page's own px, and the hero's typeScale (--hero-type, else tokens.craft.spec.typeScale).
  const heroType = typeRatio(heroTypeArg ?? tokens?.craft?.spec?.typeScale), draftType = dom?.typeRatio ?? null;
  const fd = features(draftImg, vp), fh = features(heroImg, vp), { scores, far, raw } = compare(fd, fh, { draftType, heroType });
  const detail = { draft: { imageShare: r2(fd.photo), domImageShare: dom ? r2(dom.imageShare) : null, typeRatio: r2(draftType), bodyPx: dom?.bodyPx ?? null, largestPx: dom?.largestPx ?? null, ink: r2(fd.ink * 1000), textPer100k: dom?.textPer100k ?? null, ground: fd.palette[0] ? hexOf(fd.palette[0].lab) : null },
    hero: { imageShare: r2(fh.photo), typeRatio: r2(heroType), typeFrom: heroType ? (heroTypeArg ? '--hero-type' : 'tokens craft.spec.typeScale') : null, ink: r2(fh.ink * 1000), ground: fh.palette[0] ? hexOf(fh.palette[0].lab) : null, size: [heroImg.w, heroImg.h], crop: heroCrop ? Object.fromEntries(Object.entries(heroCrop).map(([k, v]) => [k, Math.round(v * heroNat)])) : null, cut: heroCut, cropWhy, trimmed: trim } };
  // Section and region pairs.
  const pairs = [];
  for (const r of refs) {
    const row = { part: r.part, url: r.url, selector: r.selector || null };
    try {
      const src = await imageData(r.url); let ref = await decode(src); const rc = findScreen(ref.w > 700 ? resize(ref, 700, Math.round(ref.h * 700 / ref.w)) : ref), rk = ref.w > 700 ? ref.w / 700 : 1, nat = ref.nw / ref.w;
      if (rc) { ref = crop(ref, rc.x * rk, rc.y * rk, rc.w * rk, rc.h * rk); row.refCrop = Object.fromEntries(Object.entries(rc).map(([k, v]) => [k, Math.round(v * rk * nat)])); }
      if (!page) { row.error = 'section pairs need the page, not --draft-image'; pairs.push(row); continue; }
      const sel = await page.evaluate(PART, { part: r.part, selector: r.selector || null }).catch((e) => { row.why = String(e.message || e).split('\n')[0]; return null; });
      let shot; if (sel === 'viewport') shot = await page.screenshot({ type: 'png' }); else if (sel) shot = await page.locator(sel).first().screenshot({ type: 'png', timeout: 10000 }).catch(() => null);
      if (!shot) { row.error = `no element for "${r.part}": add data-part="${r.part}" to it or pass ${r.part}=sel:<css>|<url>`; row.refSrc = src; pairs.push(row); continue; }
      row.found = sel; row.draftSrc = 'data:image/png;base64,' + shot.toString('base64'); row.refSrc = src;
      const di = await decode(row.draftSrc, 4000), shape = [di.w, di.h]; const c = compare(features(di, shape), features(resize(ref, Math.round(ref.h * shape[0] / shape[1]) || 1, ref.h), shape)); row.scores = c.scores; row.raw = c.raw;
    } catch (e) { row.error = String(e.message || e).split('\n')[0]; }
    pairs.push(row);
  }
  const fails = far.length >= 2 ? [`FAIL hero-far: ${far.length} of 5 axes far from the hero (${far.join(', ')}); rebuild the hero's structure first (grid, type sizes, image placement, density), then fold in the idea`] : [];
  const lines = axisLines(scores, far, raw, detail);
  // fidelity.jpg: draft and hero at the same height, then each pair.
  const H0 = Math.min(900, vp[1]), sheetRows = [{ a: { src: draftSrc, crop: draftImage ? { x: 0, y: 0, w: draftImg.w, h: draftImg.h } : null }, b: { src: heroSrc, crop: heroCrop && { x: heroCrop.x * heroNat, y: heroCrop.y * heroNat, w: heroCrop.w * heroNat, h: heroCrop.h * heroNat } }, h: H0, labelA: `draft ${vp[0]}x${vp[1]}, first screen`, labelB: 'hero' }];
  for (const p of pairs.filter((x) => x.refSrc)) sheetRows.push({ a: { src: p.draftSrc }, b: { src: p.refSrc, crop: p.refCrop }, h: 520, labelA: `draft: ${p.part}`, labelB: `ref: ${p.part}${p.scores ? `  layout ${p.scores.layout}, palette ${p.scores.palette}` : ''}`, missing: p.error });
  mkdirSync(out, { recursive: true });
  const shot = join(out, 'fidelity.jpg'); writeFileSync(shot, Buffer.from(await blank.evaluate(SHEET, { rows: sheetRows, foot: [...lines, ...fails] }), 'base64'));
  await browser.close();
  const summary = { v: 1, tool: 'gb-fidelity', hero, viewport: `${vp[0]}x${vp[1]}`, scores, far, limits: FAR, raw, detail, refs: pairs.map(({ draftSrc, refSrc, ...p }) => p), ms: Date.now() - t0 };
  writeFileSync(join(out, 'fidelity.json'), JSON.stringify(summary, null, 1));
  if (asJson) console.log(JSON.stringify(summary, null, 1));
  else {
    console.log(trimLine);
    console.log(`Draft first screen at ${vp[0]}x${vp[1]} against the hero (${cropWhy}):`);
    for (const l of lines) console.log(l);
    for (const p of pairs) console.log(p.error ? `pair ${p.part}: ${p.error}` : `pair ${p.part}: layout ${p.scores.layout}, palette ${p.scores.palette}, imagery ${p.scores.imagery} (${p.found}; look at the pair, a whole-page ref scores low by design)`);
    for (const f of fails) console.log(f);
    console.log(`Look at ${shot} (local only: it holds the hero, never upload it) and write the gaps per axis in the crit. Pass { v, scores, far } from ${join(out, 'fidelity.json')} as fidelity.`);
  }
}
function hexOf(lab) { // OKLab back to sRGB hex, for the report only
  const [L, a, b] = lab, l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const f = (x) => Math.round(255 * Math.min(1, Math.max(0, x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)));
  return '#' + [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s].map((x) => f(x).toString(16).padStart(2, '0')).join('');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
