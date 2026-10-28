// gb-tools v1: a fetch line refetches a cached copy without this tag. Bump it in every script and fetch line when any script changes.
// gb-compare: do a board's drafts look alike? Each at 1440x900 (default view, &shot=1) in its one language.
//   node gb-compare.mjs <a.html|url> <b.html|url> [more] [--tokens a.json[,b.json...]] [--languages en] [--same-direction] [--out dir] [--json]
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process'; import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path'; import { pathToFileURL } from 'node:url';

export const LIMITS = { groundDE: 12, largestPx: 8, header: 4, tells: 3 };

// sRGB 0 to 255 to OKLab (Ottosson); dE is the OKLab distance times 100.
export function oklab([r, g, b]) {
  const f = (x) => ((x /= 255) <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4), [R, G, B] = [f(r), f(g), f(b)];
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
export const groundDE = (a, b) => { if (!a || !b) return null; const [x, y] = [oklab(a), oklab(b)]; return Math.round(Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) * 1000) / 10; };
// Shared header cells, each counted once.
export const headerOverlap = (a = [], b = []) => { const left = [...b]; let n = 0; for (const c of a) { const i = left.indexOf(c); if (i >= 0) { left.splice(i, 1); n++; } } return n; };
const same = (a, b) => !!a && !!b && a.toLowerCase() === b.toLowerCase();
export function tells(a, b) {
  const de = groundDE(a.ground?.rgb, b.ground?.rgb), dl = a.largestPx != null && b.largestPx != null ? Math.abs(a.largestPx - b.largestPx) : null, ho = headerOverlap(a.header, b.header);
  const t = {
    ground: { value: de, hit: de != null && de < LIMITS.groundDE },
    // Faces are shown, never counted: every direction takes the taste's type voice.
    body: { value: same(a.bodyFace, b.bodyFace) ? a.bodyFace : `${a.bodyFace} / ${b.bodyFace}`, same: same(a.bodyFace, b.bodyFace) },
    display: { value: same(a.displayFace, b.displayFace) ? a.displayFace : `${a.displayFace} / ${b.displayFace}`, same: same(a.displayFace, b.displayFace) },
    largest: { value: dl, hit: dl != null && dl <= LIMITS.largestPx },
    header: { value: ho, hit: ho >= LIMITS.header },
  };
  const count = Object.values(t).filter((x) => x.hit).length;
  return { tells: t, count, verdict: count >= LIMITS.tells ? 'FAIL' : 'ok' };
}
export function comparePairs(looks, directionOf = {}) {
  const names = [...new Set(looks.map((l) => l.name))], pairs = [], ok = (l) => !l.error && !l.skipped;
  const dir = (n) => directionOf[n] || looks.find((l) => l.name === n && l.direction)?.direction || null;
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const per = looks.filter((l) => l.name === names[i] && ok(l)).map((a) => [a, looks.find((b) => b.name === names[j] && b.lang === a.lang && ok(b))]).filter(([, b]) => b).map(([a, b]) => ({ lang: a.lang, ...tells(a, b) }));
    if (!per.length) continue; const worst = [...per].sort((x, y) => y.count - x.count)[0], one = !!dir(names[i]) && dir(names[i]) === dir(names[j]);
    pairs.push({ a: names[i], b: names[j], lang: worst.lang, count: worst.count, verdict: one ? 'same-direction' : worst.verdict, ...(one ? { direction: dir(names[i]) } : {}), tells: worst.tells, langs: per.map((p) => ({ lang: p.lang, count: p.count })) });
  }
  return pairs.sort((x, y) => y.count - x.count);
}

function LOOK() {
  const W = innerWidth, H = innerHeight, html = document.documentElement;
  const cx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#0000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const hex = (c) => '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
  const skip = (e) => e.closest('script,style,noscript,template,[hidden],[inert],[aria-hidden="true"],.gb-switch,.sr-only,.visually-hidden');
  const opac = (e) => { let o = 1; for (let p = e; p && p !== html; p = p.parentElement) o *= +getComputedStyle(p).opacity; return o; };
  // The face that draws a text: a generic, a loaded web font covering it, or an installed font.
  const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|math)$/i, faces = [...document.fonts];
  const ranges = (s) => String(s || 'U+0-10FFFF').split(',').map((r) => { const m = r.trim().replace(/^U\+/i, ''); if (m.includes('?')) return [parseInt(m.replace(/\?/g, '0'), 16), parseInt(m.replace(/\?/g, 'F'), 16)]; const [a, b] = m.split('-'); return [parseInt(a, 16), parseInt(b ?? a, 16)]; });
  const sysOk = new Map(), installed = (fam) => { if (!sysOk.has(fam)) { const w = (f) => { cx.font = `40px ${f}`; return cx.measureText('mmmwwwlli 0123').width; }; sysOk.set(fam, ['monospace', 'serif'].some((g) => w(`"${fam}", ${g}`) !== w(g))); } return sysOk.get(fam); };
  const faceOf = (stack, text) => {
    const ch = [...text].find((c) => /[\p{L}\p{N}]/u.test(c)) || 'a', cp = ch.codePointAt(0);
    for (const raw of stack.split(',')) {
      const fam = raw.trim().replace(/^["']|["']$/g, ''); if (!fam) continue;
      if (GENERIC.test(fam)) return fam.toLowerCase();
      const mine = faces.filter((f) => f.family.replace(/["']/g, '').toLowerCase() === fam.toLowerCase());
      if (mine.length) { if (mine.some((f) => f.status === 'loaded' && ranges(f.unicodeRange).some(([a, b]) => cp >= a && cp <= b))) return fam; continue; }
      if (installed(fam)) return fam;
    }
    return 'default';
  };
  // Visible text runs by element; first: on the first screen.
  const rg = document.createRange(), map = new Map(), tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const t = n.nodeValue.replace(/\s+/g, ' ').trim(), el = n.parentElement; if (!t || !el || skip(el)) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden') continue;
    rg.selectNodeContents(n); const rs = [...rg.getClientRects()].filter((r) => r.width >= 1 && r.height >= 1); if (!rs.length) continue;
    const e = map.get(el) || { el, cs, text: '', rects: [], size: parseFloat(cs.fontSize), op: opac(el) }; e.text += (e.text ? ' ' : '') + t; e.rects.push(...rs); map.set(el, e);
  }
  const onFirst = (r) => r.bottom > 0 && r.top < H && r.right > 0 && r.left < W;
  const T = [...map.values()].filter((e) => e.op >= 0.1), first = T.filter((e) => e.rects.some(onFirst));
  const big = first.filter((e) => e.text.length >= 2 || /\d/.test(e.text)).sort((a, b) => b.size - a.size)[0];
  const h1 = [...document.querySelectorAll('h1')].find((h) => { const r = h.getBoundingClientRect(); return r.width >= 1 && r.height >= 1 && getComputedStyle(h).visibility !== 'hidden' && !skip(h); });
  const shown = (h1 && T.find((e) => h1.contains(e.el))) || big;
  const tally = new Map(); for (const e of T) { if (e.el.closest('h1,h2,h3,h4,h5,h6,[role="heading"]') || e.size >= 24 || e.size < 12) continue; const f = faceOf(e.cs.fontFamily, e.text); tally.set(f, (tally.get(f) || 0) + e.text.length); }
  const bodyFace = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  // The ground: 16 x 10 points, each the nearest painted box of a quarter screen or more.
  const paintOf = (e) => {
    const cs = getComputedStyle(e), bg = rgba(cs.backgroundColor), under = bg[3] > 0 ? bg : [255, 255, 255, 1];
    if (/gradient\(/.test(cs.backgroundImage)) { const stops = (cs.backgroundImage.match(/(?:rgba?|hsla?|oklch|oklab|lab|lch|color)\([^()]*\)|#[0-9a-f]{3,8}\b/gi) || []).map(rgba); if (stops.length) return { rgb: [0, 1, 2].map((i) => stops.reduce((s, c) => s + c[i] * c[3] + under[i] * (1 - c[3]), 0) / stops.length), kind: 'gradient' }; }
    if (bg[3] > 0.5) return { rgb: bg.slice(0, 3), kind: 'colour' };
    if (cs.backgroundImage !== 'none') return { rgb: null, kind: 'image' };
    return null;
  };
  const root = paintOf(document.body) || paintOf(html) || { rgb: [255, 255, 255], kind: 'default' }, votes = new Map();
  for (let i = 0; i < 16; i++) for (let j = 0; j < 10; j++) {
    let won = 'page';
    for (let e = document.elementFromPoint((i + 0.5) * W / 16, (j + 0.5) * H / 10); e && e !== document.body && e !== html; e = e.parentElement) {
      const r = e.getBoundingClientRect(), a = Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0));
      if (a >= W * H * 0.25 && paintOf(e)) { won = e; break; }
    }
    votes.set(won, (votes.get(won) || 0) + 1);
  }
  const [gEl, gVotes] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0], gPaint = gEl === 'page' ? root : paintOf(gEl);
  const sel = (e) => e === 'page' ? 'page' : e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : '');
  // Header signature: the first 6 text or control elements, as cells.
  const CTL = 'a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=link],[role=tab],[role=switch],[role=checkbox]';
  const items = new Set(); for (const e of first) items.add(e.el.closest(CTL) || e.el);
  for (const c of document.querySelectorAll(CTL)) { if (skip(c) || getComputedStyle(c).visibility === 'hidden' || opac(c) < 0.1) continue; const r = c.getBoundingClientRect(); if (r.width >= 1 && r.height >= 1 && onFirst(r)) items.add(c); }
  const boxes = [...items].map((e) => e.getBoundingClientRect()).filter((r) => r.width >= 1 && onFirst(r)).sort((a, b) => Math.round(a.top / 8) - Math.round(b.top / 8) || a.left - b.left);
  const header = boxes.slice(0, 6).map((r) => `${Math.min(11, Math.max(0, Math.floor((r.left + r.width / 2) / W * 12)))},${Math.min(17, Math.max(0, Math.floor((r.top + Math.min(r.height, 48) / 2) / H * 18)))}`);
  return {
    lang: html.lang, dir: getComputedStyle(html).direction, direction: html.dataset.direction || document.body.dataset.direction || document.querySelector('meta[name="gb-direction"]')?.content || null,
    ground: { rgb: gPaint.rgb ? gPaint.rgb.map(Math.round) : null, hex: gPaint.rgb ? hex(gPaint.rgb) : null, kind: gPaint.kind, from: sel(gEl), share: Math.round(gVotes / 1.6) / 100 },
    displayFace: shown ? faceOf(shown.cs.fontFamily, shown.text) : null, bodyFace,
    h1Px: h1 ? Math.round(parseFloat(getComputedStyle(h1).fontSize)) : null, largestPx: big ? Math.round(big.size) : null, header,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (n, d) => { const i = args.indexOf('--' + n); return i < 0 ? d : args.splice(i, 2)[1]; };
  const flag = (n) => { const i = args.indexOf('--' + n); if (i < 0) return false; args.splice(i, 1); return true; };
  const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean), tokenFiles = list(opt('tokens', '')).map((f) => resolve(f)), langArg = list(opt('languages', '')).map((l) => l.toLowerCase());
  const outDir = resolve(opt('out', join(process.env.TMPDIR || '/tmp', 'gb'))), asJson = flag('json'), sameAll = flag('same-direction'), targets = args;
  if (targets.length < 2 || (tokenFiles.length > 1 && tokenFiles.length !== targets.length)) { console.error('usage: node gb-compare.mjs <a.html|url> <b.html|url> [more] [--tokens a.json[,b.json...] (one, or one per draft)] [--languages en] [--same-direction] [--out dir] [--json]'); process.exit(2); }
  const tokens = tokenFiles.map((f) => JSON.parse(readFileSync(f, 'utf8')));
  // ONE language: --languages, else the first draft's tokens language, else English.
  const tokenFirst = [...new Set(tokens.map((t) => String(t.primaryLanguage || (Array.isArray(t.languages) ? t.languages[0] : '') || '').toLowerCase()).filter(Boolean))];
  const languages = langArg.length ? langArg.slice(0, 1) : tokenFirst.length ? tokenFirst.slice(0, 1) : ['en'];
  const req = createRequire(import.meta.url);
  let pw; try { pw = req('playwright'); } catch { pw = createRequire(join(execSync('npm root -g').toString().trim(), '_'))('playwright'); }
  // A draft's name: its file name, or its folder's for index.html.
  const nameOf = (t) => { const p = t.split('?')[0].replace(/\/$/, ''), b = basename(p); return /^index\.html?$/i.test(b) ? basename(dirname(p)) : b; };
  const names = targets.map(nameOf).map((n, i, all) => (all.indexOf(n) === i ? n : `${n}-${i + 1}`));
  const directionOf = Object.fromEntries(names.map((n, i) => [n, sameAll ? 'all' : tokenFiles.length ? (tokenFiles.length === 1 ? 'tokens:' + tokenFiles[0] : tokens[i].direction ? 'direction:' + tokens[i].direction : 'tokens:' + tokenFiles[i]) : null]).filter(([, d]) => d));
  const jobs = targets.flatMap((t, i) => languages.map((lang) => ({ t, name: names[i], lang })));
  const browser = await pw.chromium.launch(), looks = [];
  const run = async (j) => {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const [fp, q] = j.t.split('?'), u = new URL(/^https?:|^file:/.test(j.t) ? j.t : pathToFileURL(resolve(fp)).href + (q ? '?' + q : ''));
    u.searchParams.set('lang', j.lang); u.searchParams.set('shot', '1');
    try { await page.goto(u.href, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1200); const look = await page.evaluate(LOOK); looks.push({ name: j.name, target: j.t, ...look, ...(String(look.lang || '').toLowerCase().startsWith(j.lang) ? {} : { skipped: `?lang=${j.lang} left <html lang="${look.lang}">: no ${j.lang} version` }), lang: j.lang }); }
    catch (e) { looks.push({ name: j.name, target: j.t, lang: j.lang, error: String(e.message || e).split('\n')[0] }); } finally { await page.close(); }
  };
  for (let i = 0; i < jobs.length; i += 4) await Promise.all(jobs.slice(i, i + 4).map(run));
  await browser.close();
  looks.sort((a, b) => names.indexOf(a.name) - names.indexOf(b.name) || languages.indexOf(a.lang) - languages.indexOf(b.lang));
  const pairs = comparePairs(looks, directionOf), findings = [];
  const why = (t) => [t.ground.hit && `ground dE ${t.ground.value}`, t.largest.hit && `largest text ${t.largest.value}px apart`, t.header.hit && `header shares ${t.header.value} of 6 cells`].filter(Boolean).join(', ');
  for (const p of pairs.filter((x) => x.verdict === 'FAIL')) findings.push(`FAIL too-alike: ${p.a} and ${p.b} share ${p.count} of 3 tells in ${p.lang} (${why(p.tells)}); set them apart by composition and the signature viz, within each draft's own tokens (never by swapping fonts or colours), never copy the other`);
  for (const l of looks.filter((x) => x.error)) findings.push(`FAIL ${l.name} (${l.lang}): ${l.error}`);
  for (const n of names) if (looks.filter((l) => l.name === n).every((l) => l.skipped || l.error) && looks.some((l) => l.name === n && l.skipped)) findings.push(`FAIL ${n}: no language rendered (${looks.find((l) => l.name === n && l.skipped).skipped}); pass --languages or --tokens`);
  const fails = findings.length, summary = { tool: 'gb-compare', version: 2, at: new Date().toISOString(), viewport: [1440, 900], languages, limits: LIMITS, fails, drafts: looks, pairs, findings };
  const jsonPath = join(outDir, 'compare.json');
  try { mkdirSync(outDir, { recursive: true }); writeFileSync(jsonPath, JSON.stringify(summary, null, 1)); } catch (e) { console.error('could not write ' + jsonPath + ': ' + e.message); }
  if (asJson) console.log(JSON.stringify(summary, null, 1));
  else {
    const pad = (s, n) => String(s ?? '-').slice(0, n).padEnd(n), w = Math.max(8, ...names.map((n) => n.length)) + 1;
    console.log(`${names.length} draft(s) at 1440x900, ${languages.join(' and ')}:`);
    console.log(`${pad('draft', w)}${pad('lang', 5)}${pad('ground', 9)}${pad('display face', 23)}${pad('body face', 23)}${pad('h1', 5)}${pad('largest', 8)}header`);
    for (const l of looks) console.log(l.error ? `${pad(l.name, w)}${pad(l.lang, 5)}error: ${l.error}` : l.skipped ? `${pad(l.name, w)}${pad(l.lang, 5)}skipped: ${l.skipped}` : `${pad(l.name, w)}${pad(l.lang, 5)}${pad(l.ground.hex ?? l.ground.kind, 9)}${pad(l.displayFace, 23)}${pad(l.bodyFace, 23)}${pad(l.h1Px, 5)}${pad(l.largestPx, 8)}${l.header.join(' ')}`);
    const mark = (x, s) => `${s}${x.hit ? '*' : ''}`;
    console.log(`\nPairs, most alike first (* is a tell; ${LIMITS.tells} or more FAIL; same direction: versions of one direction, never FAIL):`);
    console.log(`${pad('pair', 2 * w + 3)}${pad('lang', 5)}${pad('ground dE', 10)}${pad('body', 7)}${pad('display', 8)}${pad('largest', 8)}${pad('header', 7)}tells`);
    for (const p of pairs) console.log(`${pad(`${p.a} / ${p.b}`, 2 * w + 3)}${pad(p.lang, 5)}${pad(mark(p.tells.ground, p.tells.ground.value ?? '-'), 10)}${pad(p.tells.body.same ? 'same' : 'diff', 7)}${pad(p.tells.display.same ? 'same' : 'diff', 8)}${pad(mark(p.tells.largest, p.tells.largest.value == null ? '-' : p.tells.largest.value + 'px'), 8)}${pad(mark(p.tells.header, p.tells.header.value + '/6'), 7)}${p.count} ${p.verdict}${p.verdict === 'same-direction' ? ' (skipped)' : ''}`);
    for (const f of findings) console.log(f);
    console.log(`${fails} failing check(s). Summary: ${jsonPath}`);
  }
  process.exit(fails ? 1 : 0);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
