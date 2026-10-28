// gb-tools v1: a fetch line refetches a cached copy without this tag. Bump it in every script and fetch line when any script changes.
// gb-spread: are these concepts really different? Where text, panels and media sit on each first screen.
//   node gb-spread.mjs <a.html|url> <b.html|url> [more] [--lang en] [--w 1440 --h 900] [--max 0.7] [--json]
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
import { basename, join, resolve } from 'node:path'; import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args.splice(i, 2)[1]; };
const flag = (n) => { const i = args.indexOf('--' + n); if (i < 0) return false; args.splice(i, 1); return true; };
const lang = opt('lang', 'en'), W = +opt('w', 1440), H = +opt('h', 900), MAX = +opt('max', 0.7), asJson = flag('json'), targets = args;
if (targets.length < 2) { console.error('usage: node gb-spread.mjs <a.html|url> <b.html|url> [more] [--lang en] [--max 0.7] [--json]'); process.exit(2); }
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire(join(execSync('npm root -g').toString().trim(), '_'))('playwright'); }

// In the page: a 24 x 15 first-screen grid of text, panels and media, plus the ground.
function SKELETON({ cols, rows }) {
  const W = innerWidth, H = innerHeight, cw = W / cols, ch = H / rows, grid = () => new Uint8Array(cols * rows);
  const T = grid(), P = grid(), M = grid();
  const mark = (g, r) => { if (r.bottom <= 0 || r.top >= H || r.right <= 0 || r.left >= W) return; for (let y = Math.max(0, Math.floor(r.top / ch)); y < Math.min(rows, Math.ceil(r.bottom / ch)); y++) for (let x = Math.max(0, Math.floor(r.left / cw)); x < Math.min(cols, Math.ceil(r.right / cw)); x++) g[y * cols + x] = 1; };
  const cx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#0000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = (c) => { const f = (x) => ((x /= 255) <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const skip = (e) => e.closest('script,style,noscript,[hidden],[aria-hidden="true"],.gb-switch,.sr-only,.visually-hidden');
  const rg = document.createRange(), tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (!n.nodeValue.trim() || !n.parentElement || skip(n.parentElement) || getComputedStyle(n.parentElement).visibility === 'hidden') continue; rg.selectNodeContents(n); for (const r of rg.getClientRects()) if (r.width >= 1) mark(T, r); }
  // The ground: the commonest opaque background behind five first-screen points.
  const behind = (x, y) => { for (let e = document.elementFromPoint(x, y); e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0.5) return c; } return [255, 255, 255, 1]; };
  const seen = [[0.5, 0.5], [0.05, 0.5], [0.95, 0.5], [0.5, 0.95], [0.5, 0.05]].map(([x, y]) => behind(W * x, H * y)), key = (c) => c.slice(0, 3).join();
  const ground = seen.sort((a, b) => seen.filter((c) => key(c) === key(b)).length - seen.filter((c) => key(c) === key(a)).length)[0];
  const bodyBg = getComputedStyle(document.body).backgroundColor;
  for (const e of document.body.querySelectorAll('*')) {
    if (skip(e)) continue; const r = e.getBoundingClientRect(); if (r.width < 8 || r.height < 8) continue; const a = r.width * r.height; if (a > W * H * 0.85) continue;
    const cs = getComputedStyle(e);
    if (/^(IMG|VIDEO|CANVAS|PICTURE)$/.test(e.tagName) || (e.tagName === 'svg' && a >= 48 * 48) || (cs.backgroundImage !== 'none' && a >= 48 * 48)) { mark(M, r); continue; }
    const bg = rgba(cs.backgroundColor), border = parseFloat(cs.borderTopWidth) + parseFloat(cs.borderInlineStartWidth || cs.borderLeftWidth) >= 1 && rgba(cs.borderTopColor)[3] > 0.3;
    if (a >= W * H * 0.004 && ((bg[3] > 0.5 && cs.backgroundColor !== bodyBg) || border)) mark(P, r);
  }
  const bits = (g) => [...g].join('');
  return { T: bits(T), P: bits(P), M: bits(M), groundLum: lum(ground), ground: `rgb(${ground.slice(0, 3)})` };
}

const jac = (a, b) => { let i = 0, u = 0; for (let k = 0; k < a.length; k++) { const x = a[k] === '1', y = b[k] === '1'; if (x || y) u++; if (x && y) i++; } return u ? i / u : null; };
const sim = (a, b) => { let s = 0, w = 0; for (const [k, wt] of [['T', 0.45], ['P', 0.4], ['M', 0.15]]) { const j = jac(a[k], b[k]); if (j != null) { s += j * wt; w += wt; } } return w ? s / w : 0; };

const browser = await pw.chromium.launch(), res = [];
await Promise.all(targets.map(async (t, i) => {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const [fp, q] = t.split('?'), u = new URL(/^https?:|^file:/.test(t) ? t : pathToFileURL(resolve(fp)).href + (q ? '?' + q : ''));
  if (!u.searchParams.has('lang')) u.searchParams.set('lang', lang); u.searchParams.set('shot', '1');
  try { await page.goto(u.href, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1200); res[i] = { name: basename(fp) + (q ? '?' + q : ''), ...(await page.evaluate(SKELETON, { cols: 24, rows: 15 })) }; }
  catch (e) { res[i] = { name: basename(fp), error: String(e.message || e).split('\n')[0] }; } finally { await page.close(); }
}));
await browser.close();

const ok = res.filter((r) => !r.error), pairs = [], out = [];
for (let i = 0; i < ok.length; i++) for (let j = i + 1; j < ok.length; j++) pairs.push({ a: ok[i].name, b: ok[j].name, s: sim(ok[i], ok[j]) });
pairs.sort((x, y) => y.s - x.s);
const same = pairs.filter((p) => p.s >= MAX);
for (const p of same) out.push(`FAIL same-skeleton: ${p.a} and ${p.b} put text and panels in the same places (${p.s.toFixed(2)}, max ${MAX}); change the mechanic and the layout, not the ornament`);
if (ok.length >= 3 && new Set(ok.map((r) => r.ground)).size === 1) out.push(`WARN one-ground: every concept sits on ${ok[0].ground}`);
for (const r of res.filter((r) => r.error)) out.push(`FAIL ${r.name}: ${r.error}`);
if (asJson) console.log(JSON.stringify({ pairs, concepts: ok.map(({ name, ground, groundLum }) => ({ name, ground, groundLum })), findings: out }, null, 1));
else {
  console.log(`${ok.length} concept(s) at ${W}x${H} in ${lang}. Most alike first:`);
  for (const p of pairs.slice(0, 8)) console.log(`  ${p.s.toFixed(2)}  ${p.a}  ${p.b}`);
  for (const l of out) console.log(l);
}
const fails = out.filter((l) => l.startsWith('FAIL')).length;
console.log(`${fails} failing check(s). Different numbers are not enough: the mechanic must differ too.`);
process.exit(fails ? 1 : 0);
