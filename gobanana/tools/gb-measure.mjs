// gb-measure: render a draft at 390 and 1440 in each language, measure craft and restraint numbers, print FAIL and WARN.
//   node gb-measure.mjs <file.html|url> [--ar <url> --en <url>] [--tokens tokens.json] [--languages ar,en] [--out <dir>]
//     [--work] [--phone] [--states loading,error] [--taste-allows micro-labels] [--json]
// The flags, the budgets and every check with its FAIL and WARN: playbook gobanana-draft/measure-script.
// Adapted from taste-skill scripts/inspect.mjs and scripts/lib/rules.mjs (MIT, github.com/Leonxlnx/taste-skill).
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process'; import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { inflateSync } from 'node:zlib';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf('--' + n); return i < 0 ? null : args.splice(i, 2)[1]; };
const flag = (n) => { const i = args.indexOf('--' + n); if (i < 0) return false; args.splice(i, 1); return true; };
const tp = opt('tokens'), tokens = tp ? JSON.parse(readFileSync(tp, 'utf8')) : null;
const urlFor = { ar: opt('ar'), en: opt('en') }, outDir = opt('out'), list = (v) => String(v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const langArg = list(opt('languages')), tokenLangs = Array.isArray(tokens?.languages) ? list(tokens.languages.join(',')) : [];
const languages = [...new Set(langArg.length ? langArg : tokenLangs.length ? tokenLangs : ['ar', 'en'])];
const allow = [...list(opt('taste-allows')), ...(Array.isArray(tokens?.tasteAllows) ? tokens.tasteAllows.map(String) : [])];
const work = flag('work'), asJson = flag('json'), dense = tokens?.density?.level === 'dense', phoneFirst = flag('phone') || /mobile|phone|ios|android/i.test(String(tokens?.platform || ''));
const kebab = (s) => String(s).trim().replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
const stateIds = list(opt('states')).map(kebab).filter((s) => !/^(default|idle|hover|focus|focus-visible|active|pressed|moving|dragging)$/.test(s)), target = args[0];
const hazeOk = /gradient|aurora|glow|haze|mesh|neon|bloom|iridescen|holograph/i.test([].concat(tokens?.taste ?? [], tokens?.groundCss ?? '').map((x) => x?.word ?? x).join(' ')) || allow.includes('ground-haze');
const px = (v) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : null; }, display = px(tokens?.type?.display), heroFigurePx = px(tokens?.type?.heroFigure);
const scale = String(tokens?.look?.scale || '').toLowerCase() || null;
const heroFigure = !!heroFigurePx || (Array.isArray(tokens?.heroDevices) ? tokens.heroDevices : []).some((d) => String(d?.id ?? d) === 'hero-figure');
const figureAsked = !!heroFigurePx || !!tokens?.mechanic?.figure; // the tokens name an answer figure
const heroAsked = figureAsked || !!tokens?.mechanic?.signature; // asks for one [data-viz] hero object
if (!target && !languages.every((l) => urlFor[l])) { console.error('usage: node gb-measure.mjs <file.html|url> [--tokens tokens.json] [--languages ar,en] [--out dir] [--work] [--phone] [--states loading,error] [--taste-allows micro-labels] [--json]'); process.exit(2); }
const fam = (f) => String(f).split(',')[0].replace(/["']/g, '').trim();
const tokenFonts = Object.entries(tokens?.fonts || {}).filter(([, f]) => f).map(([k, f]) => [k, fam(f)]), fonts = [...new Set([...tokenFonts.map(([, f]) => f), ...(tokens?.type?.figureFamily ? [fam(tokens.type.figureFamily)] : [])])];
// On-token: tokens.colors, the picked sketch stage, the hero object's surface and ink, the glass fills.
const glass = tokens?.material?.glass || {}, colors = [...Object.values(tokens?.colors || {}), ...Object.values(tokens?.stage || {}), tokens?.object?.surface, tokens?.object?.ink, glass.panel, glass.panelSolid, glass.backdrop?.color].filter((c) => /^#[0-9a-f]{6}$/i.test(c || ''));
const req = createRequire(import.meta.url), gbDir = join(process.env.TMPDIR || '/tmp', 'gb'), noRender = join(gbDir, '.gb-norender');
// No browser here: mark the machine (the plugin's publish gate reads .gb-norender) and stop. A browser that starts clears the mark.
const cannot = (e) => { try { mkdirSync(gbDir, { recursive: true }); writeFileSync(noRender, `${new Date().toISOString()} ${String(e?.message || e).split('\n')[0]}\n`); } catch {} console.error(`This machine cannot render: ${String(e?.message || e).split('\n')[0]}\nMarked ${noRender}. Show the draft only with every visual item "not checked".`); process.exit(3); };
let pw; try { try { pw = req('playwright'); } catch { pw = createRequire(join(execSync('npm root -g').toString().trim(), '_'))('playwright'); } } catch (e) { cannot(e); }

// Runs inside the page; pasted alone into Playwright MCP browser_evaluate as measure-script says.
function MEASURE({ work, colors = [], fonts = [], want = '', allow = [], dense = false, heroFigure = false, display = null, heroFigurePx = null, scale = null, hazeOk = false, figureAsked = false, heroAsked = false }) {
  const gcs = (e, p) => getComputedStyle(e, p), bcr = (e) => e.getBoundingClientRect(), qsa = (q) => document.body.querySelectorAll(q), qda = (q) => document.querySelectorAll(q);
  const W = innerWidth, H = innerHeight, SY = scrollY, mobile = W < 640, out = [], add = (level, id, msg) => out.push({ level, id, msg });
  const html = document.documentElement, ar = /^ar/.test(html.lang), rtl = gcs(html).direction === 'rtl', advice = '; advice only: the picked composition wins where they clash';
  const cx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#0000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = (c) => { const f = (x) => ((x /= 255) <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
  const sel = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : '');
  const clip = (s) => s.replace(/\s+/g, ' ').trim().slice(0, 40);
  const vis = (e) => { const r = bcr(e); return r.width >= 1 && r.height >= 1 && gcs(e).visibility !== 'hidden'; };
  const txtOf = (e) => String(e?.innerText ?? e?.textContent ?? ''), cls = (e) => String(e?.getAttribute?.('class') || '');
  // Visually hidden (sr-only): clipped, a 1px box, or far off screen.
  const srMemo = new Map(), srOnly = (el) => {
    if (!el || el === document.body || el === html || !(el instanceof Element)) return false; if (srMemo.has(el)) return srMemo.get(el);
    const cs = gcs(el), r = bcr(el), n = (cs.clip.match(/rect\(([^)]*)\)/)?.[1] || '').split(/[\s,]+/).map(parseFloat), ab = /absolute|fixed/.test(cs.position);
    const v = (ab && n.length === 4 && (n[2] - n[0] <= 1 || n[1] - n[3] <= 1)) || /^inset\((50|100)%|^circle\(0/.test(cs.clipPath) || (/hidden|clip/.test(cs.overflowX + cs.overflowY) && (r.width <= 1.5 || r.height <= 1.5)) || parseFloat(cs.textIndent) <= -999 || (ab && (r.right < -999 || r.left > W + 999)) || srOnly(el.parentElement);
    srMemo.set(el, v); return v;
  };
  // The outermost fixed or sticky box around an element, or null.
  const pinMemo = new Map(), pinned = (el) => { if (!el || el === html || el === document.body) return null; if (pinMemo.has(el)) return pinMemo.get(el); const p = gcs(el).position, v = pinned(el.parentElement) || (p === 'fixed' || p === 'sticky' ? el : null); pinMemo.set(el, v); return v; };
  // A window the content moves in: a box that scrolls, or a pan surface; picture: svg and canvas count too.
  const panMemo = new Map(), panBox = (a) => { if (panMemo.has(a)) return panMemo.get(a); const cs = gcs(a), b = bcr(a);
    const v = (/auto|scroll/.test(cs.overflowX) && a.scrollWidth > a.clientWidth + 1) || (/auto|scroll/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1) || a.matches('[data-pan],[data-viz],[role=application]') || /grab|move/.test(cs.cursor) || cs.touchAction === 'none'
      || (/hidden|clip/.test(cs.overflowX + cs.overflowY) && [...a.children].some((k) => { const r = bcr(k); return r.width > b.width * 1.2 + 4 || r.height > b.height * 1.2 + 4; }));
    panMemo.set(a, v); return v; };
  const moving = (el, picture) => { for (let a = el.parentElement; a && a !== document.body && a !== html; a = a.parentElement) if (panBox(a) || (picture && a.matches('svg,canvas'))) return a; return null; };
  // The first screen: the viewport, cut by every scrolling or clipping box around the element.
  const clips = new Map(), clipOf = (el) => { if (!el || el === html || el === document.body) return { top: 0, left: 0, bottom: H, right: W }; if (clips.has(el)) return clips.get(el); const cs = gcs(el); let c = cs.position === 'fixed' ? { top: 0, left: 0, bottom: H, right: W } : clipOf(el.parentElement); if (/(hidden|auto|scroll|clip)/.test(cs.overflowX + cs.overflowY)) { const b = bcr(el); c = { top: Math.max(c.top, b.top), left: Math.max(c.left, b.left), bottom: Math.min(c.bottom, b.bottom), right: Math.min(c.right, b.right) }; } clips.set(el, c); return c; };
  const onFirst = (r, el) => { const c = clipOf(el.parentElement); return r.width >= 1 && r.height >= 1 && r.top < c.bottom - 1 && r.bottom > c.top + 1 && r.left < c.right - 1 && r.right > c.left + 1; };
  const opac = (e) => { let o = 1; for (let p = e; p && p !== html; p = p.parentElement) o *= +gcs(p).opacity; return o; };
  const bgOf = (e) => { const st = []; for (let p = e; p; p = p.parentElement) { const cs = gcs(p); if (cs.backdropFilter && cs.backdropFilter !== 'none' && rgba(cs.backgroundColor)[3] < 0.95) return null; if (cs.backgroundImage !== 'none') return null; const c = rgba(cs.backgroundColor); if (c[3] > 0) { st.push(c); if (c[3] > 0.99) break; } } return st.reverse().reduce((u, t) => over(t, u), [255, 255, 255, 1]); };
  const rg = document.createRange(), linesOf = (el, size) => { const tops = []; const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let n = tw.nextNode(); n; n = tw.nextNode()) { if (!n.nodeValue.trim()) continue; rg.selectNodeContents(n); for (const r of rg.getClientRects()) { const m = r.top + r.height / 2; if (r.width >= 1 && r.height >= size * 0.35 && !tops.some((t) => Math.abs(t - m) < size * 0.55)) tops.push(m); } } return Math.max(1, tops.length); };
  // The screen scale of an element: CSS transform and scale up the tree, or an SVG element's screen matrix (viewBox too).
  const det = (m) => Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)), scMemo = new Map(), scaleOf = (el) => {
    if (!el || el === html || !(el instanceof Element)) return 1; if (scMemo.has(el)) return scMemo.get(el); let v;
    if (el instanceof SVGGraphicsElement && el.ownerSVGElement) { const m = el.getScreenCTM(); v = m ? det(m) : 1; }
    else { const cs = gcs(el), k = cs.scale && cs.scale !== 'none' ? cs.scale.split(' ').map(parseFloat) : null; v = scaleOf(el.parentElement) * (cs.transform !== 'none' ? det(new DOMMatrix(cs.transform)) : 1) * (k ? Math.sqrt(Math.abs(k[0] * (k[1] ?? k[0]))) : 1); }
    scMemo.set(el, v); return v; };
  // Every visible text run by its element; px: the rendered size (font-size times the screen scale).
  const map = new Map(), tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const t = n.nodeValue.replace(/\s+/g, ' ').trim(), el = n.parentElement;
    if (!t || !el || el.closest('script,style,noscript,[inert],[hidden],.sr-only,.visually-hidden,.gb-switch') || srOnly(el)) continue;
    rg.selectNodeContents(n); const rs = [...rg.getClientRects()].filter((r) => r.width >= 1 && r.height >= 1); if (!rs.length) continue;
    const cs = gcs(el); if (cs.visibility === 'hidden') continue;
    const sc = scaleOf(el), e = map.get(el) || { el, cs, text: '', rects: [], size: parseFloat(cs.fontSize), px: parseFloat(cs.fontSize) * (Math.abs(sc - 1) < 0.02 ? 1 : sc), op: opac(el) }; e.text += (e.text ? ' ' : '') + t; e.rects.push(...rs); map.set(el, e);
  }
  const T = [...map.values()], shown = T.filter((e) => e.op >= 0.1), total = T.reduce((a, e) => a + e.text.length, 0) || 1;
  const fold = shown.filter((e) => e.rects.some((r) => onFirst(r, e.el))), chars = (a) => a.reduce((n, e) => n + e.text.length, 0);
  // 1. breakage
  // overflow
  const ov = html.scrollWidth - W; if (ov > 1) {
    const clipX = (a) => { for (; a && a !== document.body && a !== html; a = a.parentElement) { const cs = gcs(a), b = bcr(a); if ((/hidden|clip/.test(cs.overflowX) || /paint|strict|content/.test(cs.contain)) && b.left >= -1 && b.right <= W + 1) return true; } return false; }, wide = [];
    for (const e of qsa('*')) { if (e.closest('.gb-switch')) continue; const r = bcr(e);
      for (const ps of ['', '::before', '::after']) { let L = r.left, R = r.right;
        if (ps) { const cs = gcs(e, ps); if (/^(none|normal)$/.test(cs.content) || !/absolute|fixed/.test(cs.position)) continue; const len = (v) => /%$/.test(v) ? parseFloat(v) * r.width / 100 : parseFloat(v), w = parseFloat(cs.width) || 0, l = len(cs.left), rr = len(cs.right), bl = 2 * (parseFloat((cs.filter.match(/blur\(([\d.]+)px/) || [])[1]) || 0); L = (Number.isFinite(l) ? r.left + l : Number.isFinite(rr) ? r.right - rr - w : r.left) - bl; R = L + w + 2 * bl; }
        else if (!r.width) continue;
        const o = Math.max(R - W, -L); if (o > 1 && !clipX(ps ? e : e.parentElement)) wide.push({ n: sel(e) + ps, o }); } }
    wide.sort((a, b) => b.o - a.o); add('FAIL', 'overflow', `page scrolls sideways by ${ov}px; widest: ${wide.slice(0, 3).map((x) => `${x.n} (${Math.round(x.o)}px past the edge)`).join(', ') || 'not found'}`);
  }
  const hidden = T.filter((e) => e.op < 0.1 && e.rects[0].top < H && e.text.length > 2); if (hidden.length) add('FAIL', 'hidden-first-screen', `${hidden.length} text block(s) on the first screen are invisible after load: ${hidden.slice(0, 3).map((e) => '"' + clip(e.text) + '"').join(', ')}`);
  if ((ar || want === 'ar') && !rtl) add('FAIL', 'dir', `${ar ? 'lang is ar' : 'the Arabic run'} but the page is not dir="rtl"`);
  const arChars = shown.reduce((n, e) => n + (e.text.match(/[\u0600-\u06FF]/g) || []).length, 0);
  if (want === 'ar' && !arChars) add('FAIL', 'ar-missing', 'the Arabic run shows no Arabic text; render every listed language, Arabic first for a GCC market');
  // 2. headlines and the title
  const clampOf = (h) => { for (let a = h, d = 0; a && d < 3; a = a.parentElement, d++) { const c = parseInt(gcs(a).webkitLineClamp); if (c > 0) return c; } return Infinity; };
  for (const h of qda('h1,h2,h3,[role="heading"]')) { if (!vis(h)) continue; const s = parseFloat(gcs(h).fontSize), n = Math.min(linesOf(h, s), clampOf(h)); if (n > 2 && s >= 20) add('FAIL', 'headline-lines', `"${clip(txtOf(h))}" runs to ${n} lines at ${Math.round(s)}px (cut words first)`); }
  for (const e of shown) if (!e.el.closest('h1,h2,h3,[role="heading"]') && e.text.split(/\s+/).length >= 8) { const n = linesOf(e.el, e.size); if (e.size > (mobile ? 24 : 36) || (e.size >= (mobile ? 24 : 32) && n > 3)) add('WARN', 'big-sentence', `"${clip(e.text)}" is a sentence at ${Math.round(e.size)}px over ${n} line(s); a statement is 36px or less (24px phone), three lines at most`); }
  const h1s = [...qda('h1')].filter(vis);
  if (!h1s.length) add('FAIL', 'no-h1', 'no visible h1'); else {
    const s = parseFloat(gcs(h1s[0]).fontSize), top = bcr(h1s[0]).top + SY, words = txtOf(h1s[0]).trim().split(/\s+/).length;
    if (top > H) add('FAIL', 'h1-below-fold', `the h1 starts ${Math.round(top)}px down, below the first screen`);
    const denseScreen = scale === 'quiet' || (work && scale !== 'editorial' && scale !== 'hero');
    const h1Cap = denseScreen ? (mobile ? 28 : 32) : display ? (mobile ? Math.min(display, 40) : Math.min(display, 64)) : null;
    // An answer figure carries the screen: the h1 is then a quiet label (20 to 28px), no small-h1.
    if (heroFigure || figureAsked || [...qda('[data-figure]')].some(vis)) {}
    else if (!denseScreen && s < (mobile ? 26 : 32)) add('WARN', 'small-h1', `h1 is ${Math.round(s)}px; a page title is display size`);
    else if (!denseScreen && !mobile && display && s < Math.min(display, 64) - 4) add('WARN', 'small-h1', `h1 is ${Math.round(s)}px; tokens.type.display is ${display}px: the floors are minimums, not the scale`);
    if (h1Cap && s > h1Cap) add('FAIL', 'big-h1', denseScreen ? `${work ? 'work screen' : 'quiet scale'} h1 is ${Math.round(s)}px; 20 to 28px is the range, never over 32px (on a phone tokens.type.displayPhone, never over 28px)` : `h1 is ${Math.round(s)}px; the scale's display size is ${h1Cap}px at most here (tokens.type.display, 64px at most; on a phone tokens.type.displayPhone, never over 40px)`);
    if (!work && words > 10) add('WARN', 'h1-words', `h1 is ${words} words; aim for about 5`);
    if (h1s.length > 1) add('WARN', 'many-h1', `${h1s.length} h1 elements`);
  }
  // A work screen figure (digits, not the h1): over the cap FAILs; 48px up to it WARNs, but for one hero figure.
  if (work) {
    const cap = mobile ? 64 : 96, figs = shown.filter((e) => e.size >= 48 && /\d/.test(e.text) && !e.el.closest('h1')).sort((a, b) => b.size - a.size);
    const over = figs.filter((e) => e.size > cap);
    if (over.length) add('FAIL', 'big-figure', `"${clip(over[0].text)}" is ${Math.round(over[0].size)}px; a figure on a work screen is ${cap}px at most (${mobile ? 'at 390' : 'tokens.type.heroFigure is the default size, not the cap'})${over.length > 1 ? ` (${over.length} are over it)` : ''}`);
    const rest = (heroFigure ? figs.slice(1) : figs).filter((e) => e.size <= cap);
    if (rest.length) add('WARN', 'big-figure', `${rest.length} figure(s) at 48px or more on a work screen ("${clip(rest[0].text)}" ${Math.round(rest[0].size)}px); ${heroFigure ? 'one hero figure only' : 'a figure at 48px or more needs hero-figure in tokens.heroDevices'}`);
  }
  // 3. type system
  const tally = (key) => { const m = new Map(); for (const e of T) m.set(key(e), (m.get(key(e)) || 0) + e.text.length); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  // rendered sizes, the answer figure included
  const figT = (e) => !!e.el.closest('[data-figure]') || (e.px >= 32 && /\d/.test(e.text) && e.text.replace(/[\d\s.,:%+\-\u2212/()]/g, '').length <= 3), rpx = (e) => Math.round(e.px);
  const sizes = [...new Set(shown.filter((e) => e.text.length >= 2 || figT(e)).map(rpx))].filter((s) => chars(shown.filter((e) => rpx(e) === s)) >= 4 || shown.some((e) => figT(e) && rpx(e) === s)).sort((a, b) => a - b);
  const fams = tally((e) => e.cs.fontFamily.split(',')[0].replace(/["']/g, '').trim()).filter(([, n]) => n / total >= 0.02);
  // a viz's short labels count once, outside body
  const vizLab = (e) => { const v = e.el.closest('[data-viz]'); return v && e.text.replace(/\d[\d.,:%/]*\s*(?:[A-Za-z]{1,3}(?![A-Za-z])|دقيقة|دقائق|ساعة|ساعات)?/g, ' ').split(/[\s,;:·()+\-\u2212]+/).filter(Boolean).length <= 3 ? v : null; };
  const bodyTally = new Map(); for (const e of shown) if (!vizLab(e)) bodyTally.set(Math.round(e.size), (bodyTally.get(Math.round(e.size)) || 0) + e.text.length);
  const body = [...bodyTally.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null, big = Math.max(...T.map((e) => e.size), 0);
  if (sizes.length > 5) add('FAIL', 'size-count', `${sizes.length} font sizes (${sizes.join(', ')}); 5 at most on any screen, far apart`);
  const extra = fams.filter(([f]) => fonts.length && !fonts.includes(f));
  if (extra.length || fams.length > 4) add('FAIL', 'font-count', extra.length ? `${extra.map(([f]) => f).join(', ')} set 2% or more of the text but is not a token family (${fonts.join(', ')})` : `${fams.length} typefaces (${fams.map(([f]) => f).join(', ')}); 4 at most: display, text, arabic, arabicDisplay`);
  const bodyFloor = ar || want === 'ar' ? 17 : 16;
  // Labels and data may be 14px (the floor): a screen of short rows passes when its sentences (8 words or more) are body size.
  const sentTally = new Map(); for (const e of shown) if (!vizLab(e) && e.text.trim().split(/\s+/).length >= 8) sentTally.set(Math.round(e.size), (sentTally.get(Math.round(e.size)) || 0) + e.text.length);
  const sentBody = [...sentTally.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
  if (body && body < bodyFloor && (sentBody === null || sentBody < bodyFloor)) add('FAIL', 'body-size', `most text is set at ${body}px${sentBody ? `, sentences too (${sentBody}px)` : ''}; body is ${bodyFloor}px or more (${bodyFloor === 17 ? 'Arabic' : 'English'}), work screens too; labels and data may stay at 14px when the sentences are body size`);
  if (body && (!work || scale === 'editorial' || scale === 'hero') && scale !== 'quiet' && !heroFigure && !mobile && big / body < 3) add('WARN', 'flat-scale', `largest type is ${Math.round(big)}px, only ${(big / body).toFixed(1)}x the body; display is at least 3 times body on a page`);
  const pxs = (e) => `${Math.round(e.px * 10) / 10}px${e.px !== e.size ? ` (${e.size}px scaled)` : ''}`;
  const tiny = shown.filter((e) => e.px < 12 && e.text.length >= 2 && !e.el.closest('sup, sub'));
  if (tiny.length) add('FAIL', 'tiny-text', `${tiny.length} text block(s) under 12px as rendered: ${tiny.slice(0, 3).map((e) => '"' + clip(e.text) + '" ' + pxs(e)).join(', ')}`);
  // blurred text: a blur on text reads as broken or placeholder text (fog, frost, glass); hide it, or show it sharp
  const blurOf = (el) => { for (let a = el, d = 0; a && a !== document.body && d < 8; a = a.parentElement, d++) if (/blur\(/.test(gcs(a).filter)) return true; return false; };
  const blurred = shown.filter((e) => e.text.length >= 2 && e.op >= 0.1 && blurOf(e.el));
  if (blurred.length) add('FAIL', 'blurred-text', `${blurred.length} text block(s) sit under a blur filter: ${blurred.slice(0, 3).map((e) => '"' + clip(e.text) + '"').join(', ')}; never blur text: show it sharp, or hide it (and say what is hidden in words)`);
  const share = (a) => { const n = chars(a); return n ? chars(a.filter((e) => e.px < 14)) / n : 0; }, smallShare = Math.max(share(fold), share(shown)), scaled = shown.filter((e) => e.px < 14 && e.size >= 14);
  if (smallShare > 0.1) add('FAIL', 'small-share', `${Math.round(smallShare * 100)}% of the visible characters are under 14px as rendered (first screen ${Math.round(share(fold) * 100)}%, page ${Math.round(share(shown) * 100)}%)${scaled.length ? `, ${scaled.length} block(s) shrunk by a transform or viewBox ("${clip(scaled[0].text)}" ${pxs(scaled[0])})` : ''}; 10% at most, data and labels are 14px or more on screen`);
  const longest = Math.max(0, ...shown.filter((e) => e.text.length > 120).map((e) => Math.max(...e.rects.map((r) => r.width)) / (e.size * 0.5)));
  if (!mobile && longest > 88) add('WARN', 'measure', `a paragraph runs about ${Math.round(longest)} characters a line; cap at 45 to 75 (max-width: 62ch)`);
  // 4. contrast (WCAG 2.2 SC 1.4.3) on the surface each text really sits on
  // Text on glass, a gradient, an image or in an SVG goes to `ground`: the runner checks it on screenshots.
  const low = [], dim = [], ground = []; let unmeasured = 0;
  for (const e of shown) {
    const svgT = e.el instanceof SVGElement, paint = svgT ? e.cs.fill : e.cs.webkitTextFillColor || e.cs.color, fg = /^(rgb|#|hsl|color\(|lab|lch|oklab|oklch)/.test(paint) ? rgba(paint) : null;
    if (fg) fg[3] *= e.op * (svgT ? +e.cs.fillOpacity : 1);
    const halo = svgT && /^stroke/.test(e.cs.paintOrder) && e.cs.stroke !== 'none' && parseFloat(e.cs.strokeWidth) * scaleOf(e.el) >= 3 ? rgba(e.cs.stroke) : null; // a knock-out halo is the text's ground
    const bg = halo && halo[3] > 0.95 ? halo : svgT ? null : bgOf(e.el), w = +e.cs.fontWeight, need = e.size >= 24 || (e.size >= 18.66 && w >= 700) ? 3 : 4.5;
    if (e.op < 1 && e.op >= 0.1) dim.push(clip(e.text));
    if (!bg || !fg || fg[3] < 0.05) { const c = clipOf(e.el), rs = e.rects.map((r) => [Math.max(r.left, c.left, 0), Math.max(r.top, c.top, 0), Math.min(r.right, c.right, W), Math.min(r.bottom, c.bottom, H)]).filter(([l, t, r2, b]) => r2 - l >= 2 && b - t >= 2); if (!fg || fg[3] < 0.05 || e.rects.some((r) => r.top >= H)) unmeasured++; else if (rs.length && !((h) => h && pinned(h) && !pinned(h).contains(e.el))(document.elementFromPoint((rs[0][0] + rs[0][2]) / 2, (rs[0][1] + rs[0][3]) / 2))) ground.push({ text: clip(e.text), fg, need, rects: rs.map(([l, t, r2, b]) => [l, t, r2 - l, b - t].map(Math.round)) }); continue; }
    const r = ratio(over(fg, bg), bg); if (r < need) low.push(`"${clip(e.text)}" ${r.toFixed(2)}:1 needs ${need}`);
  }
  if (low.length) add('FAIL', 'contrast', `${low.length} text block(s) under AA: ${low.slice(0, 4).join('; ')}`);
  if (dim.length) add('WARN', 'opacity-text', `${dim.length} text block(s) dimmed with opacity (use a lighter color that passes): "${dim[0]}"`);
  if (unmeasured) add('WARN', 'contrast-unmeasured', `${unmeasured} text block(s) on an image or gradient could not be sampled (below the first screen, or a gradient fill): check them by eye at the darkest and lightest point; body text belongs on a solid or glass panel`);
  // 5. the frame: equal margins, text off the edge, few left edges (color fields count as content)
  const bodyBg = gcs(document.body).backgroundColor, fills = [...qsa('*')].filter((e) => { const cs = gcs(e); return vis(e) && (cs.backgroundImage !== 'none' || (rgba(cs.backgroundColor)[3] > 0.5 && cs.backgroundColor !== bodyBg)); });
  const pick = (a, p) => { a = [...a].sort((x, y) => x - y); return a[Math.floor((a.length - 1) * p)]; }, boxes = [...shown.filter((e) => !moving(e.el, true)).map((e) => e.el), ...fills, ...qda('img,video,canvas,svg,button,input,select,textarea')].filter(vis).map((e) => bcr(e)).filter((r) => r.width < W * 0.97 && r.left >= -1 && r.right <= W + 1 && r.bottom > -SY && r.height >= 1);
  // The content edges: box percentiles, or the outer edges of the big boxes (a slip, a column), whichever is more balanced.
  const major = [...boxes, ...[...qda('main,[role=main],article,section,header,footer,aside,nav')].filter(vis).map((e) => bcr(e)).filter((r) => r.width < W * 0.97 && r.left >= -1 && r.right <= W + 1 && r.height >= 1)].filter((r) => r.width >= W * 0.3 || r.height >= H * 0.5);
  const lr = (a, q) => [Math.round(pick(a.map((r) => r.left), q)), Math.round(W - pick(a.map((r) => r.right), 1 - q))], pc = boxes.length ? lr(boxes, 0.02) : null, mj = major.length >= 2 ? lr(major, 0) : null;
  const [L, R] = pc && mj ? (Math.abs(mj[0] - mj[1]) < Math.abs(pc[0] - pc[1]) ? mj : pc) : pc || mj || [null, null];
  if (L != null) { const d = Math.abs(L - R); if (d >= Math.max(mobile ? 14 : 40, W * 0.045) && Math.max(L, R) >= (mobile ? 28 : W * 0.07)) add('FAIL', 'margins', `page sits off-centre: ${L}px left, ${R}px right`); else if (d >= (mobile ? 12 : 16)) add('WARN', 'margins', `margins differ: ${L}px left, ${R}px right`); }
  const edge = shown.filter((e) => !moving(e.el, true)).flatMap((e) => e.rects.filter((r) => r.left >= 0 && r.right <= W).map((r) => ({ e, px: Math.round(Math.min(r.left, W - r.right)) }))).filter((x) => x.px < 16 && x.e.size < 40);
  if (edge.length) add(edge.some((x) => x.px < 12) ? 'FAIL' : 'WARN', 'edge-text', `${edge.length} text line(s) sit ${Math.min(...edge.map((x) => x.px))}px from the screen edge; the margin is at least 16px: "${clip(edge[0].e.text)}"`);
  const starts = shown.filter((e) => !/center|justify/.test(e.cs.textAlign) && e.text.length >= 2).map((e) => Math.round(rtl ? W - e.rects[0].right : e.rects[0].left)), edges = [];
  for (const x of starts) { const g = edges.find((k) => Math.abs(k.x - x) <= 10); if (g) g.n++; else edges.push({ x, n: 1 }); } edges.sort((a, b) => b.n - a.n);
  if (!mobile && edges.length > 6 && starts.length >= 8 && edges.slice(0, 3).reduce((a, k) => a + k.n, 0) / starts.length < 0.6) add('WARN', 'ragged-edges', `text starts on ${edges.length} different lines (${edges.slice(0, 6).map((k) => k.x + 'px').join(', ')}); pick 2 or 3 anchor lines`);
  // 6. numbers
  const nums = shown.filter((e) => /\d/.test(e.text) && e.text.length <= 24 && e.text.replace(/[\d\s.,:%+\-\u2212/()]/g, '').length <= 4);
  const tab = nums.filter((e) => /tabular-nums/.test(e.cs.fontVariantNumeric) || /tnum/.test(e.cs.fontFeatureSettings)).length;
  if (nums.length >= 6 && tab / nums.length < 0.5) add('WARN', 'tabular', `${nums.length - tab} of ${nums.length} figures lack tabular-nums (font-variant-numeric: tabular-nums)`);
  const phys = (td) => { const a = gcs(td).textAlign.replace('-webkit-', ''); return a === 'start' ? (rtl ? 'right' : 'left') : a === 'end' ? (rtl ? 'left' : 'right') : a; };
  const cells = nums.filter((e) => e.el.closest('td')?.cellIndex > 0), start = cells.filter((e) => phys(e.el.closest('td')) !== 'right');
  if (cells.length >= 6 && start.length / cells.length >= 0.5) add('WARN', 'numeric-align', `${start.length} of ${cells.length} numeric cells are not right aligned; figures align right in both directions so the decimals line up`);
  // 7. blank stretches down the page (8px rows; text, media, controls and color fields fill a row)
  const pageH = html.scrollHeight, rows = new Uint8Array(Math.ceil(pageH / 8)), mark = (r) => { for (let y = Math.max(0, Math.floor((r.top + SY) / 8)); y < Math.min(rows.length, Math.ceil((r.bottom + SY) / 8)); y++) rows[y] = 1; };
  T.forEach((e) => e.rects.forEach(mark)); qda('img,video,canvas,svg,button,input,select,textarea').forEach((e) => vis(e) && mark(bcr(e)));
  fills.map((e) => bcr(e)).filter((r) => r.width >= W * 0.5).forEach(mark);
  const gaps = [], first = rows.indexOf(1), last = rows.lastIndexOf(1); let run = 0; for (let y = first; y <= last + 1 && first >= 0; y++) { if (y <= last && !rows[y]) run++; else { if (run * 8 >= H * 0.42) gaps.push({ top: (y - run) * 8, h: run * 8 }); run = 0; } }
  if (gaps.length) add(gaps.some((g) => g.h >= H * 0.6) ? 'FAIL' : 'WARN', 'blank-gap', `${gaps.length} stretch(es) hold nothing: ${gaps.slice(0, 3).map((g) => g.h + 'px at ' + g.top).join('; ')} (screen is ${H}px)`);
  // 8. targets (WCAG 2.2 SC 2.5.8) and the main action on a phone
  const ctl = [...qda('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=switch],[role=checkbox],[tabindex]:not([tabindex="-1"])')].filter(vis).filter((e) => !e.closest('.gb-switch') && !srOnly(e)).filter((e) => !(e.tagName === 'A' && gcs(e).display === 'inline' && e.closest('p,li')));
  const small = ctl.filter((e) => { const r = bcr(e); return r.width < 24 || r.height < 24; });
  if (small.length) add('FAIL', 'target-size', `${small.length} control(s) under 24x24px (or give them 24px spacing): ${small.slice(0, 3).map((e) => sel(e) + ' ' + Math.round(bcr(e).width) + 'x' + Math.round(bcr(e).height)).join(', ')}`);
  if (mobile) { const btn = ctl.filter((e) => e.matches('button,[role=button]') && bcr(e).height < 44); if (btn.length) add('WARN', 'phone-target', `${btn.length} button(s) under 44px tall on the phone; the main action is 44px or more`); }
  // 8b. restraint: the first screen holds few things (the default view, no ?state or ?data)
  const B = dense ? (mobile ? { text: 50, controls: 18 } : { text: 100, controls: 28 }) : mobile ? { text: 30, controls: 10 } : { text: 60, controls: 16 };
  const CTL = 'a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=link],[role=tab],[role=switch],[role=checkbox],[role=menuitem],[tabindex]:not([tabindex^="-"])';
  const controls = [...qda(CTL)].filter((e) => !e.closest('.gb-switch,[inert],[hidden],[aria-hidden="true"]') && !srOnly(e) && gcs(e).visibility !== 'hidden' && opac(e) >= 0.1 && onFirst(bcr(e), e));
  const navOf = (e) => { const n = e.closest('nav,[role=navigation],[role=tablist]'), p = n && pinned(n); if (!p) return null; const r = bcr(p); return r.top > H * 0.5 && r.bottom >= H - 48 ? p : null; };
  const langOf = (e) => { const c = e.closest(CTL) || e, l = c.getAttribute('lang') || c.getAttribute('hreflang'); return (l && !html.lang.toLowerCase().startsWith(l.toLowerCase().slice(0, 2))) || /(^|[-_\s])(lang|language|locale)([-_\s]|$)/i.test(cls(c) + ' ' + c.id) || /language|اللغة/i.test(c.getAttribute('aria-label') || '') || /^(english|en|ar|ع|عربي|العربية)$/i.test(txtOf(c).trim()) ? 'lang' : null; };
  const rowOf = (e) => { for (let a = e.parentElement, d = 0; a && a !== document.body && d < 5; a = a.parentElement, d++) { const n = a.querySelectorAll(CTL).length; if (n > 3) return null; if (n >= 2 && bcr(a).height <= 200 && (a.matches('li,tr,[role=row],[role=listitem],[role=option]') || [...(a.parentElement?.children || [])].some((k) => k !== a && k.tagName === a.tagName && cls(k) === cls(a)))) return a; } return null; };
  const rowSeen = new Map(), units = (list, key) => new Set(list.map((x) => key(x))).size;
  const ctlUnits = units(controls, (e) => { const k = navOf(e) || langOf(e); if (k) return k; const r = rowOf(e), n = r ? rowSeen.get(r) || 0 : 2; if (n < 2) { rowSeen.set(r, n + 1); return r; } return e; });
  const textUnits = units(fold, (e) => navOf(e.el) || vizLab(e) || (e.el.closest(CTL) && langOf(e.el)) || e);
  if (textUnits > B.text) add('FAIL', 'text-elements', `${textUnits} text elements on the first screen; ${B.text} at most at ${W}px: defer the rest behind a click, a tab or "View all"`);
  if (ctlUnits > B.controls) add('FAIL', 'controls', `${ctlUnits} interactive controls on the first screen; ${B.controls} at most at ${W}px (a bottom nav and the language switch count as one each, a row's open and one action as one): keep the main action and the few that serve the one job`);
  const VIZ = /(^|[-_\s])(map|dial|chart|plot|graph|viz|radar|globe|gauge|orbit|clock|canvas|stage)([-_\s]|$)/i;
  let listMax = 0, listAt = '';
  for (const c of qsa('*')) {
    if (c.children.length < 9 || c.closest('svg,canvas,[data-viz],[role=img],[role=application],.gb-switch,[aria-hidden="true"],h1,h2,h3,h4,h5,h6,p,button,a,label')) continue;
    let viz = false; for (let a = c, d = 0; a && a !== document.body && d < 4; a = a.parentElement, d++) if (VIZ.test(cls(a) + ' ' + a.id)) viz = true; if (viz) continue;
    const groups = new Map();
    for (const k of c.children) { if (/^(script|style|template|svg)$/i.test(k.tagName) || !k.textContent.trim() || /absolute|fixed/.test(gcs(k).position)) continue; const r = bcr(k); if (r.height < 8 || !onFirst(r, k)) continue; const key = k.tagName.toLowerCase() + (cls(k).trim() ? '.' + cls(k).trim().split(/\s+/)[0] : ''); groups.set(key, (groups.get(key) || 0) + 1); }
    for (const [key, n] of groups) if (n > listMax) { listMax = n; listAt = `${sel(c)} > ${key}`; }
  }
  if (listMax > 8) add('FAIL', 'list-length', `${listMax} repeated items of one list on the first screen (${listAt}); show 6 at most, then "+N more" or "View all" (markers of a map, dial or chart are one picture: mark its box data-viz)`);
  const box = (r, k = 0) => ({ l: r.left, t: r.top + r.height * k, r: r.right, b: r.bottom - r.height * k }), area = (x) => Math.max(0, x.r - x.l) * Math.max(0, x.b - x.t);
  const meet = (a, b) => ({ w: Math.min(a.r, b.r) - Math.max(a.l, b.l), h: Math.min(a.b, b.b) - Math.max(a.t, b.t) }), cut = (x, c) => ({ l: Math.max(x.l, c.left), t: Math.max(x.t, c.top), r: Math.min(x.r, c.right), b: Math.min(x.b, c.bottom) });
  // text-overlap
  const ink = (k, f) => { const cs = gcs(k), c = cs[f]; return c === 'none' ? 0 : (/^url/.test(c) ? 1 : rgba(c)[3]) * +cs[f + 'Opacity'] * opac(k); };
  // a knocked-out viz label may sit on its own viz's marks
  const knock = (el) => { for (let a = el, d = 0; a && d < 3 && a !== document.body && !a.matches('[data-viz]'); a = a.parentElement, d++) { const cs = gcs(a), sh = [...cs.textShadow.matchAll(/(-?[\d.]+)px (-?[\d.]+)px ([\d.]+)px/g)];
    if (rgba(cs.backgroundColor)[3] > 0.5 || (/^stroke/.test(cs.paintOrder) && ((cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0) || parseFloat(cs.webkitTextStrokeWidth) > 0)) || sh.some((m) => +m[3] >= 2) || sh.length >= 4) return true;
    const t = bcr(a); for (let p = a.previousElementSibling, i = 0; p && i < 3; p = p.previousElementSibling, i++) { const q = bcr(p); if (p.matches('rect,path,ellipse,circle,polygon') && ink(p, 'fill') > 0.5 && q.left <= t.left + 2 && q.right >= t.right - 2 && q.top <= t.top + t.height / 2 && q.bottom >= t.bottom - t.height / 2) return true; } } return false; };
  const lay = shown.filter((e) => e.op >= 0.1).map((e) => ({ e, pin: pinned(e.el), viz: e.el.closest('[data-viz]'), ko: !!e.el.closest('[data-viz]') && knock(e.el), bx: e.rects.map((r) => cut(box(r, 0.18), clipOf(e.el))).filter((x) => x.r - x.l >= 1 && x.b - x.t >= 1) })).filter((x) => x.bx.length);
  const solid = (el, other) => { for (let a = el; a && a !== document.body && !a.contains(other); a = a.parentElement) { const cs = gcs(a); if (rgba(cs.backgroundColor)[3] > 0.9 || cs.backdropFilter !== 'none' || cs.backgroundImage !== 'none') return true; } return false; };
  const branch = (n, other, h) => { for (let a = n; a && a !== document.body; a = a.parentElement) { if (a.contains(other)) return false; if (a.contains(h)) return true; } return false; };
  const behind = (x, y, p, q, both) => { const h = document.elementFromPoint(x, y); return !!h && ((branch(p, q, h) && solid(p, q)) || (!!both && branch(q, p, h) && solid(q, p))); };
  const hitBy = (A, bx, inside, other) => A.bx.some((a) => bx.some((b) => { const m = meet(a, b); return m.w >= 3 && m.h >= 3 && !(inside && b.l <= a.l + 2 && b.r >= a.r - 2 && b.t <= a.t + 2 && b.b >= a.b - 2) && !(other && behind(Math.max(a.l, b.l) + m.w / 2, Math.max(a.t, b.t) + m.h / 2, A.e.el, other, !inside)); }));
  const overlaps = new Set();
  for (let i = 0; i < lay.length; i++) for (let j = i + 1; j < lay.length; j++) { const A = lay[i], C = lay[j], ca = A.e.el.closest(CTL); if (A.pin !== C.pin || A.e.el.contains(C.e.el) || C.e.el.contains(A.e.el) || (ca && ca === C.e.el.closest(CTL))) continue; if (hitBy(A, C.bx, false, C.e.el)) overlaps.add(`"${clip(A.e.text)}" and "${clip(C.e.text)}"`); }
  const veil = [...qsa('*')].filter((k) => { const r = bcr(k); return gcs(k).pointerEvents === 'none' && r.width >= W * 0.9 && r.height >= Math.min(H, document.body.offsetHeight) * 0.9 && !txtOf(k).trim(); });
  // An SVG shape that is a control (a hex tile, a map region) is tested by its painted shape below, never its box: boxes of packed shapes overlap.
  const ctlBox = ctl.filter((c) => opac(c) >= 0.1 && !(c instanceof SVGElement && c.localName !== 'svg')).map((c) => ({ c, pin: pinned(c), bx: [...c.getClientRects()].map((r) => cut({ l: r.left + 1, t: r.top + 1, r: r.right - 1, b: r.bottom - 1 }, clipOf(c))).filter((x) => area(x) > 0) }));
  for (const A of lay) for (const C of ctlBox) { const lab = A.e.el.closest('label,legend'); if (A.pin !== C.pin || C.c.contains(A.e.el) || A.e.el.contains(C.c) || (lab && (lab.control === C.c || lab.contains(C.c)))) continue; if (hitBy(A, C.bx, true, C.c)) overlaps.add(`"${clip(A.e.text)}" and ${sel(C.c)}`); }
  const marks = [...qsa('*')].filter((m) => { if (m.closest('.gb-switch') || m.matches(CTL)) return false; const r = bcr(m); if (r.width < 4 || r.height < 4 || r.width > 40 || r.height > 40) return false; const cs = gcs(m); if (cs.visibility === 'hidden' || opac(m) < 0.25) return false; if (m instanceof SVGElement) return m.matches('circle,ellipse,rect,polygon,path,image,use') && (m.matches('image,use') || ink(m, 'fill') >= 0.25 || ink(m, 'stroke') >= 0.25); return !m.children.length && !m.textContent.trim() && (rgba(cs.backgroundColor)[3] > 0.5 || cs.backgroundImage !== 'none'); }).map((m) => ({ m, pin: pinned(m), r: cut(box(bcr(m)), clipOf(m)) })).filter((k) => area(k.r) > 0);
  for (const A of lay) for (const K of marks) { if (A.pin !== K.pin || A.e.el.contains(K.m) || (A.ko && K.m.closest('[data-viz]') === A.viz)) continue; if (A.bx.some((a) => { const m = meet(a, K.r); return area(K.r) < area(a) && m.w > 0 && m.h > 0 && m.w * m.h >= Math.max(12, area(K.r) * 0.25) && !behind(Math.max(a.l, K.r.l) + m.w / 2, Math.max(a.t, K.r.t) + m.h / 2, A.e.el, K.m); })) overlaps.add(`"${clip(A.e.text)}" and a ${K.m.localName}${cls(K.m).trim() ? '.' + cls(K.m).trim().split(/\s+/)[0] : ''}`); }
  // Painted over the glyphs, or a line through them (a badge, a pole, a path, a tick): hit tests on glyph lines and along
  const pe = document.createElement('style'); pe.textContent = '*{pointer-events:auto!important}'; document.head.append(pe);
  const jobs = [], X0 = scrollX, Y0 = scrollY, solidHit = (k, x, y) => { if (k instanceof SVGGeometryElement) { const cs = gcs(k), m = k.getScreenCTM(); return cs.fill !== 'none' && +cs.fillOpacity * opac(k) > 0.9 && !!m && k.isPointInFill(new DOMPoint(x, y).matrixTransform(m.inverse())); } if (k instanceof SVGElement) return false; const cs = gcs(k); return k.matches('img,video,canvas,iframe') || rgba(cs.backgroundColor)[3] >= 0.6 || cs.backdropFilter !== 'none' || (cs.backgroundImage !== 'none' && !/transparent|rgba\([^)]*,\s*0\)/.test(cs.backgroundImage)); };
  const paints = (k, x, y) => { if (k instanceof SVGGeometryElement) { const m = k.getScreenCTM(); return ink(k, 'fill') >= 0.25 && !!m && k.isPointInFill(new DOMPoint(x, y).matrixTransform(m.inverse())); } if (opac(k) < 0.25) return false; if (k.matches('image,img,video,canvas,iframe')) return true; if (k instanceof SVGElement) return false; const cs = gcs(k), r = bcr(k); if (rgba(cs.backgroundColor)[3] * opac(k) > 0.3 || (cs.backgroundImage !== 'none' && !/transparent|rgba\([^)]*,\s*0\)/.test(cs.backgroundImage))) return true; return [['Top', y - r.top], ['Bottom', r.bottom - y], ['Left', x - r.left], ['Right', r.right - x]].some(([sd, d]) => { const bw = parseFloat(cs['border' + sd + 'Width']); return bw > 0 && d <= bw && rgba(cs['border' + sd + 'Color'])[3] > 0.3; }); };
  const kin = (A, k) => !k || veil.some((v) => v.contains(k)) || k === A.e.el || k.contains(A.e.el) || A.e.el.contains(k) || pinned(k) !== A.pin || k.closest('.gb-switch') || opac(k) < 0.1 || ((mv) => mv && !mv.contains(k))(moving(A.e.el, true));
  const label = (k) => `a ${k.localName}${cls(k).trim() ? '.' + cls(k).trim().split(/\s+/)[0] : ''}`, hits = new Map(), hit = (A, k) => { const key = `"${clip(A.e.text)}" and ${label(k)}`; hits.set(key, (hits.get(key) || 0) + 1); };
  const glyphs = lay.map((A) => ({ A, g: A.e.rects.map((r) => ({ l: r.left + scrollX, r: r.right + scrollX, t: r.top + scrollY + r.height * 0.3, b: r.bottom + scrollY - r.height * 0.3 })).filter((g) => g.r - g.l >= 2 && g.b > g.t) }));
  for (const { A, g } of glyphs) for (const b of g) for (let i = 0; i < 6; i++) for (const f of [0, 1]) jobs.push({ x: b.l + (b.r - b.l) * (i + 0.5) / 6, y: b.t + (b.b - b.t) * f, fix: !!A.pin, fn: (st, x, y) => { const ti = st.indexOf(A.e.el); for (let j = 0; j < ti; j++) if (!kin(A, st[j]) && paints(st[j], x, y)) { hit(A, st[j]); break; } } });
  const thin = [...qsa('line,polyline,path,polygon,circle,ellipse,rect,div,span,i,b,hr')].filter((k) => { if (k.closest('.gb-switch,defs,clipPath,mask,marker,pattern,symbol') || opac(k) < 0.1) return false; const cs = gcs(k); if (cs.visibility === 'hidden' || cs.display === 'none') return false; if (k instanceof SVGGeometryElement) return ink(k, 'stroke') >= 0.25 && parseFloat(cs.strokeWidth) * scaleOf(k) >= 0.75; const r = bcr(k); return !k.children.length && !k.textContent.trim() && Math.min(r.width, r.height) <= 6 && Math.max(r.width, r.height) >= 10 && opac(k) >= 0.25 && (rgba(cs.backgroundColor)[3] > 0.3 || parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderTopWidth) > 0); });
  for (const k of thin.slice(0, 600)) {
    let pts = []; const r = bcr(k);
    if (!glyphs.some(({ g }) => g.some((b) => r.left + scrollX < b.r && r.right + scrollX > b.l && r.top + scrollY < b.b && r.bottom + scrollY > b.t))) continue;
    if (k instanceof SVGGeometryElement) { const m = k.getScreenCTM(), len = k.getTotalLength?.() || 0, n = Math.min(300, Math.ceil(len * scaleOf(k) / 2)); if (m) for (let i = 0; i <= n; i++) { const p = k.getPointAtLength(len * i / Math.max(1, n)).matrixTransform(m); pts.push([p.x + scrollX, p.y + scrollY]); } }
    else { const v = r.height > r.width, n = Math.min(300, Math.ceil(Math.max(r.width, r.height) / 2)); for (let i = 0; i <= n; i++) pts.push(v ? [r.left + r.width / 2 + scrollX, r.top + r.height * i / n + scrollY] : [r.left + r.width * i / n + scrollX, r.top + r.height / 2 + scrollY]); }
    for (const [x, y] of pts) for (const { A, g } of glyphs) if (g.some((b) => x >= b.l && x <= b.r && y >= b.t && y <= b.b)) jobs.push({ x, y, fix: !!A.pin, fn: (st, vx, vy) => { const ti = st.indexOf(A.e.el), ki = st.indexOf(k); if (ti < 0 || ki < 0 || kin(A, k) || (ki > ti && A.ko && k.closest('[data-viz]') === A.viz)) return; if (ki < ti || !st.slice(ti, ki).some((o) => !o.contains(k) && solidHit(o, vx, vy))) hit(A, k); } });
  }
  jobs.sort((a, b) => (b.fix - a.fix) || a.y - b.y);
  for (const j of jobs.slice(0, 20000)) { if (!j.fix && (j.y - scrollY < 0 || j.y - scrollY >= H)) scrollTo({ top: j.y - 40, left: X0, behavior: 'instant' }); const x = j.x - scrollX, y = j.y - scrollY; if (x >= 0 && x < W && y >= 0 && y < H) j.fn(document.elementsFromPoint(x, y), x, y); }
  scrollTo({ top: Y0, left: X0, behavior: 'instant' }); pe.remove();
  for (const [key, n] of hits) if (n >= 2) overlaps.add(key);
  if (overlaps.size) add('FAIL', 'text-overlap', `${overlaps.size} overlap(s) of text with text, a control or a marker: ${[...overlaps].slice(0, 3).join('; ')}; give each label its own room (offset it, shorten it, or drop it at this size)`);
  // clipped-text
  const ell = (x) => { const s = gcs(x); return s.textOverflow === 'ellipsis' || (s.webkitLineClamp && s.webkitLineClamp !== 'none'); }, cutText = [];
  for (const e of shown) {
    if (e.text.length < 2 || e.op < 0.1) continue; let hit = null, rs = e.rects.map((r) => ({ left: r.left, right: r.right, top: r.top + r.height * 0.18, bottom: r.bottom - r.height * 0.18 }));
    for (let a = e.el, d = 0; a && a !== document.body && a !== html && d < 10 && !hit; a = a.parentElement, d++) {
      const cs = a === e.el ? e.cs : gcs(a), cx = /hidden|clip/.test(cs.overflowX), cy = /hidden|clip/.test(cs.overflowY);
      if ((/auto|scroll/.test(cs.overflowX) && a.scrollWidth > a.clientWidth + 1) || (/auto|scroll/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1)) break;
      if (!cx && !cy) continue;
      const b = bcr(a), L = b.left + (a.clientLeft || 0), T = b.top + (a.clientTop || 0), R = a.clientWidth ? L + a.clientWidth : b.right, Bm = a.clientHeight ? T + a.clientHeight : b.bottom, pan = panBox(a);
      rs = rs.filter((r) => r.right > L && r.left < R && r.bottom > T && r.top < Bm);
      if (!ell(a)) for (const r of rs) { const sx = cx && (r.right > R + 1 || r.left < L - 1), sy = cy && (r.bottom > Bm + 1 || r.top < T - 1); if (pan ? sx && (rtl ? r.right <= R + 1 : r.left >= L - 1) : sx || sy) { hit = sel(a); break; } }
      rs = rs.map((r) => ({ left: cx ? Math.max(r.left, L) : r.left, right: cx ? Math.min(r.right, R) : r.right, top: cy ? Math.max(r.top, T) : r.top, bottom: cy ? Math.min(r.bottom, Bm) : r.bottom }));
    }
    if (!hit && html.scrollWidth <= W + 1 && !moving(e.el, true) && rs.some((r) => (r.left < -1 && r.right > 1) || (r.right > W + 1 && r.left < W - 1))) hit = 'the screen edge';
    if (hit) cutText.push(`"${clip(e.text)}" in ${hit}`);
  }
  if (cutText.length) add('FAIL', 'clipped-text', `${cutText.length} text block(s) cut off by their box (overflow hidden, no ellipsis): ${cutText.slice(0, 3).join('; ')}; let it wrap, give the box room, or end it with text-overflow: ellipsis`);
  // fixed-trapped
  const trapOf = (e) => { for (let a = e.parentElement; a && a !== html; a = a.parentElement) { const cs = gcs(a); for (const [k, v] of [['transform', cs.transform], ['filter', cs.filter], ['backdrop-filter', cs.backdropFilter], ['perspective', cs.perspective], ['contain', /paint|layout|strict|content/.test(cs.contain) ? cs.contain : ''], ['will-change', /transform|filter|perspective/.test(cs.willChange) ? cs.willChange : ''], ['container-type', /size/.test(cs.containerType) ? cs.containerType : '']]) if (v && v !== 'none') return `${sel(a)} (${k}: ${v.slice(0, 28)})`; } return null; };
  for (const f of [...qsa('*')].filter((e) => gcs(e).position === 'fixed' && vis(e) && opac(e) >= 0.1 && !e.closest('.gb-switch,[aria-hidden="true"],[inert]') && !srOnly(e))) {
    const t = trapOf(f); if (!t) continue; const r = bcr(f), off = r.top < -1 || r.left < -1 || r.bottom > H + 1 || r.right > W + 1;
    add(off ? 'FAIL' : 'WARN', 'fixed-trapped', `position: fixed ${sel(f)} is pinned to ${t}, not the screen, so it ${off ? 'lands off screen' : 'scrolls away with that box'}; move it out of that box or drop that property`);
  }
  const scr = mobile ? 'first phone screen' : `first screen at ${W}`;
  {
    // primary-offscreen
    const place = (e) => { const r = bcr(e), inView = r.top >= -1 && r.left >= -1 && r.bottom <= H + 1 && r.right <= W + 1, hit = inView && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { r, inView, cover: hit && !e.contains(hit) && !hit.contains(e) ? hit : null }; };
    const itemOf = (e) => { for (let a = e.parentElement, d = 0; a && a !== document.body && d < 5; a = a.parentElement, d++) { if (a.querySelectorAll(CTL).length > 3) return null; if (bcr(a).height <= 200 && (a.matches('li,tr,[role=row],[role=listitem],[role=option]') || (cls(a).trim() && [...(a.parentElement?.children || [])].filter((k) => k !== a && k.tagName === a.tagName && cls(k) === cls(a)).length >= 2))) return a; } return null; };
    let prim = document.querySelector('[data-primary]'); if (prim && !vis(prim)) prim = null;
    if (!prim && !/[?&]state=/.test(location.search)) {
      const cands = []; for (const e of (document.querySelector('main,[role=main]') || document.body).querySelectorAll('button,[role=button],a[href],input[type=submit]')) { if (!vis(e) || srOnly(e) || opac(e) < 0.1 || e.closest('nav,[role=navigation],.gb-switch,[aria-hidden="true"],[inert]') || rowOf(e) || itemOf(e)) continue; const cs = gcs(e), bg = rgba(cs.backgroundColor), r = bcr(e); if ((bg[3] < 0.5 && cs.backgroundImage === 'none') || r.height > 120) continue; const k = bg[3] >= 0.5 ? ratio(bg, bgOf(e.parentElement) || [255, 255, 255, 1]) : 3; if (k >= 1.5) cands.push({ e, score: r.width * r.height * k }); }
      if (!cands.some((c) => { const p = place(c.e); return p.inView && !p.cover; })) prim = cands.sort((a, b) => b.score - a.score)[0]?.e || null;
    }
    if (prim) {
      const { r, inView, cover } = place(prim), trap = pinned(prim) && trapOf(pinned(prim));
      if (!inView || cover) add('FAIL', 'primary-offscreen', `the main action "${clip(txtOf(prim) || prim.getAttribute('aria-label') || sel(prim))}" ${!inView ? `is not on the ${scr} (it sits at ${Math.round(r.top)} to ${Math.round(r.bottom)}px of ${H})` : `is covered by ${sel(pinned(cover) || cover)}`}${trap ? `; its position: fixed is trapped by ${trap}` : ''}; keep it whole and uncovered on the first screen, at 390 in a sticky bottom bar if need be (mark the main action data-primary)`);
    }
    // covered-content
    const coverOf = (e) => { const r = bcr(e), x = r.left + r.width / 2, y = r.top + r.height / 2; if (x < 0 || x >= W || y < 0 || y >= H) return null; const h = document.elementFromPoint(x, y), p = h && pinned(h); return p && !p.contains(e) && !e.contains(h) && !p.closest('.gb-switch') ? p : null; };
    const root = document.scrollingElement || html, scrollerOf = (e) => { for (let a = e.parentElement; a && a !== document.body && a !== html; a = a.parentElement) { const cs = gcs(a); if (/auto|scroll|overlay/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1) return a; } return root; };
    const clear = (e, p, box) => { const pr = bcr(p), r = bcr(e); box.scrollBy({ top: pr.top > H / 2 ? r.bottom - pr.top + 4 : -(pr.bottom - r.top + 4), behavior: 'instant' }); };
    const under = new Map();
    for (const e of [...new Set([...ctl.filter((c) => onFirst(bcr(c), c)), ...fold.filter((x) => !x.el.closest(CTL)).map((x) => x.el)])]) {
      if (pinned(e) || opac(e) < 0.1 || e.closest('[inert],[aria-hidden="true"]')) continue; const p = coverOf(e); if (!p) continue;
      const kept = []; for (let a = e.parentElement; a; a = a.parentElement) kept.push([a, a.scrollTop, a.scrollLeft]); if (!kept.some(([a]) => a === root)) kept.push([root, root.scrollTop, root.scrollLeft]);
      if (e.matches(CTL)) e.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
      else { const box = scrollerOf(e); let q = p; for (let i = 0; q && i < 4; i++) { clear(e, q, i % 2 && box !== root ? root : box); q = coverOf(e); } }
      if (coverOf(e)) under.set(e, p); for (const [a, t, l] of kept) a.scrollTo({ top: t, left: l, behavior: 'instant' });
    }
    if (under.size) { const ex = [...under.keys()].slice(0, 3).map((e) => e.matches(CTL) ? sel(e) : `"${clip(txtOf(e))}"`); add('FAIL', 'covered-content', `${under.size} item(s) on the ${scr} sit under ${[...new Set([...under.values()].map(sel))].join(', ')} and stay there when scrolled or focused: ${ex.join(', ')}; give the page padding-bottom and scroll-padding-bottom on its scroller (html, or the app shell's main; top for a top bar) equal to the height of every bar pinned to that edge together; two bars on one edge (an action and a nav) read best as one fixed dock`); }
  }
  // colour-only-status
  const STATUS = /^(status|late|overdue|stale|error|failed|fail|failing|warning|warn|ok|success|done|complete|completed|pending|waiting|blocked|held|running|idle|online|offline|busy|away|danger|critical|urgent|review|approved|rejected|paused)$/i;
  const stCls = (e) => cls(e).split(/\s+/).filter((c) => c && c.split(/[-_]+/).some((t) => STATUS.test(t))), keyOf = (e) => e.dataset?.status ?? stCls(e).sort().join(' ');
  const kindOf = (e) => e.localName + '.' + cls(e).split(/\s+/).filter((c) => c && !stCls({ getAttribute: () => c }).length).sort().join('.');
  const named = (e) => { for (let a = e, d = 0; a && a !== document.body && d < 3; a = a.parentElement, d++) { const by = a.getAttribute('aria-labelledby'); if ((a.getAttribute('aria-label') || '').trim() || (by && document.getElementById(by.split(/\s+/)[0])?.textContent.trim()) || (a instanceof SVGElement && a.querySelector(':scope > title')?.textContent.trim())) return true; } return false; };
  const seen = (root) => root ? shown.filter((x) => root.contains(x.el)).map((x) => x.text).join(' ') : '', strip = (s) => s.replace(/[\d\s.,:;·%+\-−()/]+/g, '').toLowerCase();
  const sigs = new Map(), sig = (e) => { if (sigs.has(e)) return sigs.get(e); const cs = gcs(e), r = bcr(e), sv = e.querySelector('svg,img'), v = [strip(seen(e) || seen(e.parentElement)), cs.borderRadius, cs.clipPath, cs.transform, cs.borderStyle, Math.round(r.width / 4), Math.round(r.height / 4), e instanceof SVGElement ? (cs.fill === 'none') + cs.strokeDasharray : '', sv ? sv.outerHTML.replace(/\s(fill|stroke|color|class|style)="[^"]*"/g, '').length : 0].join('|'); sigs.set(e, v); return v; };
  const flat = new Map();
  for (const e of [...qsa('[data-status],[class]')].filter((x) => !x.closest('.gb-switch') && (x.dataset?.status != null || stCls(x).length) && vis(x) && !srOnly(x) && opac(x) >= 0.1)) {
    if (named(e) || (e.localName === 'text' && !strip(txtOf(e)))) continue; if (!seen(e) && !seen(e.parentElement)) { flat.set(e, `${sel(e)} "${keyOf(e)}" has no words`); continue; }
    const k = kindOf(e), peers = [...(k.endsWith('.') ? e.parentElement : document.body).querySelectorAll(e.localName)].filter((p) => p !== e && kindOf(p) === k && keyOf(p) !== keyOf(e) && vis(p) && !named(p));
    const me = sig(e), twin = peers.find((p) => sig(p) === me); if (twin && ![...flat.keys()].some((x) => kindOf(x) === k)) flat.set(e, `${sel(e)} "${keyOf(e)}" looks like "${keyOf(twin) || 'none'}" but for colour`);
  }
  if (flat.size) add('FAIL', 'colour-only-status', `${flat.size} status mark(s) told apart by colour alone: ${[...flat.values()].slice(0, 3).join('; ')}; add a word, an icon or a shape that changes with the status, or an aria-label that names it`);
  // empty-tile
  const indicator = (e, cs) => !!e.querySelector('input,select,textarea,[role=checkbox],[role=switch],[role=radio]') || !!e.closest('[role=status],[role=progressbar],[aria-busy=true]') || cs.animationName !== 'none' || ['Top', 'Right', 'Bottom', 'Left'].some((sd) => parseFloat(cs['border' + sd + 'Width']) > 0 && rgba(cs['border' + sd + 'Color'])[3] < 0.05);
  const TILE = /^(icon|icons|ic|ico|avatar|avi|thumb|thumbnail|logo|glyph|pic|photo|img|image|emblem|monogram|initials|tile)$/i, empty = [];
  const gone = (k) => { const r = bcr(k), s = gcs(k); return r.width < 1 || r.height < 1 || s.visibility === 'hidden' || +s.opacity < 0.05; };
  for (const e of qsa('[class],[role=img]')) {
    if (e instanceof SVGElement || e.closest('.gb-switch,svg') || e.matches('img,svg,canvas,video,picture,object,embed,input')) continue;
    const tile = e.getAttribute('role') === 'img' || cls(e).split(/\s+/).some((c) => c.split(/[-_]+/).some((t) => TILE.test(t))), cs0 = gcs(e);
    const capsule = !tile && !e.matches('[role=progressbar],[role=meter],[role=slider],progress,meter') && !/progress|bar|track|meter|gauge|slider|fill/i.test(cls(e)) && e.children.length > 0 && [...e.children].every(gone) && (cs0.backdropFilter !== 'none' || parseFloat(cs0.borderTopWidth) > 0 || rgba(cs0.backgroundColor)[3] > 0.05);
    if ((!tile && !capsule) || indicator(e, cs0)) continue;
    const r = bcr(e), small = /tile/i.test(cls(e)) ? 96 : 160; if (r.width < 12 || r.height < 12 || r.width > (capsule ? 320 : small) || r.height > (capsule ? 120 : small) || !vis(e) || srOnly(e) || opac(e) < 0.1) continue;
    const cs = cs0; if (!(rgba(cs.backgroundColor)[3] > 0.05 || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none' || cs.backdropFilter !== 'none')) continue;
    const art = (x) => { const s = gcs(x), b = gcs(x, '::before').content, a = gcs(x, '::after').content; return s.backgroundImage !== 'none' || (s.maskImage && s.maskImage !== 'none') || (s.webkitMaskImage && s.webkitMaskImage !== 'none') || ![b, a].every((c) => !c || c === 'none' || c === 'normal' || c === '""'); };
    if (txtOf(e).trim() || e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.querySelector('img,svg,canvas,video,picture,object,embed') || art(e) || [...e.querySelectorAll('*')].some((k) => vis(k) && (art(k) || rgba(gcs(k).backgroundColor)[3] > 0.3))) continue;
    empty.push(sel(e));
  }
  if (empty.length) add('FAIL', 'empty-tile', `${empty.length} icon or avatar tile(s) or capsule(s) hold nothing (no image, icon, text or label; or their contents are hidden at ${W}px): ${[...new Set(empty)].slice(0, 3).join(', ')}; draw the icon or the initials, show the contents, or hide the box with them`);
  const isState = /[?&]state=/.test(location.search), isDefault = !/[?&](state|data)=/.test(location.search);
  // figure-below-fold
  const numeral = (t) => /\d/.test(t) && t.replace(/[\d\s.,:%+\-\u2212/()]/g, '').length <= 3, notFig = /[$€£¥₹¤]|\d:\d\d|\b(am|pm|usd|sar|aed|eur|gbp|kwd|qar|sr|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|mon|tue|wed|thu|fri|sat|sun)\b|ر\.?س|د\.?إ|^\s*(19|20)\d\d\s*$|\d[./-]\d+[./-]\d/i;
  const figEl = [...qda('[data-figure]')].find(vis) || (figureAsked ? shown.filter((e) => e.size >= 32 && numeral(e.text) && !notFig.test(e.text)).sort((a, b) => b.size - a.size)[0]?.el : null);
  // figure-missing
  const figDom = document.querySelector('[data-figure]'), figHid = figDom && ![...qda('[data-figure]')].some(vis);
  if (figureAsked && !isState && (figHid || !figEl)) add('FAIL', 'figure-missing', `the tokens ask an answer figure (${heroFigurePx ? `type.heroFigure ${heroFigurePx}px` : 'mechanic.figure'}) but ${figHid ? `${sel(figDom)}[data-figure] is hidden` : 'no [data-figure] or figure numeral shows'} at ${W}; the figure shows on the first screen at 390 and 1440`);
  if (figEl && !figHid && !isState) { const r = bcr(figEl), c = clipOf(figEl.parentElement); if (r.top < c.top - 1 || r.bottom > c.bottom + 1) add('FAIL', 'figure-below-fold', `the answer figure "${clip(txtOf(figEl))}" sits at ${Math.round(r.top + SY)} to ${Math.round(r.bottom + SY)}px, not whole on the first screen (${H}px at ${W}); it answers the one question before any scroll: move it up or cut what sits above it`); }
  // hero-object, empty-panel
  const heroes = [...qda('[data-viz]')].filter(vis).map((e) => ({ e, r: bcr(e) })).sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height), hero = heroes[0];
  const heroGate = !allow.includes('hero-object') && ((work ? figureAsked : heroAsked) || !!hero || !!document.querySelector('[data-figure]'));
  if (heroGate && !isState) {
    if (!hero) add('WARN', 'hero-object', `no [data-viz] hero object: the first screen leads with one crafted viz that holds the answer (a dial with ticks, a segmented bar, a transit line, a gauge), marked data-viz; a page arrangement (a list, a column layout, a carousel) is not one${advice}`);
    else { const { e, r } = hero, c = clipOf(e.parentElement), seen = Math.max(0, Math.min(r.bottom, c.bottom) - Math.max(r.top, c.top));
      const whole = (r.height > H || seen >= r.height * 0.9 - 2) && (r.width > c.right - c.left + 4 || (r.left >= c.left - 2 && r.right <= c.right + 2)), low = mobile && r.top >= H * 0.5;
      const sh = Math.max(0, Math.min(r.right, W) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, H) - Math.max(r.top, 0)) / (W * H), need = mobile ? 0.25 : 0.3;
      if (!whole || low || sh < need) add('WARN', 'hero-object', `the hero object ${sel(e)}[data-viz] covers ${Math.round(sh * 100)}% of the first screen at ${W}${!whole ? ` and is not whole on it (${Math.round(r.top + SY)} to ${Math.round(r.bottom + SY)}px of ${H})` : low ? ` and starts at ${Math.round(r.top + SY)}px, below half of ${H}` : ''}; ${need * 100}% at least, whole when it fits the screen (aim for 40% at 1440, the top of the phone screen at 390): grow the viz, cut what crowds it${advice}`); }
  }
  const painted = (e, cs = gcs(e)) => { const bg = rgba(cs.backgroundColor), pb = bgOf(e.parentElement); return cs.boxShadow !== 'none' || cs.backdropFilter !== 'none' || cs.backgroundImage !== 'none' || ['Top', 'Right', 'Bottom', 'Left'].filter((sd) => parseFloat(cs['border' + sd + 'Width']) > 0 && rgba(cs['border' + sd + 'Color'])[3] > 0.1).length >= 2 || (bg[3] > 0.05 && (!pb || Math.hypot(...over(bg, pb).slice(0, 3).map((v, i) => v - pb[i])) > 4)); };
  const deadP = [], hr = hero && box(hero.r);
  if (heroAsked || hero || document.querySelector('[data-figure]')) for (const e of qsa('*')) {
    if (e.matches('img,svg,video,canvas,iframe,input,textarea,select,button,a,label,[data-backdrop]') || e.closest('svg,[data-viz],.gb-switch') || (hero && e.contains(hero.e))) continue;
    const r = bcr(e); if (r.width < 160 || r.height < 160 || (r.width >= W * 0.95 && r.height >= H * 0.9) || !onFirst(r, e)) continue;
    const cs = gcs(e); if (cs.visibility === 'hidden' || cs.pointerEvents === 'none' || /url\(/.test(cs.backgroundImage) || opac(e) < 0.1 || srOnly(e)) continue;
    if (!painted(e, cs)) continue;
    if (e.querySelector('img,svg,canvas,video,iframe,picture,object,embed,input,textarea,select,[data-viz]') || (hr && ((m) => m.w > 0 && m.h > 0 && m.w * m.h >= area(hr) * 0.5)(meet(box(r), hr)))) continue;
    if (shown.filter((x) => x.op >= 0.1 && e.contains(x.el) && x.rects.some((q) => q.bottom > r.top && q.top < r.bottom && q.right > r.left && q.left < r.right)).length < (work ? 1 : 2)) deadP.push(e);
  }
  const dead = deadP.filter((d) => !deadP.some((o) => o !== d && o.contains(d)));
  if (dead.length) add('FAIL', 'empty-panel', `${dead.length} panel(s) of 160x160px or more hold ${work ? 'no text' : 'under 2 text items'} and no picture: ${dead.slice(0, 3).map((e) => { const r = bcr(e); return `${sel(e)} ${Math.round(r.width)}x${Math.round(r.height)}${txtOf(e).trim() ? ` "${clip(txtOf(e))}"` : ''}`; }).join(', ')}; fill it with real content (a preview is the post's first lines, a doc's title and section numbers), or cut the box`);
  const mainR = (document.querySelector('main,[role=main]') || document.body).getBoundingClientRect(), inMain = (r) => Math.max(0, Math.min(r.right, mainR.right, W) - Math.max(r.left, mainR.left, 0)) * Math.max(0, Math.min(r.bottom, mainR.bottom, H) - Math.max(r.top, mainR.top, 0)), mainA = inMain(mainR);
  if (!isState && mainA) for (const v of heroes.map((h) => h.e).filter((v) => !v.parentElement?.closest('[data-viz]'))) { const a = inMain(bcr(v)) / mainA, wr = (e) => !vizLab(e) || e.el.closest('h1,h2,h3,h4') || ((c) => c && gcs(c).position !== 'absolute')(e.el.closest(CTL)), t = chars(fold.filter((e) => v.contains(e.el) && wr(e))) / (chars(fold) || 1);
    if (a > 0.7 && t > 0.5) { add('WARN', 'viz-wraps-page', `${sel(v)}[data-viz] covers ${Math.round(a * 100)}% of main's first screen and holds ${Math.round(t * 100)}% of its text in headings, controls and lines of 4 words or more; data-viz marks the hero object only (the dial, the bar, the line), never the layout around it: move the copy, lists and controls out of it${advice}`); break; } }
  if (!mobile && !isState && heroGate && !allow.includes('regions')) {
    const bl = [...qsa('*')].filter((e) => { if (e.closest('nav,header,footer,[role=navigation],[role=banner],[role=toolbar],.gb-switch,svg,[data-viz] *,[aria-hidden="true"]')) return false; const r = bcr(e), seenH = Math.min(r.bottom, H) - Math.max(r.top, 0);
      if (r.width < 200 || r.height < 150 || seenH < 100 || r.width >= W * 0.9 || (r.height >= H * 0.8 && r.width <= 320) || !vis(e) || opac(e) < 0.1 || srOnly(e)) return false; return e.matches('[data-viz]') || painted(e); });
    const solo = bl.filter((e) => bl.filter((o) => o !== e && e.contains(o)).length < 2), top = solo.filter((e) => !solo.some((o) => o !== e && o.contains(e)));
    if (top.length > 2) add('WARN', 'regions', `${top.length} content blocks on the first screen at ${W} (${top.slice(0, 4).map((e) => { const r = bcr(e); return `${sel(e)} ${Math.round(r.width)}x${Math.round(r.height)}`; }).join(', ')}); one hero block and at most one secondary block: the queue goes in a drawer or below the fold, no stats strip${advice}`);
  }
  if (mobile) { const rowsW = [];
    for (const c of qsa('*')) { if (c.children.length < 3 || c.closest('.gb-switch')) continue; const ks = [...c.children].filter((k) => { const r = bcr(k), cs = gcs(k); return vis(k) && r.height >= 16 && r.height <= 48 && r.width < W * 0.6 && (parseFloat(cs.borderTopLeftRadius) >= r.height / 2 - 1 || /chip|pill|tag|filter/i.test(cls(k))) && (rgba(cs.backgroundColor)[3] > 0.05 || parseFloat(cs.borderTopWidth) > 0); });
      if (ks.length < 3 || ks.length < c.children.length * 0.6) continue; const tops = []; for (const k of ks) { const r = bcr(k); if (!tops.some((t) => Math.abs(t - r.top) < r.height / 2)) tops.push(r.top); } if (tops.length >= 2) rowsW.push(`${sel(c)} (${tops.length} lines)`); }
    if (rowsW.length) add('WARN', 'chips-wrap', `${rowsW.length} row(s) of chips wrap at ${W}: ${rowsW.slice(0, 3).join(', ')}; keep the chips on one line that scrolls sideways (overflow-x: auto, flex-wrap: nowrap)`); }
  const artOf = (x) => { const st = gcs(x); return st.backgroundImage !== 'none' || (st.maskImage && st.maskImage !== 'none') || ['::before', '::after'].some((ps) => !/^(none|normal|""|)$/.test(gcs(x, ps).content)); };
  const phP = !(heroAsked || hero || document.querySelector('[data-figure]')) ? [] : [...qsa('div,span,figure,i,b,picture,a')].filter((e) => { if (e.closest('[data-viz],svg,.gb-switch,[data-backdrop],button,[role=button],[role=progressbar],[aria-busy=true]') || e.matches(CTL) || deadP.includes(e)) return false; const r = bcr(e), k = r.width / r.height;
    if (r.width < 80 || r.height < 60 || k < 0.5 || k > 2.5 || r.width * r.height > W * H * 0.4 || !vis(e) || opac(e) < 0.1 || srOnly(e)) return false; const cs = gcs(e), bg = rgba(cs.backgroundColor), pb = bgOf(e.parentElement);
    if (bg[3] <= 0.5 || artOf(e) || cs.filter !== 'none' || (hr && ((m) => m.w > 0 && m.h > 0 && m.w * m.h >= area(box(r)) * 0.5)(meet(box(r), hr))) || (pb && Math.hypot(...over(bg, pb).slice(0, 3).map((v, i) => v - pb[i])) <= 4)) return false;
    return !txtOf(e).trim() && !e.querySelector('img,svg,canvas,video,picture,iframe,object,embed,input,select,textarea') && ![...e.querySelectorAll('*')].some((k) => vis(k) && (artOf(k) || rgba(gcs(k).backgroundColor)[3] > 0.3)); });
  const ph = phP.filter((e) => !phP.some((o) => o !== e && o.contains(e)));
  if (ph.length) add('FAIL', 'placeholder-media', `${ph.length} flat colour box(es) of 80x60px or more stand in for a picture with no image, icon or text: ${ph.slice(0, 3).map((e) => { const r = bcr(e); return `${sel(e)} ${Math.round(r.width)}x${Math.round(r.height)}`; }).join(', ')}; draw the real thing (a picture the user gave, the product's own type and shapes) or cut the box`);
  const hueOf = (c) => { const [r, g, b] = c.map((v) => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (d < 0.12 || c[3] < 0.05) return null; return Math.round(60 * (mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4)); };
  if (!hazeOk && !allow.includes('glow')) { const glo = [];
    for (const e of qsa('*')) { if (glo.length >= 3) break; if (e.closest('[data-viz],.gb-switch') || !vis(e)) continue; const cs = gcs(e);
      for (const [p, min] of [['boxShadow', 8], ['textShadow', 4]]) { if (cs[p] === 'none') continue; if (p === 'textShadow') { const pill = [e, e.parentElement].some((x) => { const r = bcr(x); return r.height <= 48 && parseFloat(gcs(x).borderTopLeftRadius) >= r.height / 2 - 1; }); if (!pill) continue; }
        if ([...cs[p].matchAll(/(rgba?\([^)]*\))\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/g)].some((m) => +m[4] >= min && rgba(m[1])[3] >= 0.15 && hueOf(rgba(m[1])) != null)) { glo.push(`${sel(e)} ${p === 'boxShadow' ? 'box-shadow' : 'text-shadow'}`); break; } } }
    if (glo.length) add('WARN', 'glow', `coloured glow (${glo.join('; ')}) and the taste words do not ask for one; one soft neutral shadow on objects only, no glow on badges, pills or cards`); }
  if (hero) { const hb = hero.r, EX = /\b(is|are|each|every|means|shows?)\b|(^|\s)(كل|يعني|تعني|يمثل|تمثل|يظهر|تظهر)(\s|$)/i;
    const leg = shown.filter((e) => e.text.split(/\s+/).length >= 6 && EX.test(e.text) && !e.el.closest('h1,h2,[data-figure]') && (hero.e.contains(e.el) || e.rects.some((q) => q.right > hb.left && q.left < hb.right && ((q.top >= hb.bottom - 4 && q.top - hb.bottom <= 48) || (q.bottom <= hb.top + 4 && hb.top - q.bottom <= 48)))));
    if (leg.length) add('WARN', 'viz-legend', `a line explains the hero object ("${clip(leg[0].text)}"); the viz reads without a legend or caption: label the marks themselves, or cut the line`); }
  // hidden-shown
  const leak = [...qda('[hidden]:not([hidden=until-found])')].filter((e) => gcs(e).display !== 'none' && vis(e) && opac(e) >= 0.1 && !e.closest('.gb-switch') && !e.parentElement?.closest('[hidden]:not([hidden=until-found])'));
  if (leak.length) add('FAIL', 'hidden-shown', `${leak.length} element(s) carry the hidden attribute but still show, a display rule beats [hidden]: ${leak.slice(0, 3).map((e) => `${sel(e)} "${clip(txtOf(e))}"`).join(', ')}; add [hidden]{display:none!important}`);
  // two-primary
  if (mobile) { const key = (e) => (txtOf(e) || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().toLowerCase(), names = new Set([...qda('[data-primary]')].filter(vis).map(key).filter(Boolean)); const twins = ctl.filter((c) => names.has(key(c)) && onFirst(bcr(c), c) && opac(c) >= 0.1); if (twins.length > 1) add('WARN', 'two-primary', `the main action "${clip(txtOf(twins[0]))}" shows ${twins.length} times on the first phone screen (${twins.slice(0, 3).map(sel).join(', ')}); hide the desktop copy at 390, one primary per screen`); }
  // truncated-label
  const cutLab = [], worst = /[?&]data=worst/.test(location.search); let cutHead = 0, cutBtn = 0;
  for (const a of qsa('*')) {
    const cs = gcs(a), lc = parseInt(cs.webkitLineClamp) > 0, vert = /vertical|sideways/.test(cs.writingMode); if (!(lc || (cs.textOverflow === 'ellipsis' && /hidden|clip/.test(vert ? cs.overflowY : cs.overflowX)))) continue;
    const t = txtOf(a).replace(/\s+/g, ' ').trim(), head = !worst && !!a.closest('h1,h2,h3,h4,[role=heading]'), btn = !!a.closest('button,[role=button],input[type=submit],[data-primary]'); if (t.length < 2 || (t.length >= 24 && !head && !btn) || !vis(a) || srOnly(a) || opac(a) < 0.1 || a.closest('.gb-switch')) continue;
    let k = 1;
    if (lc) { const b = bcr(a), z = parseFloat(cs.fontSize), mids = []; const w = document.createTreeWalker(a, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.nodeValue.trim()) continue; rg.selectNodeContents(n); for (const q of rg.getClientRects()) { const m = vert ? q.left + q.width / 2 : q.top + q.height / 2; if (q.width >= 1 && q.height >= 1 && (vert ? q.width : q.height) >= z * 0.35 && !mids.some((x) => Math.abs(x - m) < z * 0.55)) mids.push(m); } }
      if (mids.length) k = mids.filter((m) => (vert ? m >= b.left && m <= b.right : m >= b.top && m <= b.bottom)).length / mids.length; }
    else { const sc = vert ? a.scrollHeight : a.scrollWidth, cl = vert ? a.clientHeight : a.clientWidth; if (sc > cl + 1) k = cl / sc; }
    if (k < 0.97) { if (head) cutHead++; if (btn) cutBtn++; cutLab.push(`"${clip(t)}" (shows about ${Math.max(1, Math.round(t.length * k))} of ${t.length} characters)`); }
  }
  if (cutLab.length) add(cutLab.length > 3 || cutHead || cutBtn ? 'FAIL' : 'WARN', 'truncated-label', `${cutLab.length} short label(s) cut by an ellipsis${cutHead ? ` (${cutHead} of them heading(s), cut on a normal day)` : ''}${cutBtn ? ` (${cutBtn} on a button or the main action)` : ''}: ${cutLab.slice(0, 3).join(', ')}; a name under 24 characters, a heading and a button label at any length show whole: give it room, let it wrap, or shorten it`);
  // wrapped-button
  const wrapL = ctl.filter((c) => c.matches('button,[role=button],input[type=submit]') && opac(c) >= 0.1).map((c) => { const ts = shown.filter((x) => c.contains(x.el)); return ts.length === 1 ? { c, t: ts[0].text, n: linesOf(c, ts[0].size) } : null; }).filter(Boolean);
  const wrap3 = wrapL.filter((x) => x.n >= 3), wrapB = wrapL.filter((x) => x.n === 2 && x.t.length <= 28).map((x) => x.c);
  if (wrap3.length) add('FAIL', 'wrapped-button', `${wrap3.length} button label(s) wrap to 3 lines or more: ${wrap3.slice(0, 3).map((x) => `"${clip(x.t)}" (${x.n} lines)`).join(', ')}; a label is one line: shorten it or give the button room (a round button holds an icon or one short word)`);
  if (wrapB.length) add('WARN', 'wrapped-button', `${wrapB.length} button label(s) wrap to 2 lines: ${wrapB.slice(0, 3).map((c) => `"${clip(txtOf(c))}"`).join(', ')}; a label is one line: shorten it ("Approve") or give the button room`);
  // hyphen-break
  const hyph = new Set(), hw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), cr = document.createRange();
  for (let n = hw.nextNode(); n; n = hw.nextNode()) { if (!n.parentElement || n.parentElement.closest('script,style,[hidden],.gb-switch') || !map.has(n.parentElement)) continue; for (const m of n.nodeValue.matchAll(/(?<![\w-])([A-Za-z]{1,12})-([A-Za-z]{1,12})(?![\w-])/g)) { const i = m.index + m[1].length; cr.setStart(n, i); cr.setEnd(n, i + 1); const a = bcr(cr); cr.setStart(n, i + 1); cr.setEnd(n, i + 2); const b = bcr(cr); if (a.height && b.height && b.top > a.top + a.height * 0.5) hyph.add(`"${m[1]}-" / "${m[2]}"`); } }
  if (hyph.size) add('WARN', 'hyphen-break', `${hyph.size} hyphenated word(s) break at the hyphen: ${[...hyph].slice(0, 3).join(', ')}; keep the word on one line (a non-breaking hyphen U+2011, or white-space: nowrap on it)`);
  // ground-haze
  if (!hazeOk) {
    const big = (e) => { const r = bcr(e); return r.width * r.height >= W * H * 0.4; }, haze = [];
    for (const e of [html, document.body, ...qsa('*')]) {
      const pos = /absolute|fixed/.test(gcs(e).position), r = bcr(e);
      if (e !== html && e !== document.body && !e.matches('main,[role=main]') && !((pos || e.parentElement === document.body) && big(e)) && !(pos && Math.min(r.width, r.height) >= 100 && /blur/.test(gcs(e).filter))) continue;
      // the glass backdrop, never the ground
      if (e.matches('[data-backdrop],[data-viz]') || [...e.children].some((k) => k.matches('[data-viz]')) || (hero && !e.contains(hero.e) && ((m) => m.w > 0 && m.h > 0 && m.w * m.h >= area(box(r)) * 0.5)(meet(box(r), hr)))) continue;
      for (const ps of [null, '::before', '::after']) {
        const cs = gcs(e, ps); if (ps && (cs.content === 'none' || cs.content === 'normal')) continue; const bi = cs.backgroundImage, blur = parseFloat((cs.filter.match(/blur\(([\d.]+)px/) || [])[1]) || 0;
        const hues = [...bi.matchAll(/rgba?\([^)]*\)/g)].map((m) => hueOf(rgba(m[0]))).filter((h) => h != null), spread = hues.length > 1 ? Math.max(...hues.map((a) => Math.max(...hues.map((b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b)))))) : 0;
        if (/radial-gradient/.test(bi) || spread > 40 || (blur >= 20 && (rgba(cs.backgroundColor)[3] > 0.1 || bi !== 'none'))) haze.push(`${sel(e)}${ps || ''}: ${/radial/.test(bi) ? 'radial-gradient' : spread > 40 ? 'a gradient of several hues' : `blur(${blur}px)`}`);
      }
      if (haze.length >= 3) break;
    }
    if (haze.length) add('WARN', 'ground-haze', `the ground carries a glow or colour haze (${haze.slice(0, 2).join('; ')}) and the taste words do not ask for one; glass is frosted panels on a flat ground: make the ground one flat colour`);
  }
  // 9. copy tells and GoBanana copy rules
  const txt = document.body.innerText;
  if (/lorem ipsum|dolor sit|John Doe|Jane Doe|\bAcme\b|\bItem \d\b|User name/i.test(txt)) add('FAIL', 'placeholder', 'placeholder copy on the page (lorem, John Doe, Acme, Item 1)');
  if (ar && /[\u064B-\u065F\u0670]/.test(txt)) add('FAIL', 'ar-diacritics', 'Arabic diacritics on the page');
  if (/[\u0660-\u0669\u06F0-\u06F9]/.test(txt)) add('FAIL', 'eastern-digits', 'Eastern Arabic digits; use Western digits 0 to 9');
  if (ar && /[\u0600-\u06FF] ?, ?[\u0600-\u06FF]/.test(txt)) add('WARN', 'ar-comma', 'Latin comma between Arabic words; use the Arabic comma');
  const arT = shown.filter((e) => /[\u0600-\u06FF]/.test(e.text));
  const trk = arT.filter((e) => parseFloat(e.cs.letterSpacing) > 0); if (trk.length) add('FAIL', 'ar-tracking', `${trk.length} Arabic block(s) with letter-spacing ("${clip(trk[0].text)}"); it breaks the joins`);
  const lead = arT.filter((e) => e.el.closest('h1,h2,h3,h4') && parseFloat(e.cs.lineHeight) / e.size < 1.3); if (lead.length) add('WARN', 'ar-leading', `${lead.length} Arabic heading(s) under 1.3 line height ("${clip(lead[0].text)}")`);
  const dashed = T.filter((e) => /[\u2013\u2014]/.test(e.text)); if (dashed.length) add('FAIL', 'dash', `${dashed.length} text block(s) with an em or en dash ("${clip(dashed[0].text)}"); use a comma, a colon, a full stop or "to"`);
  // 9b. copy register (content-and-arabic)
  const AR_SLANG = 'عشان|علشان|دلوقتي|دلوقت|كده|كدا|ازاي|إزاي|مش|عايز|عايزة|عاوز|بتاع|بتاعت|بتاعك|ده|دي|برا|جوا|قايمة|مستني|مستنية|مستنيك|مستنياك|لسه|لسة|اتعمل|اتضاف|يتضاف|بيستعمل|بيسأل|بيشتغل|بيعمل|بتعمل|الحين|ايش|إيش|وش|ليش|شلون|وايد|يبغى|تبغى|هيك|شو|بدي|بدك|منيح|كتير';
  const AR_LOAN = 'كونسبت|كونسبتس|كونسيبت|ديزاين|يوزر|يوزرز|فيدباك|تاسك|تاسكات|أبديت|ابديت|سيتنج|سيتنجز|بروجكت|بروجيكت|ريفيو|أبروف|ابروف|كوميت|ستيتس';
  const arWord = (list) => new RegExp('(?:^|[^\\u0600-\\u06FF])[وف]?(' + list + ')(?![\\u0600-\\u06FF])');
  const RAW = /\bgit\s+(?:log|status|diff|commit|push|pull|checkout|branch)\b|(?:^|\s)--[a-z][a-z-]{2,}\b|(?:^|\s)\$\s+[a-z]|\b(?:npm|npx|pnpm|yarn|node|curl|claude)\s+[a-z][\w-]*\s+-|\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b/;
  const prose = shown.filter((e) => !e.el.closest('code,pre,kbd,samp,[data-log]'));
  for (const [id, list, what] of [['ar-register', AR_SLANG, 'dialect words; write Gulf MSA'], ['ar-loanword', AR_LOAN, 'English spelled in Arabic letters; use the Arabic word']]) {
    const re = arWord(list), hits = shown.filter((e) => re.test(e.text)); if (hits.length) add('FAIL', id, `${hits.length} text block(s) with ${what}: ${[...new Set(hits.map((e) => e.text.match(re)[1]))].slice(0, 6).join('، ')} ("${clip(hits[0].text)}")`);
  }
  const raw = prose.filter((e) => RAW.test(e.text)); if (raw.length) add('FAIL', 'raw-telemetry', `${raw.length} text block(s) show a command, flag or hash as copy ("${clip(raw[0].text)}"); say what happened in product words, keep IDs quiet in mono, a real log only in a labelled <pre data-log>`);
  if (ar) {
    // untranslated
    const nameW = (w) => /[A-Z\d]/.test(w) || /^(of|and|the|for|de|al|x|by|on|in|at|to|&)$/.test(w);
    const uiW = /^(review|approve|waiting|queue|settings|overview|marketing|product|products|sales|today|yesterday|more|less|all|open|done|new|save|cancel|send|edit|delete|view|search|home|profile|account|next|back|continue|submit|close|add|remove|details|status|pending|draft|posts|changes|request|menu|help|sign|login|update|filter|total|order|orders|checkout|now|week|month|items|tasks|team|users|report|reports|messages|inbox|dashboard|loading|error|retry|again|buy|start|see|show|hide|your|you|social|unread)$/;
    const enRun = (p) => { const ws = p.split(/[\s,:;]+/).filter(Boolean); if (ws.every(nameW) || (ws.length <= 4 && ws.some((w) => /^v\d|^\d+(\.\d+)+$/i.test(w)))) return false;
      return !(ws.length <= 3 && !/[A-Z]/.test(p) && !ws.some((w) => uiW.test(w.toLowerCase().replace(/[^a-z]/g, '')))); };
    const en = prose.filter((e) => !e.el.closest('[lang^="en"],[translate="no"]') && (e.text.match(/[A-Za-z][\w'’&.-]*(?:[\s,:;]+[A-Za-z\d&][\w'’&.-]*)+/g) || []).some(enRun));
    if (en.length) add('FAIL', 'untranslated', `${en.length} English label(s) or phrase(s) on the Arabic page ("${clip(en[0].text)}"); write it in Arabic, or mark a brand or product name translate="no" and a quoted original lang="en"`);
    // latin-digits-in-arabic
    const wid = (f, t) => { cx.font = `40px ${f}`; return cx.measureText(t).width; }, gen = ['serif', 'sans-serif', 'monospace'], faceMemo = new Map();
    const digitFace = (e) => { const k = e.cs.fontFamily; if (!faceMemo.has(k)) faceMemo.set(k, k.split(',').map((f) => f.replace(/["']/g, '').trim()).find((f) => /^(serif|sans-serif|monospace|system-ui|ui-\w+|cursive|fantasy)$/.test(f) || gen.some((g) => Math.abs(wid(`"${f}", ${g}`, '0123456789') - wid(g, '0123456789')) > 0.5)) || null); return faceMemo.get(k); };
    const latD = shown.filter((e) => /\d/.test(e.text) && !e.el.closest('[lang^="en"],code,pre,kbd,samp') && ((f) => f && !/^(serif|sans-serif|monospace|system-ui|ui-\w+|cursive|fantasy)$/.test(f) && gen.every((g) => Math.abs(wid(`"${f}", ${g}`, 'ابتثجحخ') - wid(g, 'ابتثجحخ')) < 0.5))(digitFace(e)));
    if (latD.length) add('WARN', 'latin-digits-in-arabic', `${latD.length} block(s) of figures on the Arabic page are set in ${digitFace(latD[0])}, a face with no Arabic ("${clip(latD[0].text)}"); set them in the Arabic face (Western digits), never a Latin mono`);
    const bidi = shown.filter((e) => !e.el.closest('bdi,[dir="ltr"],[dir="auto"]') && [...e.el.childNodes].some((n) => n.nodeType === 3 && /[؀-ۿ]/.test(n.nodeValue) && /[A-Za-z]{2,}[\s:.,()-]*\d|\d[\s:.,()-]*[A-Za-z]{2,}|\d\s*(?:\u00b0\s*[CF]\b|%)|(?:\u00b0\s*[CF]|%)\s*\d/.test(n.nodeValue)));
    if (bidi.length) add('WARN', 'ar-bidi', `${bidi.length} Arabic text block(s) with a Latin word or a unit (°C, °F, %) next to digits and no <bdi> ("${clip(bidi[0].text)}"); wrap the Latin run or the number with its unit in <bdi>`);
  }
  if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(txt)) add('WARN', 'emoji', 'emoji in the interface');
  const stock = txt.match(/\b(unlock|unleash|supercharge|seamless(ly)?|elevate|empower|effortless(ly)?|cutting[- ]edge|next[- ]gen|world[- ]class|all[- ]in[- ]one|revolutioni[sz]e|reimagined|streamline)\b/gi); if (stock) add('WARN', 'stock-copy', `stock phrases: ${[...new Set(stock.map((s) => s.toLowerCase()))].join(', ')}`);
  const vague = ctl.filter((e) => /^(learn more|get started|click here|read more|discover more|explore now|submit)$/i.test(txtOf(e).trim())); if (vague.length) add('WARN', 'vague-action', `${vague.length} control(s) with a vague label ("${txtOf(vague[0]).trim()}"); name the action`);
  // 10. taste defaults (WARN only; ignore when the taste words or the signature element call for it)
  const micro = shown.filter((e) => e.size < 16 && e.text.length >= 2 && e.text.length <= 40 && !e.el.closest('code,kbd,pre,samp') && (e.cs.textTransform === 'uppercase' || parseFloat(e.cs.letterSpacing) >= e.size * 0.05 || (/[A-Z]{2}/.test(e.text) && !/[a-z]/.test(e.text) && e.text.replace(/[^A-Z]/g, '').length >= 5)));
  if (micro.length >= 3) add(allow.includes('micro-labels') ? 'WARN' : 'FAIL', 'micro-labels', `${micro.length} small uppercase or letter-spaced labels ("${micro.slice(0, 3).map((e) => clip(e.text)).join('", "')}"); labels are sentence case at 14px or more${allow.includes('micro-labels') ? ' (kept: the taste words name them)' : ''}`);
  const gtext = shown.filter((e) => /text/.test(e.cs.backgroundClip + e.cs.webkitBackgroundClip)); if (gtext.length) add('WARN', 'gradient-text', `${gtext.length} gradient-filled text element(s)`);
  const used = new Set(); if (colors.length) for (const e of qsa('*')) { if (!vis(e) || e.matches('input[type=radio],input[type=checkbox]') || e.closest('.gb-switch')) continue; const cs = gcs(e); for (const c of [cs.color, cs.backgroundColor]) { const v = rgba(c); if (v[3] > 0.5) used.add(v.slice(0, 3).join(',')); } }
  const tok = colors.map((c) => rgba(c).slice(0, 3)), off = [...used].map((s) => s.split(',').map(Number)).filter((c) => !tok.some((t) => Math.hypot(t[0] - c[0], t[1] - c[1], t[2] - c[2]) < 12));
  if (colors.length && off.length > 2) add('WARN', 'off-token-color', `${off.length} colors are not in tokens.colors, tokens.stage or the glass panels: ${off.slice(0, 4).map((c) => 'rgb(' + c + ')').join(', ')}`);
  const scripts = { latin: T.some((e) => /[A-Za-z]/.test(e.text)), arabic: T.some((e) => /[؀-ۿ]/.test(e.text)) };
  const measured = { lang: html.lang, dir: rtl ? 'rtl' : 'ltr', textElements: textUnits, controls: ctlUnits, fontSizes: sizes.length, smallShare: Math.round(smallShare * 1000) / 1000, bodyPx: body, tinyText: tiny.length, listMax, microLabels: micro.length, arabicChars: arChars, body, largest: Math.round(big), sizes, families: fams.map(([f]) => f), margins: [L, R], anchors: edges.length, figuresTabular: nums.length ? `${tab}/${nums.length}` : '-', scripts, loadedFonts: [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '')) };
  return { findings: out, measured, ground };
}

const png = (buf) => {
  let p = 8, w = 0, h = 0, ct = 0; const idat = [];
  while (p < buf.length) { const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len); if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ct = d[9]; if (d[8] !== 8 || d[12]) throw new Error('unsupported PNG'); } else if (type === 'IDAT') idat.push(d); else if (type === 'IEND') break; p += 12 + len; }
  const bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct], raw = inflateSync(Buffer.concat(idat)), st = w * bpp, out = Buffer.alloc(h * st);
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)], s = y * (st + 1) + 1, o = y * st; for (let x = 0; x < st; x++) { const a = x >= bpp ? out[o + x - bpp] : 0, b = y ? out[o - st + x] : 0, c = x >= bpp && y ? out[o - st + x - bpp] : 0, q = a + b - c; out[o + x] = raw[s + x] + (f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : f === 4 ? (Math.abs(q - a) <= Math.abs(q - b) && Math.abs(q - a) <= Math.abs(q - c) ? a : Math.abs(q - b) <= Math.abs(q - c) ? b : c) : 0); } }
  return { w, h, at: (x, y) => { const i = y * st + x * bpp; return bpp < 3 ? [out[i], out[i], out[i]] : [out[i], out[i + 1], out[i + 2]]; } };
};
const lum = (c) => { const f = (x) => ((x /= 255) <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); }, blend = (t, u) => [0, 1, 2].map((i) => t[i] * t[3] + u[i] * (1 - t[3]));
const browser = await pw.chromium.launch().catch(cannot), runs = [], report = [];
try { rmSync(noRender, { force: true }); } catch {}
for (const lang of languages) for (const [w, h] of [[390, 844], [1440, 900]]) runs.push({ lang, w, h, reduce: false });
runs.push({ lang: languages.includes('en') ? 'en' : languages[0], w: 1440, h: 900, reduce: true });
const LAYOUT = ['overflow', 'text-overlap', 'clipped-text', 'covered-content', 'hidden-shown', 'tiny-text', 'small-share', 'wrapped-button'];
for (const state of stateIds) for (const [w, h] of [[390, 844], [1440, 900]]) runs.push({ lang: languages[0], w, h, reduce: false, state });
for (const r of runs) {
  const page = await browser.newPage({ viewport: { width: r.w, height: r.h }, reducedMotion: r.reduce ? 'reduce' : 'no-preference' });
  const src = urlFor[r.lang] || target, [fp, q] = src.split('?'), u = new URL(/^https?:|^file:/.test(src) ? src : pathToFileURL(resolve(fp)).href + (q ? '?' + q : '')); if (!urlFor[r.lang]) u.searchParams.set('lang', r.lang); if (r.state) u.searchParams.set('state', r.state);
  await page.goto(u.href, { waitUntil: 'load' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1500);
  const res = await page.evaluate(MEASURE, { work, colors, fonts, want: r.lang, allow, dense, heroFigure, display, heroFigurePx, scale, hazeOk, figureAsked, heroAsked });
  if (r.state) { res.findings = res.findings.filter((f) => LAYOUT.includes(f.id)); res.ground = []; }
  // Text on glass, a gradient, an image or in an SVG: screenshots with and without text, the 5th and 95th percentile of the ground.
  if (res.ground.length && !r.reduce) try {
    const full = png(await page.screenshot()); await page.addStyleTag({ content: '*,*::before,*::after{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;caret-color:transparent!important;transition:none!important}text,tspan,textPath{fill:transparent!important;stroke:transparent!important}' });
    await page.waitForTimeout(80); const bare = png(await page.screenshot()), low = [];
    for (const g of res.ground) {
      const ink = [], box = [];
      for (const [x, y, w, h] of g.rects) for (let j = y; j < Math.min(y + h, bare.h); j++) for (let i = x; i < Math.min(x + w, bare.w); i++) { const a = full.at(i, j), b = bare.at(i, j); if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) > 40) ink.push(b); else if (j >= y + h * 0.2 && j < y + h * 0.8) box.push(b); }
      const px = ink.length >= 6 ? ink : box; if (!px.length) continue; px.sort((a, b) => lum(a) - lum(b));
      const worst = Math.min(...[px[Math.floor(px.length * 0.05)], px[Math.floor(px.length * 0.95)]].map((b) => contrast(blend(g.fg, b), b)));
      if (worst < g.need) low.push(`"${g.text}" ${worst.toFixed(2)}:1 needs ${g.need}`);
    }
    if (low.length) res.findings.push({ level: 'FAIL', id: 'contrast-ground', msg: `${low.length} text block(s) on glass, a gradient or an image fall under AA at the worst point of the ground: ${low.slice(0, 4).join('; ')}; darken or lighten the text, or put it on a more solid panel` });
  } catch (e) { res.findings.push({ level: 'WARN', id: 'contrast-unmeasured', msg: `${res.ground.length} text block(s) on an image or gradient could not be sampled (${String(e.message || e).split('\n')[0]}): check them by eye` }); }
  delete res.ground;
  if (r.reduce) res.findings = res.findings.filter((f) => f.id === 'hidden-first-screen').map((f) => ({ ...f, id: 'reduced-motion-hidden', msg: 'with reduced motion: ' + f.msg }));
  if (!r.reduce && !String(res.measured.lang).toLowerCase().startsWith(r.lang)) res.findings.push({ level: 'FAIL', id: 'lang-switch', msg: `asked for ?lang=${r.lang} but html lang is "${res.measured.lang}"; set <html lang> and dir from ?lang= (or pass --${r.lang} <url>)` });
  report.push({ run: `${r.lang}-${r.w}${r.reduce ? '-reduced' : ''}${r.state ? '-state-' + r.state : ''}`, lang: r.lang, width: r.w, reduced: r.reduce, ...(r.state ? { state: r.state } : {}), ...res }); await page.close();
}
await browser.close();
const loaded = new Set(report.flatMap((x) => x.measured.loadedFonts)), has = (s) => report.some((x) => x.measured.scripts?.[s]);
for (const [k, f] of tokenFonts) if (!loaded.has(f) && has(k.startsWith('arabic') ? 'arabic' : 'latin')) report[0].findings.push({ level: k === 'arabicDisplay' ? 'WARN' : 'FAIL', id: 'font-not-loaded', msg: `${f} (${k}) never loaded in any run (missing link, wrong name, or unused); screenshots show a fallback` });
const ids = (lvl) => [...new Set(report.flatMap((x) => x.findings.filter((f) => f.level === lvl).map((f) => f.id)))];
const failIds = ids('FAIL'), warnIds = ids('WARN'), fails = failIds.length, views = report.filter((x) => !x.reduced && !x.state), wide = views.filter((x) => x.width >= 1440);
const pct = (v) => Math.round(v * 100) + '%';
// The numbers the server checks: the 1440 default view (worst language), the worst run for sizes, small share and body.
const defaultView = ![target, urlFor.ar, urlFor.en].filter(Boolean).some((u) => /[?&](state|data)=/.test(String(u)));
const bodies = views.map((x) => x.measured.bodyPx).filter((n) => typeof n === 'number' && n > 0);
const measure = defaultView && wide.length && bodies.length ? { fails, textElements: Math.max(0, ...wide.map((x) => x.measured.textElements)), controls: Math.max(0, ...wide.map((x) => x.measured.controls)), fontSizes: Math.max(0, ...views.map((x) => x.measured.fontSizes)), smallShare: Math.max(0, ...views.map((x) => x.measured.smallShare)), bodyPx: Math.min(...bodies), languages } : null;
const cap = dense ? { 1440: [100, 28], 390: [50, 18] } : { 1440: [60, 16], 390: [30, 10] };
const narrow = views.filter((x) => x.width < 640), phone = narrow.length ? { textElements: Math.max(0, ...narrow.map((x) => x.measured.textElements)), controls: Math.max(0, ...narrow.map((x) => x.measured.controls)) } : null;
const summary = { tool: 'gb-measure', version: 2, phone, phoneFirst, target: target || urlFor, at: new Date().toISOString(), languages, density: dense ? 'dense' : 'default', scale: { look: scale, display, heroFigure: heroFigurePx }, fails, warns: warnIds.length, failIds, warnIds, measure,
  budgets: { textElements: { 1440: cap[1440][0], 390: cap[390][0] }, controls: { 1440: cap[1440][1], 390: cap[390][1] }, fontSizes: 5, smallShare: 0.1, tinyText: 0, bodyPx: { en: 16, ar: 17 }, listItems: 8, microLabels: 2 },
  states: stateIds, runs: report.map((x) => ({ run: x.run, lang: x.lang, width: x.width, ...(x.reduced || x.state ? { ...(x.reduced ? { reduced: true } : { state: x.state }) } : { textElements: x.measured.textElements, controls: x.measured.controls, fontSizes: x.measured.fontSizes, sizes: x.measured.sizes, smallShare: x.measured.smallShare, bodyPx: x.measured.bodyPx, tinyText: x.measured.tinyText, listMax: x.measured.listMax, microLabels: x.measured.microLabels, arabicChars: x.measured.arabicChars, dir: x.measured.dir }), fails: [...new Set(x.findings.filter((f) => f.level === 'FAIL').map((f) => f.id))], warns: [...new Set(x.findings.filter((f) => f.level === 'WARN').map((f) => f.id))] })) };
// measure.json (measure-data-worst.json for ?data=worst) goes next to the shots.
const extra = (() => { try { const q = String(target || '').split('?')[1]; return q ? [...new URLSearchParams(q)].filter(([k]) => !/^(lang|shot)$/.test(k)).map(([k, v]) => `-${k}-${v}`).join('').replace(/[^\w-]/g, '') : ''; } catch { return ''; } })();
const jsonPath = join(resolve(outDir || join(process.env.TMPDIR || '/tmp', 'gb', 'shots')), `measure${extra}.json`);
try { mkdirSync(resolve(jsonPath, '..'), { recursive: true }); writeFileSync(jsonPath, JSON.stringify(summary, null, 1)); } catch (e) { console.error('could not write ' + jsonPath + ': ' + e.message); }
if (asJson) console.log(JSON.stringify(report, null, 1));
else {
  for (const x of report) { if (x.reduced || x.state) continue; const m = x.measured; console.log(`${x.run}: text ${m.textElements}, controls ${m.controls}, sizes ${m.fontSizes} [${m.sizes}], small ${pct(m.smallShare)}, body ${m.bodyPx ?? 'n/a'}px, list ${m.listMax}, largest ${m.largest}px, faces [${m.families}], margins ${m.margins.join('/')}, anchors ${m.anchors}, tabular ${m.figuresTabular}`); }
  const seen = new Map(); for (const x of report) for (const f of x.findings) { const k = `${f.level} ${f.id}: ${f.msg}`; seen.set(k, [...(seen.get(k) || []), x.run]); }
  for (const lvl of ['FAIL', 'WARN']) for (const [k, where] of seen) if (k.startsWith(lvl)) console.log(`${k}  [${where.join(', ')}]`);
}
if (measure) console.log(`${fails} failing check(s): text ${measure.textElements}/${cap[1440][0]}, controls ${measure.controls}/${cap[1440][1]}${phone ? ` (390: text ${phone.textElements}/${cap[390][0]}, controls ${phone.controls}/${cap[390][1]})` : ''}, sizes ${measure.fontSizes}/5, small ${pct(measure.smallShare)}/10%, body ${measure.bodyPx}px. Summary: ${jsonPath}`);
else console.log(`${fails} failing check(s). No measure for add_to_canvas: ${!defaultView ? 'this run was a ?state or ?data view' : 'no 1440 run found body text'}; measure the rendered default view (no ?state or ?data) for it. Summary: ${jsonPath}`);
console.log(fails ? 'Never show or place this draft while a FAIL stands: fix it and measure again.' : 'Numbers are evidence for the craft check; they never replace looking side by side.');
// The checked stamp for the plugin's publish gate.
if (target && !/^https?:/.test(target)) try {
  const fp = target.startsWith('file:') ? fileURLToPath(target.split('?')[0]) : resolve(target.split('?')[0]), dir = join(process.env.TMPDIR || '/tmp', 'gb'), sp = join(dir, 'checked.json');
  mkdirSync(dir, { recursive: true }); let st = {}; try { st = JSON.parse(readFileSync(sp, 'utf8')); } catch {}
  const prev = st[fp], mtimeMs = statSync(fp).mtimeMs; // same mtime: the default and the worst case run of one round, so the worse one counts
  st[fp] = { mtimeMs, fails: prev?.mtimeMs === mtimeMs ? Math.max(prev.fails, fails) : fails, at: Date.now(), summary: jsonPath }; writeFileSync(sp, JSON.stringify(st));
} catch {}
process.exit(fails ? 1 : 0);
