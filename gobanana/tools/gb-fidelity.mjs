// gb-tools v3: a fetch line refetches a cached copy without this tag. Bump it in every script and fetch line when any script changes.
// gb-fidelity: how far is a draft's first screen from its hero? Pixels and the DOM only, no AI. The hero and refs are read in memory, never saved alone.
//   node gb-fidelity.mjs <draft.html|url> --hero <image url|file> [--refs "part=url,part=sel:<css>|url"] [--viewport 390x844] [--tokens tokens.json] [--hero-type 56/16] [--hero-crop x,y,w,h|none] [--out dir] [--json]
//   node gb-fidelity.mjs --draft-image <screenshot> --hero <image url|file> [--viewport 390x844] [--hero-type 56/16] [--out dir]   a screenshot instead of a page (no section pairs)
// Viewport: --viewport, else phone (390x844) or desktop (1440x900) by the hero's shape, the tokens.viewports size of that kind when given.
// A hero taller than the viewport (a full page capture) is cut to its first screen.
// A hero shot as a phone mockup (a device on a plain backdrop) is cropped to its screen; --hero-crop sets the box, --hero-crop none keeps it whole.
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
  const hero = opt('hero'), heroTypeArg = opt('hero-type'), refsArg = opt('refs'), vpArg = opt('viewport'), tp = opt('tokens'), cropArg = opt('hero-crop'), draftImage = opt('draft-image'), asJson = flag('json');
  const out = resolve(opt('out') || join(process.env.TMPDIR || '/tmp', 'gb', 'fidelity')), target = args[0];
  const usage = (why) => { if (why) console.error(why); console.error('usage: node gb-fidelity.mjs <draft.html|url> --hero <image url|file> [--refs "part=url,part=sel:<css>|url"] [--viewport 390x844] [--tokens tokens.json] [--hero-type 56/16] [--hero-crop x,y,w,h|none] [--out dir] [--json]\n   or: node gb-fidelity.mjs --draft-image <screenshot> --hero <image url|file> [--viewport 390x844] [--hero-type 56/16] [--out dir]'); process.exit(2); };
  if (!hero || (!target && !draftImage) || [hero, heroTypeArg, refsArg, vpArg, tp, cropArg, draftImage].some((v) => v === undefined || /^--/.test(v ?? ''))) usage();
  if (vpArg && !sizeOf(vpArg)) usage(`--viewport takes WIDTHxHEIGHT, for example 390x844 (got "${vpArg}")`);
  const tokens = tp ? JSON.parse(readFileSync(tp, 'utf8')) : (() => { try { return target && !/^https?:/.test(target) ? JSON.parse(readFileSync(join(dirname(target.startsWith('file:') ? fileURLToPath(target.split('?')[0]) : resolve(target.split('?')[0])), 'tokens.json'), 'utf8')) : null; } catch { return null; } })();
  const refs = parseRefs(refsArg), t0 = Date.now(), req = createRequire(import.meta.url), gbDir = join(process.env.TMPDIR || '/tmp', 'gb');
  const cannot = (e) => { try { mkdirSync(gbDir, { recursive: true }); writeFileSync(join(gbDir, '.gb-norender'), `${new Date().toISOString()} ${String(e?.message || e).split('\n')[0]}\n`); } catch {} console.error(`This machine cannot render: ${String(e?.message || e).split('\n')[0]}`); process.exit(3); };
  let pw; try { try { pw = req('playwright'); } catch { pw = createRequire(join(execSync('npm root -g').toString().trim(), '_'))('playwright'); } } catch (e) { cannot(e); }
  const browser = await pw.chromium.launch().catch(cannot), blank = await browser.newPage();
  const decode = async (src, max = 1600) => { const r = await blank.evaluate(DECODE, { src, max }); return { w: r.w, h: r.h, d: new Uint8ClampedArray(Buffer.from(r.b64, 'base64')), nw: r.nw, nh: r.nh }; };
  let heroSrc; try { heroSrc = await imageData(hero); } catch (e) { await browser.close(); console.log(`FAIL hero-unreadable: ${String(e.message || e).split('\n')[0]}`); process.exit(0); }
  // The hero, cropped to the screen when it is a phone mockup.
  let heroImg = await decode(heroSrc), heroCrop = null, cropWhy = 'whole image';
  if (cropArg && cropArg !== 'none') { const n = cropArg.split(',').map(Number); if (n.length !== 4 || n.some((v) => !(v >= 0))) usage('--hero-crop takes x,y,w,h in the image px (or fractions of it), or none'); const k = n.every((v) => v <= 1) ? [heroImg.w, heroImg.h] : [heroImg.w / heroImg.nw, heroImg.h / heroImg.nh]; heroCrop = { x: n[0] * k[0], y: n[1] * k[1], w: n[2] * k[0], h: n[3] * k[1] }; cropWhy = '--hero-crop'; }
  else if (cropArg !== 'none') { const s = findScreen(heroImg.w > 700 ? resize(heroImg, 700, Math.round(heroImg.h * 700 / heroImg.w)) : heroImg); if (s) { const k = heroImg.w > 700 ? heroImg.w / 700 : 1; heroCrop = { x: s.x * k, y: s.y * k, w: s.w * k, h: s.h * k }; cropWhy = 'device screen found (pass --hero-crop none to keep the whole image)'; } }
  const heroNat = heroImg.nw / heroImg.w;
  if (heroCrop) heroImg = crop(heroImg, heroCrop.x, heroCrop.y, heroCrop.w, heroCrop.h);
  // The viewport: --viewport; else phone or desktop by the hero's shape (a phone screen is under 0.6 wide for its height; a full
  // page capture 1000px wide or more is a desktop page unless it is shaped like a phone screen), then the tokens' size of that kind.
  const ar = heroImg.w / heroImg.h, natW = heroImg.w * heroNat, phone = cropWhy.startsWith('device') || (ar < 0.6 && !(natW >= 1000 && (ar < 0.42 || ar > 0.5)));
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
    hero: { imageShare: r2(fh.photo), typeRatio: r2(heroType), typeFrom: heroType ? (heroTypeArg ? '--hero-type' : 'tokens craft.spec.typeScale') : null, ink: r2(fh.ink * 1000), ground: fh.palette[0] ? hexOf(fh.palette[0].lab) : null, size: [heroImg.w, heroImg.h], crop: heroCrop ? Object.fromEntries(Object.entries(heroCrop).map(([k, v]) => [k, Math.round(v * heroNat)])) : null, cut: heroCut, cropWhy } };
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
