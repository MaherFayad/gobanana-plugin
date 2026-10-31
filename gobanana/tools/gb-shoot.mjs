// gb-tools v8: bump it in every script and the fetch line on any change.
// gb-shoot: every render-loop shot in one browser in one language; states with --states; upload-<lang>-full.jpg for the board.
//   node gb-shoot.mjs <file.html|url> [--out dir] [--tokens t.json] [--languages en] [--viewport 390x844] [--states a,b] [--no-worst] [--landing] [--variants 3]
import { guard } from './gb-guard.mjs';
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process'; import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path'; import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf('--' + n); return i < 0 ? null : args.splice(i, 2)[1]; };
const flag = (n) => { const i = args.indexOf('--' + n); if (i < 0) return false; args.splice(i, 1); return true; };
const urlFor = { ar: opt('ar'), en: opt('en') }, tp = opt('tokens'), tokens = tp ? JSON.parse(readFileSync(tp, 'utf8')) : null;
const list = (v) => String(v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const langArg = list(opt('languages')), tokenLangs = Array.isArray(tokens?.languages) ? list(tokens.languages.join(',')) : [];
const langGiven = langArg.length > 0 || !!tokens?.primaryLanguage || tokenLangs.length > 0;
let languages = [...new Set(langArg.length ? langArg : [String(tokens?.primaryLanguage || tokenLangs[0] || 'en').toLowerCase()])];
const noWorst = flag('no-worst'), landing = flag('landing') || tokens?.landing === true;
const out = resolve(opt('out') || join(process.env.TMPDIR || '/tmp', 'gb', 'shots')), asked = opt('lang');
const vpArg = []; for (let v; (v = opt('viewport')) !== null;) vpArg.push(v);
const variants = Number(opt('variants') || 0), statesArg = opt('states'), target = args[0];
if (!target && !languages.every((l) => urlFor[l])) { console.error('usage: node gb-shoot.mjs <file.html|url> [--out dir] [--tokens tokens.json] [--languages en] [--viewport 390x844] [--states empty,loading,error] [--no-worst] [--landing] [--variants 3]'); process.exit(2); }
const nearTokens = (src) => { try { if (/^https?:|^file:/.test(src)) return null; return JSON.parse(readFileSync(join(dirname(resolve(src.split('?')[0])), 'tokens.json'), 'utf8')); } catch { return null; } };
const vpList = (v) => (Array.isArray(v) ? v : [v]).flatMap((x) => String(x || '').split(',')).map((s) => s.trim()).filter(Boolean);
const viewports = (vpArg.length ? vpList(vpArg) : vpList(tokens?.viewports ?? (target ? nearTokens(target)?.viewports : null))).map((s) => { const m = /^(\d{3,4})x(\d{3,4})$/.exec(s); if (!m) { console.error(`--viewport takes WIDTHxHEIGHT, for example 390x844 (got "${s}")`); process.exit(2); } return [+m[1], +m[2]]; }).sort((a, b) => a[0] - b[0]);
if (!viewports.length) viewports.push([390, 844], [1440, 900]);
const [sw, sh] = viewports[0], [ww] = viewports[viewports.length - 1]; // states, markers and variants at the smallest view; the whole page at the widest
const kebab = (s) => String(s).trim().replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
// Only the states asked with --states
const SELF = ['default', 'idle'], ACT = ['hover', 'focus', 'focus-visible', 'active', 'pressed', 'moving', 'dragging'], allStates = [...new Set((statesArg || '').split(',').map(kebab).filter(Boolean))];
const states = allStates.filter((s) => !SELF.includes(s) && !ACT.includes(s)), itemStates = new Set((Array.isArray(tokens?.mechanic?.itemStates) ? tokens.mechanic.itemStates : []).map(kebab));
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = createRequire(join(execSync('npm root -g').toString().trim(), '_'))('playwright'); }
mkdirSync(out, { recursive: true });

const url = (lang, params) => {
  const src = urlFor[lang] || target, [fp, q] = src.split('?');
  const u = new URL(/^https?:|^file:/.test(src) ? src : pathToFileURL(resolve(fp)).href + (q ? '?' + q : ''));
  if (!urlFor[lang]) u.searchParams.set('lang', lang);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('shot', '1'); return u.href;
};
const browser = guard(await pw.chromium.launch()), failed = [], figFails = [];
// No --languages and no tokens
if (!langGiven && target) try { const [fp, q] = target.split('?'), p = await browser.newPage(); await p.goto(/^https?:|^file:/.test(target) ? target : pathToFileURL(resolve(fp)).href + (q ? '?' + q : ''), { waitUntil: 'load' }); const l = (await p.evaluate(() => document.documentElement.lang || '')).trim().toLowerCase().split(/[-_]/)[0]; await p.close(); if (/^[a-z]{2,3}$/.test(l)) languages = [l]; } catch {}
const first = asked && languages.includes(asked) ? asked : languages[0], order = [first, ...languages.filter((l) => l !== first)], others = order.slice(1);
// The whole page as one JPEG for the board
const MAX_H = 2000, CAP = 3 * 1024 * 1024;
const fullJpeg = async (png) => { const w = png.readUInt32BE(16), h = png.readUInt32BE(20), k = Math.min(1, MAX_H / h), tw = Math.max(1, Math.round(w * k)), th = Math.max(1, Math.round(h * k)), p = await browser.newPage();
  try { const b64 = await p.evaluate(async ({ src, tw, th }) => { const img = new Image(); img.src = src; await img.decode(); const c = Object.assign(document.createElement('canvas'), { width: tw, height: th }), x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, tw, th); for (const q of [0.82, 0.72, 0.62, 0.5]) { const d = c.toDataURL('image/jpeg', q).split(',')[1]; if (d.length * 0.75 <= 900 * 1024 || q === 0.5) return d; } }, { src: 'data:image/png;base64,' + png.toString('base64'), tw, th });
    return { jpg: Buffer.from(b64, 'base64'), w: tw, h: th }; } finally { await p.close(); } };
// The smallest default view first: marker states
const FIGURE = ({ px = 0, list = [] } = {}) => {
  const vis = (e) => { const r = e.getBoundingClientRect(), cs = getComputedStyle(e); return r.width >= 1 && r.height >= 1 && cs.visibility !== 'hidden' && +cs.opacity > 0.05 && !e.closest('[hidden],.gb-switch'); };
  const num = (t) => /\d/.test(t) && t.replace(/[\d\s.,:%+\-\u2212/()]/g, '').length <= 3;
  const tagged = [...document.querySelectorAll('[data-figure]')].filter(vis), nums = [...document.querySelectorAll('body *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim()) && vis(e) && num(e.textContent.trim())).map((e) => ({ e, size: parseFloat(getComputedStyle(e).fontSize) })).sort((a, b) => b.size - a.size);
  const fig = tagged[0] ? { e: tagged[0], size: parseFloat(getComputedStyle(tagged[0]).fontSize) } : nums[0] && nums[0].size >= Math.max(32, px * 0.8) ? nums[0] : null;
  const box = (e) => { const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; };
  const named = (document.documentElement.dataset.itemStates || '').split(',').map((x) => x.trim()).filter(Boolean), markers = {};
  for (const id of list) { const e = [...document.querySelectorAll(`body [data-status="${id}"], body [data-state="${id}"]`)].find(vis); if (e) markers[id] = box(e); }
  let stale = !!fig?.e.closest('[data-stale]'); for (let a = fig?.e, d = 0; a && d < 3 && !stale; a = a.parentElement, d++) stale = /\bas of\b|last (known|updated)|آخر (قيمة|تحديث)|حتى الساعة|كما في|\b\d{1,2}:\d{2}\b/i.test(a.innerText || '');
  return { tagged: !!tagged[0], figure: fig && /\d/.test(fig.e.textContent) ? { text: fig.e.textContent.trim().slice(0, 24), px: Math.round(fig.size), stale } : null, named, markers };
};
const probe = await (async () => { const page = await browser.newPage({ viewport: { width: sw, height: sh } }); try { await page.goto(url(first, {}), { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1500); return await page.evaluate(FIGURE, { list: states }); } catch { return { figure: null, named: [], markers: {} }; } finally { await page.close(); } })();
for (const id of probe.named) itemStates.add(kebab(id));
const isItem = (s) => itemStates.has(s) || !!probe.markers[s], markerStates = states.filter((s) => isItem(s) && probe.markers[s]);
const shots = [];
for (const lang of order) for (const [w, h] of viewports) shots.push({ file: `view-${lang}-${w}`, lang, w, h, params: {}, upload: `upload-${lang}-${w}.jpg` });
for (const lang of order) for (const [w, h] of viewports) shots.push({ file: `full-${lang}-${w}`, lang, w, h, params: {}, full: true, ...(w === ww ? { fullUpload: `upload-${lang}-full.jpg` } : {}) });
for (const s of states.filter((x) => !markerStates.includes(x))) shots.push({ file: `state-${s}`, lang: first, w: sw, h: sh, params: { state: s }, sheet: true, item: isItem(s) });
for (const s of markerStates) shots.push({ file: `marker-${s}`, lang: first, w: sw, h: sh, params: {}, marker: probe.markers[s] });
if (!noWorst && !landing) shots.push({ file: 'worst', lang: first, w: sw, h: sh, params: { data: 'worst' }, sheet: true });
if (states.includes('error')) for (const lang of others) shots.push({ file: `state-error-${lang}`, lang, w: sw, h: sh, params: { state: 'error' }, sheet: true });
for (let v = 1; v <= variants; v++) for (const lang of order) shots.push({ file: `v${v}-${lang}-${sw}`, lang, w: sw, h: sh, params: { v: String(v) } });

const take = async (s) => {
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h } });
  try {
    await page.goto(url(s.lang, s.params), { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1500);
    if (/^(loading|error)$/.test(s.params.state || '')) { const f = (await page.evaluate(FIGURE, { px: probe.tagged ? 0 : probe.figure?.px || 9999 })).figure; if (f && (probe.figure || probe.tagged) && !(s.params.state === 'error' && f.stale)) figFails.push(`${s.file} still shows the figure "${f.text}" (${f.px}px)`); }
    const m = s.marker, pad = 24, clip = m && { x: Math.max(0, m.x - pad), y: Math.max(0, m.y - pad), width: Math.min(s.w, m.width + 2 * pad), height: m.height + 2 * pad };
    s.png = await page.screenshot({ path: join(out, s.file + '.png'), fullPage: !!s.full || !!m, ...(m ? { clip } : {}) });
    // A change can sit below the fold: compare the full page too
    if (s.sheet) s.fullPng = await page.screenshot({ fullPage: true });
    if (s.upload) for (const quality of [82, 72, 62, 50]) { const jpg = await page.screenshot({ type: 'jpeg', quality }); if (jpg.length <= 900 * 1024 || quality === 50) { writeFileSync(join(out, s.upload), jpg); s.jpgKB = Math.round(jpg.length / 1024); break; } }
    if (s.fullUpload) { const f = await fullJpeg(s.png); writeFileSync(join(out, s.fullUpload), f.jpg); s.fullKB = Math.round(f.jpg.length / 1024); s.fullSize = `${f.w}x${f.h}`; }
  } catch (e) { failed.push(`${s.file}: ${String(e.message || e).split('\n')[0]}`); s.missing = true; } finally { await page.close(); }
};
for (let i = 0; i < shots.length; i += 4) await Promise.all(shots.slice(i, i + 4).map(take));

// Contact sheets: 8 state shots a sheet
const tiles = shots.filter((s) => s.sheet && !s.missing), sheets = [], marks = shots.filter((s) => s.marker && !s.missing);
if (marks.length) {
  const html = join(out, 'sheet-markers.html');
  writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#fff;font:600 15px system-ui;color:#111;display:flex;flex-wrap:wrap;align-items:flex-start;gap:16px;padding:16px;width:1200px}figure{margin:0}img{display:block;outline:1px solid #ccc}figcaption{padding:6px 0}</style>${marks.map((s) => `<figure><figcaption>${s.file}</figcaption><img src="${s.file}.png"></figure>`).join('')}`);
  const page = await browser.newPage({ viewport: { width: 1232, height: 600 } });
  await page.goto(pathToFileURL(html).href, { waitUntil: 'load' }); await page.screenshot({ path: join(out, 'sheet-markers.png'), fullPage: true }); await page.close();
  sheets.push({ file: 'sheet-markers', holds: marks.map((s) => s.file) });
}
for (let i = 0; i < tiles.length; i += 8) {
  const part = tiles.slice(i, i + 8), n = i / 8 + 1, html = join(out, `sheet-${n}.html`);
  writeFileSync(html, `<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#fff;font:600 15px system-ui;color:#111;display:grid;grid-template-columns:repeat(4,390px);gap:16px;padding:16px;width:max-content}figure{margin:0}img{display:block;width:390px;height:${Math.round(390 * sh / sw)}px;outline:1px solid #ccc}figcaption{padding:6px 0}</style>${part.map((s) => `<figure><figcaption>${s.file}</figcaption><img src="${s.file}.png"></figure>`).join('')}`);
  const page = await browser.newPage({ viewport: { width: 1640, height: 900 } });
  await page.goto(pathToFileURL(html).href, { waitUntil: 'load' }); await page.screenshot({ path: join(out, `sheet-${n}.png`), fullPage: true }); await page.close();
  sheets.push({ file: `sheet-${n}`, holds: part.map((s) => s.file) });
}
await browser.close();

const ok = shots.filter((s) => !s.missing), path = (f) => join(out, f + '.png');
console.log(`${ok.length} of ${shots.length} shots in ${out}`);
console.log('Look at each: ' + ok.filter((s) => !s.sheet && !s.marker).map((s) => path(s.file)).join(' '));
for (const s of sheets) console.log(`Sheet ${path(s.file)}: ${s.holds.join(', ')}`);
const ups = ok.filter((s) => s.upload && s.jpgKB), fulls = ok.filter((s) => s.fullUpload && s.fullKB);
if (landing && fulls.length) console.log(`Upload to the board (get_upload_link): ${fulls.map((s) => `${join(out, s.fullUpload)} (${s.fullKB} KB)`).join(' ')}; a landing page places its whole page`);
else if (ups.length) console.log(`Upload to the board (get_upload_link): ${ups.map((s) => `${join(out, s.upload)} (${s.jpgKB} KB)`).join(' ')}; the platform's main size first`);
if (!landing) for (const s of fulls) console.log(`Whole page at ${ww}: ${join(out, s.fullUpload)} (${s.fullSize}, ${s.fullKB} KB)`);
for (const s of [...(landing ? [] : ups), ...(landing ? fulls : [])]) { const kb = s.fullKB ?? s.jpgKB, f = s.fullUpload ?? s.upload; if (kb * 1024 > CAP) console.log(`WARN ${f} is ${kb} KB, over the board's 3 MB: it will be refused; shoot a shorter page`); else if (kb > 900) console.log(`WARN ${f} is ${kb} KB, over the 900 KB get_snapshot can show; the board still takes it (3 MB), but nobody can look at it there`); }
const self = allStates.filter((s) => SELF.includes(s)), act = allStates.filter((s) => ACT.includes(s));
if (self.length || act.length) console.log(`Not shot: ${[self.length ? `${self.join(', ')} (the default view itself)` : '', act.length ? `${act.join(', ')} (interaction states one element takes under a pointer, a key or a drag, not page states behind ?state=: gb-probe shows focus, look at the rest by hand)` : ''].filter(Boolean).join('; ')}`);
// A marker state no element showed: shot as a page state
const base = (lang) => ok.find((s) => s.file === `full-${lang}-${sw}`)?.png;
const same = ok.filter((s) => s.sheet && s.fullPng && base(s.lang)?.equals(s.fullPng)), wired = same.filter((s) => !s.item && s.file !== 'worst').map((s) => s.file);
// ?data=worst was not asked for: an unwired one is said
if (same.some((s) => s.file === 'worst')) console.log('WARN worst: ?data=worst looks like the default view; wire worst case data behind it (long names, big numbers, empty fields), or pass --no-worst on a page with no data (a landing page, a rough screen)');
for (const s of same.filter((x) => x.item)) console.log(`WARN ${s.file}: a marker state no element of the default view shows (data-status="${s.params.state}"); its page shot looks like the default view`);
if (wired.length) console.log(`FAIL same as the default view, so the switch is not wired: ${wired.join(', ')}`);
for (const f of figFails) console.log(`FAIL hero-figure: ${f}; show a placeholder while loading; on error say what failed and grey the last known figure with its time beside it ("as of 09:40", or data-stale on its wrapper), never a bare stale number or a dash`);
for (const f of failed) console.log('FAIL ' + f);
process.exit(failed.length || wired.length || figFails.length ? 1 : 0);
