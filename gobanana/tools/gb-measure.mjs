// gb-tools v2: a fetch line refetches a cached copy without this tag. Bump it in every script and fetch line when any script changes.
// gb-measure: render a draft in its one language at the brief's viewports (390x844 and 1440x900 when none is given), check the accessibility floor and content honesty, print FAIL and WARN.
//   node gb-measure.mjs <file.html|url> [--en <url>] [--tokens tokens.json] [--languages en] [--out <dir>] [--viewport 390x844]
//     [--states loading,error] [--taste-allows mechanic-missing] [--landing] [--json]
//   node gb-measure.mjs --rough <out-dir> a.html b.html ...   roughs in one run, floor checks only, <out-dir>/<name>/measure.json each
// --viewport (repeat it, or 390x844,1440x900), else tokens.viewports (--tokens, or a tokens.json beside the file).
// Flags and checks: playbook gobanana-draft/measure-script. No style budgets (owner 2026-10-28): the look is the hero's.
// Adapted from taste-skill scripts/inspect.mjs and scripts/lib/rules.mjs (MIT, github.com/Leonxlnx/taste-skill).
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process'; import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve, join } from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url'; import { inflateSync } from 'node:zlib';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf('--' + n); return i < 0 ? null : args.splice(i, 2)[1]; };
const flag = (n) => { const i = args.indexOf('--' + n); if (i < 0) return false; args.splice(i, 1); return true; };
const tp = opt('tokens'), tokens = tp ? JSON.parse(readFileSync(tp, 'utf8')) : null;
const urlFor = { ar: opt('ar'), en: opt('en') }, outDir = opt('out'), list = (v) => String(v || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
const langArg = list(opt('languages')), tokenLangs = Array.isArray(tokens?.languages) ? list(tokens.languages.join(',')) : [];
// ONE language: --languages, else the tokens' language, else the page's own <html lang> (read below), else English.
const langGiven = langArg.length > 0 || !!tokens?.primaryLanguage || tokenLangs.length > 0;
let languages = [...new Set(langArg.length ? langArg : [String(tokens?.primaryLanguage || tokenLangs[0] || 'en').toLowerCase()])];
const ta = []; for (let v; (v = opt('taste-allows')) !== null;) ta.push(v);
const allow = [...list(ta.join(',')), ...(Array.isArray(tokens?.tasteAllows) ? tokens.tasteAllows.map(String) : [])];
flag('work'); flag('phone'); const asJson = flag('json'); // --work and --phone are accepted and ignored: no budgets.
// A landing page (tokens.landing or --landing) needs no [data-mechanic] box; a marked box still has to move.
const landing = flag('landing') || tokens?.landing === true;
const kebab = (s) => String(s).trim().replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[\s_]+/g, '-').toLowerCase();
const roughDir = opt('rough'), rough = roughDir !== null, vpArg = []; for (let v; (v = opt('viewport')) !== null;) vpArg.push(v);
const stateIds = rough ? [] : list(opt('states')).map(kebab).filter((s) => !/^(default|idle|hover|focus|focus-visible|active|pressed|moving|dragging)$/.test(s)), target = args[0];
const usage = () => { console.error('usage: node gb-measure.mjs <file.html|url> [--tokens tokens.json] [--languages en] [--out dir] [--viewport 390x844] [--states loading,error] [--taste-allows mechanic-missing] [--landing] [--json]\n   or: node gb-measure.mjs --rough <out-dir> a.html b.html ... [--viewport 390x844] [--tokens tokens.json]'); process.exit(2); };
if ((rough && (!roughDir || roughDir.startsWith('--') || !args.length)) || (!target && !languages.every((l) => urlFor[l]))) usage();
// Viewports: --viewport, else tokens.viewports (the brief's platform), else a tokens.json beside the file, else 390x844 and 1440x900.
const nearTokens = (src) => { try { if (/^https?:/.test(src)) return null; const fp = src.startsWith('file:') ? fileURLToPath(src.split('?')[0]) : resolve(src.split('?')[0]); return JSON.parse(readFileSync(join(dirname(fp), 'tokens.json'), 'utf8')); } catch { return null; } };
const vpList = (v) => (Array.isArray(v) ? v : [v]).flatMap((x) => String(x || '').split(',')).map((s) => s.trim()).filter(Boolean);
const vpRaw = vpArg.length ? vpList(vpArg) : vpList(tokens?.viewports ?? (target ? nearTokens(target)?.viewports : null));
const viewports = vpRaw.map((s) => { const m = /^(\d{3,4})x(\d{3,4})$/.exec(s); if (!m) { console.error(`--viewport takes WIDTHxHEIGHT, for example 390x844 (got "${s}")`); process.exit(2); } return [+m[1], +m[2]]; }).sort((a, b) => a[0] - b[0]);
if (!viewports.length) viewports.push([390, 844], [1440, 900]);
const [mainW, mainH] = viewports[viewports.length - 1]; // the widest view: mechanic, focus, reduced motion and the server's numbers
const req = createRequire(import.meta.url), gbDir = join(process.env.TMPDIR || '/tmp', 'gb'), noRender = join(gbDir, '.gb-norender');
// No browser: mark the machine (.gb-norender, read by the publish gate) and stop.
const cannot = (e) => { try { mkdirSync(gbDir, { recursive: true }); writeFileSync(noRender, `${new Date().toISOString()} ${String(e?.message || e).split('\n')[0]}\n`); } catch {} console.error(`This machine cannot render: ${String(e?.message || e).split('\n')[0]}\nMarked ${noRender}. Show the draft only with every visual item "not checked".`); process.exit(3); };
let pw; try { try { pw = req('playwright'); } catch { pw = createRequire(join(execSync('npm root -g').toString().trim(), '_'))('playwright'); } } catch (e) { cannot(e); }

// Runs in the page (or pasted alone into browser_evaluate).
function MEASURE({ want = '', allow = [], landing = false, main = innerWidth >= 1440 }) {
  const gcs = (e, p) => getComputedStyle(e, p), bcr = (e) => e.getBoundingClientRect(), qsa = (q) => document.body.querySelectorAll(q), qda = (q) => document.querySelectorAll(q);
  const W = innerWidth, H = innerHeight, mobile = W < 640, out = [], add = (level, id, msg) => out.push({ level, id, msg });
  const html = document.documentElement, ar = /^ar/.test(html.lang), rtl = gcs(html).direction === 'rtl';
  const cx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#0000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lum = (c) => { const f = (x) => ((x /= 255) <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])).concat(1);
  const sel = (e) => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\s+/)[0] : '');
  const clip = (s) => s.replace(/\s+/g, ' ').trim().slice(0, 40);
  const vis = (e) => { const r = bcr(e); return r.width >= 1 && r.height >= 1 && gcs(e).visibility !== 'hidden'; };
  const txtOf = (e) => String(e?.innerText ?? e?.textContent ?? ''), cls = (e) => String(e?.getAttribute?.('class') || '');
  // sr-only: clipped, 1px, or far off screen.
  const srMemo = new Map(), srOnly = (el) => {
    if (!el || el === document.body || el === html || !(el instanceof Element)) return false; if (srMemo.has(el)) return srMemo.get(el);
    const cs = gcs(el), r = bcr(el), n = (cs.clip.match(/rect\(([^)]*)\)/)?.[1] || '').split(/[\s,]+/).map(parseFloat), ab = /absolute|fixed/.test(cs.position);
    const v = (ab && n.length === 4 && (n[2] - n[0] <= 1 || n[1] - n[3] <= 1)) || /^inset\((50|100)%|^circle\(0/.test(cs.clipPath) || (/hidden|clip/.test(cs.overflowX + cs.overflowY) && (r.width <= 1.5 || r.height <= 1.5)) || parseFloat(cs.textIndent) <= -999 || (ab && (r.right < -999 || r.left > W + 999)) || srOnly(el.parentElement);
    srMemo.set(el, v); return v;
  };
  // The outermost fixed or sticky box around an element, or null.
  const pinMemo = new Map(), pinned = (el) => { if (!el || el === html || el === document.body) return null; if (pinMemo.has(el)) return pinMemo.get(el); const p = gcs(el).position, v = pinned(el.parentElement) || (p === 'fixed' || p === 'sticky' ? el : null); pinMemo.set(el, v); return v; };
  // A box that scrolls or pans; picture: svg and canvas too.
  const panMemo = new Map(), panBox = (a) => { if (panMemo.has(a)) return panMemo.get(a); const cs = gcs(a), b = bcr(a);
    const v = (/auto|scroll/.test(cs.overflowX) && a.scrollWidth > a.clientWidth + 1) || (/auto|scroll/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1) || a.matches('[data-pan],[data-viz],[role=application]') || /grab|move/.test(cs.cursor) || cs.touchAction === 'none'
      || (/hidden|clip/.test(cs.overflowX + cs.overflowY) && [...a.children].some((k) => { const r = bcr(k); return r.width > b.width * 1.2 + 4 || r.height > b.height * 1.2 + 4; }));
    panMemo.set(a, v); return v; };
  const moving = (el, picture) => { for (let a = el.parentElement; a && a !== document.body && a !== html; a = a.parentElement) if (panBox(a) || (picture && a.matches('svg,canvas'))) return a; return null; };
  // The first screen, cut by every clipping box around the element.
  const clips = new Map(), clipOf = (el) => { if (!el || el === html || el === document.body) return { top: 0, left: 0, bottom: H, right: W }; if (clips.has(el)) return clips.get(el); const cs = gcs(el); let c = cs.position === 'fixed' ? { top: 0, left: 0, bottom: H, right: W } : clipOf(el.parentElement); if (/(hidden|auto|scroll|clip)/.test(cs.overflowX + cs.overflowY)) { const b = bcr(el); c = { top: Math.max(c.top, b.top), left: Math.max(c.left, b.left), bottom: Math.min(c.bottom, b.bottom), right: Math.min(c.right, b.right) }; } clips.set(el, c); return c; };
  const onFirst = (r, el) => { const c = clipOf(el.parentElement); return r.width >= 1 && r.height >= 1 && r.top < c.bottom - 1 && r.bottom > c.top + 1 && r.left < c.right - 1 && r.right > c.left + 1; };
  const opac = (e) => { let o = 1; for (let p = e; p && p !== html; p = p.parentElement) o *= +gcs(p).opacity; return o; };
  const bgOf = (e) => { const st = []; for (let p = e; p; p = p.parentElement) { const cs = gcs(p); if (cs.backdropFilter && cs.backdropFilter !== 'none' && rgba(cs.backgroundColor)[3] < 0.95) return null; if (cs.backgroundImage !== 'none') return null; const c = rgba(cs.backgroundColor); if (c[3] > 0) { st.push(c); if (c[3] > 0.99) break; } } return st.reverse().reduce((u, t) => over(t, u), [255, 255, 255, 1]); };
  const rg = document.createRange();
  // Screen scale: transforms up the tree, or an SVG screen matrix.
  const det = (m) => Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)), scMemo = new Map(), scaleOf = (el) => {
    if (!el || el === html || !(el instanceof Element)) return 1; if (scMemo.has(el)) return scMemo.get(el); let v;
    if (el instanceof SVGGraphicsElement && el.ownerSVGElement) { const m = el.getScreenCTM(); v = m ? det(m) : 1; }
    else { const cs = gcs(el), k = cs.scale && cs.scale !== 'none' ? cs.scale.split(' ').map(parseFloat) : null; v = scaleOf(el.parentElement) * (cs.transform !== 'none' ? det(new DOMMatrix(cs.transform)) : 1) * (k ? Math.sqrt(Math.abs(k[0] * (k[1] ?? k[0]))) : 1); }
    scMemo.set(el, v); return v; };
  // Visible text runs; px: font-size times the screen scale.
  const map = new Map(), tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const t = n.nodeValue.replace(/\s+/g, ' ').trim(), el = n.parentElement;
    if (!t || !el || el.closest('script,style,noscript,[inert],[hidden],.sr-only,.visually-hidden,.gb-switch,details:not([open]) > :not(summary)') || srOnly(el)) continue; // a closed <details> hides its answer
    rg.selectNodeContents(n); const rs = [...rg.getClientRects()].filter((r) => r.width >= 1 && r.height >= 1); if (!rs.length) continue;
    const cs = gcs(el); if (cs.visibility === 'hidden') continue;
    const sc = scaleOf(el), e = map.get(el) || { el, cs, text: '', rects: [], nodes: [], size: parseFloat(cs.fontSize), px: parseFloat(cs.fontSize) * (Math.abs(sc - 1) < 0.02 ? 1 : sc), op: opac(el) }; e.text += (e.text ? ' ' : '') + t; e.rects.push(...rs); e.nodes.push(n); map.set(el, e);
  }
  const T = [...map.values()], shown = T.filter((e) => e.op >= 0.1), total = T.reduce((a, e) => a + e.text.length, 0) || 1;
  const fold = shown.filter((e) => e.rects.some((r) => onFirst(r, e.el)));
  // 1. breakage
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
  if (want === 'ar' && !arChars) add('FAIL', 'ar-missing', 'the Arabic run shows no Arabic text; the page language is Arabic, so its copy is Arabic');
  // 2. the title
  if (![...qda('h1')].some(vis)) add('WARN', 'no-h1', 'no visible h1; a screen reader user finds the page by its h1');
  // 3. type: the accessibility floor only (body 16px, 17px Arabic; nothing read under 14px)
  const tally = (key) => { const m = new Map(); for (const e of T) m.set(key(e), (m.get(key(e)) || 0) + e.text.length); return [...m.entries()].sort((a, b) => b[1] - a[1]); };
  const rpx = (e) => Math.round(e.px), sizes = [...new Set(shown.filter((e) => e.text.length >= 2).map(rpx))].sort((a, b) => a - b);
  const fams = tally((e) => e.cs.fontFamily.split(',')[0].replace(/["']/g, '').trim()).filter(([, n]) => n / total >= 0.02);
  // a viz's short labels count once, outside body
  const vizLab = (e) => { const v = e.el.closest('[data-viz]'); return v && e.text.replace(/\d[\d.,:%/]*\s*(?:[A-Za-z]{1,3}(?![A-Za-z])|دقيقة|دقائق|ساعة|ساعات)?/g, ' ').split(/[\s,;:·()+\-\u2212]+/).filter(Boolean).length <= 3 ? v : null; };
  // bodyPx: running body text, the largest share among blocks of 6 words or more; labels under 16 never lower it (round 3).
  // SVG text by its rendered size. No running text: the size that sets the most text.
  const bsz = (e) => Math.round(e.el instanceof SVGElement ? e.px : e.size), share = (min) => { const m = new Map(); for (const e of shown) if (!vizLab(e) && e.text.trim().split(/\s+/).length >= min) m.set(bsz(e), (m.get(bsz(e)) || 0) + e.text.length); return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null; };
  const running = share(6), body = running ?? share(1), big = Math.max(...T.map((e) => e.size), 0);
  const bodyFloor = ar || want === 'ar' ? 17 : 16;
  if (body && body < bodyFloor) add('FAIL', 'body-size', `${running ? 'running text (blocks of 6 words or more) is' : 'most text is'} set at ${body}px; body is ${bodyFloor}px or more (${bodyFloor === 17 ? 'Arabic' : 'English'}), labels and data may stay at 14px when the running text is body size`);
  const pxs = (e) => `${Math.round(e.px * 10) / 10}px${e.px !== e.size ? ` (${e.size}px scaled)` : ''}`;
  // 13.9: sub-pixel rounding is not small type.
  const tiny = shown.filter((e) => e.px < 13.9 && e.text.trim().length >= 2 && !e.el.closest('sup, sub'));
  if (tiny.length) add('FAIL', 'small-text', `${tiny.length} text block(s) read under 14px as rendered: ${tiny.slice(0, 3).map((e) => '"' + clip(e.text) + '" ' + pxs(e)).join(', ')}; nothing read goes under 14px (a transform or an SVG viewBox shrinks text too)`);
  const blurOf = (el) => { for (let a = el, d = 0; a && a !== document.body && d < 8; a = a.parentElement, d++) if (/blur\(/.test(gcs(a).filter)) return true; return false; };
  const blurred = shown.filter((e) => e.text.length >= 2 && e.op >= 0.1 && blurOf(e.el));
  if (blurred.length) add('FAIL', 'blurred-text', `${blurred.length} text block(s) sit under a blur filter: ${blurred.slice(0, 3).map((e) => '"' + clip(e.text) + '"').join(', ')}; never blur text: show it sharp, or hide it (and say what is hidden in words)`);
  // 4. contrast
  // Text on glass, a gradient, an image or an SVG goes to `ground` (screenshots).
  const low = [], ground = []; let unmeasured = 0;
  for (const e of shown) {
    const svgT = e.el instanceof SVGElement, paint = svgT ? e.cs.fill : e.cs.webkitTextFillColor || e.cs.color, fg = /^(rgb|#|hsl|color\(|lab|lch|oklab|oklch)/.test(paint) ? rgba(paint) : null;
    if (fg) fg[3] *= e.op * (svgT ? +e.cs.fillOpacity : 1);
    const halo = svgT && /^stroke/.test(e.cs.paintOrder) && e.cs.stroke !== 'none' && parseFloat(e.cs.strokeWidth) * scaleOf(e.el) >= 3 ? rgba(e.cs.stroke) : null; // a knock-out halo is the text's ground
    const bg = halo && halo[3] > 0.95 ? halo : svgT ? null : bgOf(e.el), w = +e.cs.fontWeight, need = e.size >= 24 || (e.size >= 18.66 && w >= 700) ? 3 : 4.5;
    if (!bg || !fg || fg[3] < 0.05) { const c = clipOf(e.el), rs = e.rects.map((r) => [Math.max(r.left, c.left, 0), Math.max(r.top, c.top, 0), Math.min(r.right, c.right, W), Math.min(r.bottom, c.bottom, H)]).filter(([l, t, r2, b]) => r2 - l >= 2 && b - t >= 2); if (!fg || fg[3] < 0.05 || e.rects.some((r) => r.top >= H)) unmeasured++; else if (rs.length && !((h) => h && pinned(h) && !pinned(h).contains(e.el))(document.elementFromPoint((rs[0][0] + rs[0][2]) / 2, (rs[0][1] + rs[0][3]) / 2))) ground.push({ text: clip(e.text), fg, need, rects: rs.map(([l, t, r2, b]) => [l, t, r2 - l, b - t].map(Math.round)) }); continue; }
    const r = ratio(over(fg, bg), bg); if (r < need) low.push(`"${clip(e.text)}" ${r.toFixed(2)}:1 needs ${need}`);
  }
  if (low.length) add('FAIL', 'contrast', `${low.length} text block(s) under AA: ${low.slice(0, 4).join('; ')}`);
  if (unmeasured) add('WARN', 'contrast-unmeasured', `${unmeasured} text block(s) on an image or gradient could not be sampled (below the first screen, or a gradient fill): check them by eye at the darkest and lightest point; body text belongs on a solid or glass panel`);
  // 8. targets
  const ctl = [...qda('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=switch],[role=checkbox],[tabindex]:not([tabindex="-1"])')].filter(vis).filter((e) => !e.closest('.gb-switch') && !srOnly(e)).filter((e) => !(e.tagName === 'A' && gcs(e).display === 'inline' && e.closest('p,li')));
  // A label wrapping or naming the control is its target too (a 20px checkbox inside a 44px label passes).
  const hitBox = (e) => { const r = bcr(e), lab = e.closest('label') || (e.id && document.querySelector(`label[for="${CSS.escape(e.id)}"]`)); if (!lab) return r; const q = bcr(lab); return { width: Math.max(r.width, q.width), height: Math.max(r.height, q.height) }; };
  const need = mobile ? 44 : 24, small = ctl.filter((e) => { const r = hitBox(e); return r.width < need || r.height < need; });
  if (small.length) add('FAIL', 'target-size', `${small.length} control(s) under ${need}x${need}px${mobile ? ' on the phone (tap targets are 44px)' : ''}: ${small.slice(0, 3).map((e) => sel(e) + ' ' + Math.round(bcr(e).width) + 'x' + Math.round(bcr(e).height)).join(', ')}`);
  // alt text: every meaningful image is named (alt="" marks a decorative one).
  const noAlt = [...qda('img:not([alt]),[role=img]:not([aria-label]):not([aria-labelledby]),svg[role=img]:not([aria-label]):not([aria-labelledby])')].filter((e) => !e.closest('.gb-switch,[aria-hidden="true"]') && vis(e) && !(e instanceof SVGElement && e.querySelector(':scope > title')?.textContent.trim()));
  if (noAlt.length) add('FAIL', 'alt-missing', `${noAlt.length} image(s) with no alt text: ${noAlt.slice(0, 3).map(sel).join(', ')}; describe what it shows in alt, or alt="" when it is decoration`);
  const CTL = 'a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=link],[role=tab],[role=switch],[role=checkbox],[role=menuitem],[tabindex]:not([tabindex^="-"])';
  const controls = [...qda(CTL)].filter((e) => !e.closest('.gb-switch,[inert],[hidden],[aria-hidden="true"]') && !srOnly(e) && gcs(e).visibility !== 'hidden' && opac(e) >= 0.1 && onFirst(bcr(e), e));
  const navOf = (e) => { const n = e.closest('nav,[role=navigation],[role=tablist]'), p = n && pinned(n); if (!p) return null; const r = bcr(p); return r.top > H * 0.5 && r.bottom >= H - 48 ? p : null; };
  const langOf = (e) => { const c = e.closest(CTL) || e, l = c.getAttribute('lang') || c.getAttribute('hreflang'); return (l && !html.lang.toLowerCase().startsWith(l.toLowerCase().slice(0, 2))) || /(^|[-_\s])(lang|language|locale)([-_\s]|$)/i.test(cls(c) + ' ' + c.id) || /language|اللغة/i.test(c.getAttribute('aria-label') || '') || /^(english|en|ar|ع|عربي|العربية)$/i.test(txtOf(c).trim()) ? 'lang' : null; };
  const rowOf = (e) => { for (let a = e.parentElement, d = 0; a && a !== document.body && d < 5; a = a.parentElement, d++) { const n = a.querySelectorAll(CTL).length; if (n > 3) return null; if (n >= 2 && bcr(a).height <= 200 && (a.matches('li,tr,[role=row],[role=listitem],[role=option]') || [...(a.parentElement?.children || [])].some((k) => k !== a && k.tagName === a.tagName && cls(k) === cls(a)))) return a; } return null; };
  const units = (list, key) => new Set(list.map((x) => key(x))).size, ctlUnits = units(controls, (e) => navOf(e) || langOf(e) || e);
  // The text count proves the rendered page was read (measure.textElements); no budget. Viz series labels count once.
  const markish = (k) => { const cs = gcs(k); return rgba(cs.backgroundColor)[3] > 0.3 || ['Top', 'Right', 'Bottom', 'Left'].some((sd) => parseFloat(cs['border' + sd + 'Width']) >= 2 && rgba(cs['border' + sd + 'Color'])[3] > 0.3); };
  const onPic = (e) => { const v = vizLab(e); if (!v) return null; if (e.el.closest('svg,canvas')) return v; for (let a = e.el, d = 0; a && a !== v; a = a.parentElement, d++) { if (/absolute|fixed/.test(gcs(a).position)) return v; if (d < 4 && markish(a) && [...(a.parentElement?.children || [])].filter((k) => k.tagName === a.tagName && cls(k) === cls(a)).length >= 3) return v; } return null; };
  const textUnits = units(fold, (e) => navOf(e.el) || onPic(e) || (e.el.closest(CTL) && langOf(e.el)) || e);
  const box = (r, k = 0) => ({ l: r.left, t: r.top + r.height * k, r: r.right, b: r.bottom - r.height * k }), area = (x) => Math.max(0, x.r - x.l) * Math.max(0, x.b - x.t);
  const meet = (a, b) => ({ w: Math.min(a.r, b.r) - Math.max(a.l, b.l), h: Math.min(a.b, b.b) - Math.max(a.t, b.t) }), cut = (x, c) => ({ l: Math.max(x.l, c.left), t: Math.max(x.t, c.top), r: Math.min(x.r, c.right), b: Math.min(x.b, c.bottom) });
  // text-overlap: on the ink of each line (the font's real glyph ascent and descent around its baseline), never the
  // line box (round 1: Arabic faces carry tall line boxes that overlapped where no glyph did).
  // The ink of the text as set: text-transform applied (final re-check 2026-10-28: tight uppercase display lines were measured with lowercase descenders).
  const caseOf = (e) => { const t = e.text.slice(0, 200) || 'x', tt = e.cs.textTransform; return tt === 'uppercase' ? t.toUpperCase() : tt === 'lowercase' ? t.toLowerCase() : tt === 'capitalize' ? t.replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase()) : t; };
  const inkMemo = new Map(), inkOf = (e) => { const k = e.cs.font + '|' + e.cs.textTransform + '|' + e.text.slice(0, 80); if (inkMemo.has(k)) return inkMemo.get(k); cx.font = e.cs.font; const m = cx.measureText(caseOf(e)), fa = m.fontBoundingBoxAscent, fd = m.fontBoundingBoxDescent, v = fa + fd > 0 ? { fa, fd, a: Math.min(fa, m.actualBoundingBoxAscent), d: Math.min(fd, m.actualBoundingBoxDescent) } : null; inkMemo.set(k, v); return v; };
  const inkRect = (e, r) => { const k = inkOf(e); if (!k) return box(r, 0.18); const s = r.height / (k.fa + k.fd), base = r.top + k.fa * s; return { l: r.left, r: r.right, t: base - k.a * s, b: base + k.d * s }; };
  const ink = (k, f) => { const cs = gcs(k), c = cs[f]; return c === 'none' ? 0 : (/^url/.test(c) ? 1 : rgba(c)[3]) * +cs[f + 'Opacity'] * opac(k); };
  // a knocked-out viz label may sit on its own viz's marks
  const knock = (el) => { for (let a = el, d = 0; a && d < 3 && a !== document.body && !a.matches('[data-viz]'); a = a.parentElement, d++) { const cs = gcs(a), sh = [...cs.textShadow.matchAll(/(-?[\d.]+)px (-?[\d.]+)px ([\d.]+)px/g)];
    if (rgba(cs.backgroundColor)[3] > 0.5 || (/^stroke/.test(cs.paintOrder) && ((cs.stroke !== 'none' && parseFloat(cs.strokeWidth) > 0) || parseFloat(cs.webkitTextStrokeWidth) > 0)) || sh.some((m) => +m[3] >= 2) || sh.length >= 4) return true;
    const t = bcr(a); for (let p = a.previousElementSibling, i = 0; p && i < 3; p = p.previousElementSibling, i++) { const q = bcr(p); if (p.matches('rect,path,ellipse,circle,polygon') && ink(p, 'fill') > 0.5 && q.left <= t.left + 2 && q.right >= t.right - 2 && q.top <= t.top + t.height / 2 && q.bottom >= t.bottom - t.height / 2) return true; } } return false; };
  const lay = shown.filter((e) => e.op >= 0.1).map((e) => ({ e, pin: pinned(e.el), viz: e.el.closest('[data-viz]'), ko: e.el.closest('[data-viz]') ? knock(e.el) : e.el instanceof SVGElement && /^stroke/.test(e.cs.paintOrder) && e.cs.stroke !== 'none' && parseFloat(e.cs.strokeWidth) > 0, bx: e.rects.map((r) => cut(inkRect(e, r), clipOf(e.el))).filter((x) => x.r - x.l >= 1 && x.b - x.t >= 1) })).filter((x) => x.bx.length);
  // A rotated mockup (a tilted phone) is read in its own coordinates: transforms off, each line's ink again (final re-check 2026-10-28).
  const tilt = (a) => { const cs = gcs(a), m = cs.transform !== 'none' ? new DOMMatrix(cs.transform) : null; return !!(m && (Math.abs(m.b) > 0.01 || Math.abs(m.c) > 0.01)) || (!!cs.rotate && cs.rotate !== 'none' && Math.abs(parseFloat(cs.rotate.split(' ').pop()) % 360) > 0.5); };
  const flatInk = new Map(), tilted = [...qsa('*')].filter((a) => !(a instanceof SVGElement) && tilt(a)), tiltSet = new Set(tilted);
  const rotOf = (el) => { let v = null; if (!tiltSet.size) return v; for (let a = el; a && a !== document.body; a = a.parentElement) if (tiltSet.has(a)) v = a; return v; };
  if (tilted.length) {
    const props = ['transition', 'transform', 'rotate'], kept = tilted.map((a) => props.map((p) => [p, a.style.getPropertyValue(p), a.style.getPropertyPriority(p)]));
    for (const a of tilted) for (const p of props) a.style.setProperty(p, 'none', 'important');
    const flatClip = (el) => { let c = { top: -1e9, left: -1e9, bottom: 1e9, right: 1e9 }; for (let a = el; a && a !== document.body && a !== html; a = a.parentElement) { const cs = gcs(a); if (/(hidden|auto|scroll|clip)/.test(cs.overflowX + cs.overflowY)) { const b = bcr(a); c = { top: Math.max(c.top, b.top), left: Math.max(c.left, b.left), bottom: Math.min(c.bottom, b.bottom), right: Math.min(c.right, b.right) }; } } return c; };
    for (const e of shown) if (rotOf(e.el)) { const c = flatClip(e.el); flatInk.set(e, e.nodes.flatMap((n) => { rg.selectNodeContents(n); return [...rg.getClientRects()]; }).filter((r) => r.width >= 1 && r.height >= 1).map((r) => cut(inkRect(e, r), c)).filter((x) => x.r - x.l >= 1 && x.b - x.t >= 1)); }
    tilted.forEach((a, i) => { for (const [p, v, pr] of kept[i].slice(1)) a.style.setProperty(p, v, pr); void a.offsetWidth; const [p, v, pr] = kept[i][0]; a.style.setProperty(p, v, pr); });
  }
  const flatHit = (A, C) => (flatInk.get(A.e) || []).some((a) => (flatInk.get(C.e) || []).some((b) => { const m = meet(a, b); return m.w >= 3 && m.h >= 3; }));
  const solid = (el, other) => { for (let a = el; a && a !== document.body && !a.contains(other); a = a.parentElement) { const cs = gcs(a); if (rgba(cs.backgroundColor)[3] > 0.9 || cs.backdropFilter !== 'none' || cs.backgroundImage !== 'none') return true; } return false; };
  const branch = (n, other, h) => { for (let a = n; a && a !== document.body; a = a.parentElement) { if (a.contains(other)) return false; if (a.contains(h)) return true; } return false; };
  const behind = (x, y, p, q, both) => { const h = document.elementFromPoint(x, y); return !!h && ((branch(p, q, h) && solid(p, q)) || (!!both && branch(q, p, h) && solid(q, p))); };
  const hitBy = (A, bx, inside, other) => A.bx.some((a) => bx.some((b) => { const m = meet(a, b); return m.w >= 3 && m.h >= 3 && !(inside && b.l <= a.l + 2 && b.r >= a.r - 2 && b.t <= a.t + 2 && b.b >= a.b - 2) && !(other && behind(Math.max(a.l, b.l) + m.w / 2, Math.max(a.t, b.t) + m.h / 2, A.e.el, other, !inside)); }));
  const overlaps = new Set();
  for (let i = 0; i < lay.length; i++) for (let j = i + 1; j < lay.length; j++) { const A = lay[i], C = lay[j], ca = A.e.el.closest(CTL); if (A.pin !== C.pin || A.e.el.contains(C.e.el) || C.e.el.contains(A.e.el) || (ca && ca === C.e.el.closest(CTL) && [A.e.el, C.e.el].some((x) => { for (let a = x; a && a !== ca; a = a.parentElement) if (/absolute|fixed/.test(gcs(a).position)) return true; return false; }))) continue; const rot = rotOf(A.e.el); if (rot && rot === rotOf(C.e.el) ? flatHit(A, C) : hitBy(A, C.bx, false, C.e.el)) overlaps.add(`"${clip(A.e.text)}" and "${clip(C.e.text)}"`); }
  const veil = [...qsa('*')].filter((k) => { const r = bcr(k); return gcs(k).pointerEvents === 'none' && r.width >= W * 0.9 && r.height >= Math.min(H, document.body.offsetHeight) * 0.9 && !txtOf(k).trim(); });
  // An SVG control shape is tested by its painted shape, never its box.
  const ctlBox = ctl.filter((c) => opac(c) >= 0.1 && !(c instanceof SVGElement && c.localName !== 'svg')).map((c) => ({ c, pin: pinned(c), bx: [...c.getClientRects()].map((r) => cut({ l: r.left + 1, t: r.top + 1, r: r.right - 1, b: r.bottom - 1 }, clipOf(c))).filter((x) => area(x) > 0) }));
  for (const A of lay) for (const C of ctlBox) { const lab = A.e.el.closest('label,legend'); if (A.pin !== C.pin || C.c.contains(A.e.el) || A.e.el.contains(C.c) || (lab && (lab.control === C.c || lab.contains(C.c)))) continue; if (hitBy(A, C.bx, true, C.c)) overlaps.add(`"${clip(A.e.text)}" and ${sel(C.c)}`); }
  const marks = [...qsa('*')].filter((m) => { if (m.closest('.gb-switch') || m.matches(CTL)) return false; const r = bcr(m); if (r.width < 4 || r.height < 4 || r.width > 40 || r.height > 40) return false; const cs = gcs(m); if (cs.visibility === 'hidden' || opac(m) < 0.25) return false; if (m instanceof SVGElement) return m.matches('circle,ellipse,rect,polygon,path,image,use') && (m.matches('image,use') || ink(m, 'fill') >= 0.25 || ink(m, 'stroke') >= 0.25); return !m.children.length && !m.textContent.trim() && (rgba(cs.backgroundColor)[3] > 0.5 || cs.backgroundImage !== 'none'); }).map((m) => ({ m, pin: pinned(m), r: cut(box(bcr(m)), clipOf(m)) })).filter((k) => area(k.r) > 0);
  // SVG text on an SVG shape: only where the shape's fill is under the label's ink (a map pin beside its label passes; round 3).
  const inFill = (k, x, y) => { const m = k.getScreenCTM(); return !!m && k.isPointInFill(new DOMPoint(x, y).matrixTransform(m.inverse())); };
  for (const A of lay) for (const K of marks) { if (A.pin !== K.pin || A.e.el.contains(K.m) || (A.ko && K.m.closest('[data-viz]') === A.viz)) continue; if (A.bx.some((a) => { const m = meet(a, K.r), x = Math.max(a.l, K.r.l) + m.w / 2, y = Math.max(a.t, K.r.t) + m.h / 2; return area(K.r) < area(a) && m.w > 0 && m.h > 0 && m.w * m.h >= Math.max(12, area(K.r) * 0.25) && !(A.e.el instanceof SVGElement && K.m instanceof SVGGeometryElement && !inFill(K.m, x, y)) && !behind(x, y, A.e.el, K.m); })) overlaps.add(`"${clip(A.e.text)}" and a ${K.m.localName}${cls(K.m).trim() ? '.' + cls(K.m).trim().split(/\s+/)[0] : ''}`); }
  // Paint over the glyphs or a line through them: hit tests on glyph lines.
  const pe = document.createElement('style'); pe.textContent = '*{pointer-events:auto!important}'; document.head.append(pe);
  const jobs = [], X0 = scrollX, Y0 = scrollY, solidHit = (k, x, y) => { if (k instanceof SVGGeometryElement) { const cs = gcs(k), m = k.getScreenCTM(); return cs.fill !== 'none' && +cs.fillOpacity * opac(k) > 0.9 && !!m && k.isPointInFill(new DOMPoint(x, y).matrixTransform(m.inverse())); } if (k instanceof SVGElement) return false; const cs = gcs(k); return k.matches('img,video,canvas,iframe') || rgba(cs.backgroundColor)[3] >= 0.6 || cs.backdropFilter !== 'none' || (cs.backgroundImage !== 'none' && !/transparent|rgba\([^)]*,\s*0\)/.test(cs.backgroundImage)); };
  const paints = (k, x, y) => { if (k instanceof SVGGeometryElement) { const m = k.getScreenCTM(); return ink(k, 'fill') >= 0.25 && !!m && k.isPointInFill(new DOMPoint(x, y).matrixTransform(m.inverse())); } if (opac(k) < 0.25) return false; if (k.matches('image,img,video,canvas,iframe')) return true; if (k instanceof SVGElement) return false; const cs = gcs(k), r = bcr(k); if (rgba(cs.backgroundColor)[3] * opac(k) > 0.3 || (cs.backgroundImage !== 'none' && !/transparent|rgba\([^)]*,\s*0\)/.test(cs.backgroundImage))) return true; return [['Top', y - r.top], ['Bottom', r.bottom - y], ['Left', x - r.left], ['Right', r.right - x]].some(([sd, d]) => { const bw = parseFloat(cs['border' + sd + 'Width']); return bw > 0 && d <= bw && rgba(cs['border' + sd + 'Color'])[3] > 0.3; }); };
  const kin = (A, k) => !k || veil.some((v) => v.contains(k)) || k === A.e.el || k.contains(A.e.el) || A.e.el.contains(k) || pinned(k) !== A.pin || k.closest('.gb-switch') || opac(k) < 0.1 || ((mv) => mv && !mv.contains(k))(moving(A.e.el, true));
  const label = (k) => `a ${k.localName}${cls(k).trim() ? '.' + cls(k).trim().split(/\s+/)[0] : ''}`, hits = new Map(), hit = (A, k) => { const key = `"${clip(A.e.text)}" and ${label(k)}`; hits.set(key, (hits.get(key) || 0) + 1); };
  const glyphs = lay.map((A) => ({ A, g: A.e.rects.map((r) => { const q = inkRect(A.e, r), h = q.b - q.t; return { l: q.l + scrollX, r: q.r + scrollX, t: q.t + scrollY + h * 0.15, b: q.b + scrollY - h * 0.15 }; }).filter((g) => g.r - g.l >= 2 && g.b > g.t) }));
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
  if (overlaps.size) add('FAIL', 'text-overlap', `${overlaps.size} overlap(s) of text with text, a control or a marker: ${[...overlaps].slice(0, 3).join('; ')}; give each label its own room (offset it, shorten it, wrap it, or give the object more room)`);
  // clipped-text; display type (40px or more) marked data-bleed may run off its box on purpose (a wordmark at the edge).
  const ell = (x) => { const s = gcs(x); return s.textOverflow === 'ellipsis' || (s.webkitLineClamp && s.webkitLineClamp !== 'none'); }, cutText = [];
  for (const e of shown) {
    if (e.text.length < 2 || e.op < 0.1 || (e.px >= 40 && e.el.closest('[data-bleed]'))) continue; let hit = null, rs = e.rects.map((r) => { if (e.el instanceof SVGElement) { const k = inkRect(e, r); return { left: k.l, right: k.r, top: k.t, bottom: k.b }; } return { left: r.left, right: r.right, top: r.top + r.height * 0.18, bottom: r.bottom - r.height * 0.18 }; }); // SVG text by its ink
    for (let a = e.el, d = 0; a && a !== document.body && a !== html && d < 10 && !hit; a = a.parentElement, d++) {
      const cs = a === e.el ? e.cs : gcs(a), cx = /hidden|clip/.test(cs.overflowX), cy = /hidden|clip/.test(cs.overflowY);
      if ((/auto|scroll/.test(cs.overflowX) && a.scrollWidth > a.clientWidth + 1) || (/auto|scroll/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1)) break;
      if (!cx && !cy) continue;
      const b = bcr(a), L = b.left + (a.clientLeft || 0), T = b.top + (a.clientTop || 0), R = a.clientWidth ? L + a.clientWidth : b.right, Bm = a.clientHeight ? T + a.clientHeight : b.bottom, pan = a.localName === 'svg' ? a.matches('[data-pan],[role=application]') || /grab|move/.test(cs.cursor) || cs.touchAction === 'none' : panBox(a);
      rs = rs.filter((r) => r.right > L && r.left < R && r.bottom > T && r.top < Bm);
      if (!ell(a)) for (const r of rs) { const sx = cx && (r.right > R + 1 || r.left < L - 1), sy = cy && (r.bottom > Bm + 1 || r.top < T - 1); if (pan ? sx && (rtl ? r.right <= R + 1 : r.left >= L - 1) : sx || sy) { hit = sel(a); break; } }
      rs = rs.map((r) => ({ left: cx ? Math.max(r.left, L) : r.left, right: cx ? Math.min(r.right, R) : r.right, top: cy ? Math.max(r.top, T) : r.top, bottom: cy ? Math.min(r.bottom, Bm) : r.bottom }));
    }
    if (!hit && html.scrollWidth <= W + 1 && !moving(e.el, true) && rs.some((r) => (r.left < -1 && r.right > 1) || (r.right > W + 1 && r.left < W - 1))) hit = 'the screen edge';
    if (hit) cutText.push(`"${clip(e.text)}" in ${hit}`);
  }
  const spill = [];
  for (const e of shown) {
    if (e.text.length < 2 || e.op < 0.1 || e.el instanceof SVGElement || moving(e.el, true)) continue; let card = null;
    for (let a = e.el, d = 0; a && a !== document.body && a !== html && d < 8; a = a.parentElement, d++) { const cs = a === e.el ? e.cs : gcs(a); if (/absolute|fixed/.test(cs.position) || /hidden|clip|auto|scroll/.test(cs.overflowX + cs.overflowY)) break; if (rgba(cs.backgroundColor)[3] > 0.3 || ['Top', 'Right', 'Bottom', 'Left'].some((k) => parseFloat(cs['border' + k + 'Width']) > 0 && rgba(cs['border' + k + 'Color'])[3] > 0.3)) { card = a; break; } }
    if (!card) continue; const c = bcr(card); if (c.width >= W - 2) continue;
    const out = Math.max(0, ...e.rects.map((r) => Math.max(c.left - r.left, r.right - c.right, c.top - r.top - r.height * 0.18, r.bottom - r.height * 0.18 - c.bottom)));
    if (out > 2) spill.push(`"${clip(e.text)}" ${Math.round(out)}px out of ${sel(card)}`);
  }
  if (spill.length) add('FAIL', 'text-spill', `${spill.length} text block(s) run out of their card: ${spill.slice(0, 3).join('; ')}; let it wrap, end it with text-overflow: ellipsis, or give the card room`);
  if (cutText.length) add('FAIL', 'clipped-text', `${cutText.length} text block(s) cut off by their box (overflow hidden, no ellipsis): ${cutText.slice(0, 3).join('; ')}; let it wrap, give the box room, or end it with text-overflow: ellipsis`);
  const trapOf = (e) => { for (let a = e.parentElement; a && a !== html; a = a.parentElement) { const cs = gcs(a); for (const [k, v] of [['transform', cs.transform], ['filter', cs.filter], ['backdrop-filter', cs.backdropFilter], ['perspective', cs.perspective], ['contain', /paint|layout|strict|content/.test(cs.contain) ? cs.contain : ''], ['will-change', /transform|filter|perspective/.test(cs.willChange) ? cs.willChange : ''], ['container-type', /size/.test(cs.containerType) ? cs.containerType : '']]) if (v && v !== 'none') return `${sel(a)} (${k}: ${v.slice(0, 28)})`; } return null; };
  for (const f of [...qsa('*')].filter((e) => gcs(e).position === 'fixed' && vis(e) && opac(e) >= 0.1 && !e.closest('.gb-switch,[aria-hidden="true"],[inert]') && !srOnly(e))) {
    const t = trapOf(f); if (!t) continue; const r = bcr(f), off = r.top < -1 || r.left < -1 || r.bottom > H + 1 || r.right > W + 1;
    add(off ? 'FAIL' : 'WARN', 'fixed-trapped', `position: fixed ${sel(f)} is pinned to ${t}, not the screen, so it ${off ? 'lands off screen' : 'scrolls away with that box'}; move it out of that box or drop that property`);
  }
  const scr = mobile ? 'first phone screen' : `first screen at ${W}`;
  {
    const place = (e) => { const r = bcr(e), inView = r.top >= -1 && r.left >= -1 && r.bottom <= H + 1 && r.right <= W + 1, hit = inView && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { r, inView, cover: hit && !e.contains(hit) && !hit.contains(e) ? hit : null }; };
    const itemOf = (e) => { for (let a = e.parentElement, d = 0; a && a !== document.body && d < 5; a = a.parentElement, d++) { if (a.querySelectorAll(CTL).length > 3) return null; if (bcr(a).height <= 200 && (a.matches('li,tr,[role=row],[role=listitem],[role=option]') || (cls(a).trim() && [...(a.parentElement?.children || [])].filter((k) => k !== a && k.tagName === a.tagName && cls(k) === cls(a)).length >= 2))) return a; } return null; };
    let prim = document.querySelector('[data-primary]'), unsure = false; if (prim && !vis(prim)) prim = null; const marked = !!prim;
    if (!prim && !/[?&]state=/.test(location.search)) {
      const cands = []; for (const e of (document.querySelector('main,[role=main]') || document.body).querySelectorAll('button,[role=button],a[href],input[type=submit]')) { if (!vis(e) || srOnly(e) || opac(e) < 0.1 || e.closest('nav,[role=navigation],.gb-switch,[aria-hidden="true"],[inert]') || rowOf(e) || itemOf(e)) continue; const cs = gcs(e), bg = rgba(cs.backgroundColor), r = bcr(e); if ((bg[3] < 0.5 && cs.backgroundImage === 'none') || r.height > 120) continue; const k = bg[3] >= 0.5 ? ratio(bg, bgOf(e.parentElement) || [255, 255, 255, 1]) : 3; if (k >= 1.5) cands.push({ e, score: r.width * r.height * k }); }
      // The strongest filled button that reaches the first screen is the main action (round 1: a cut one passed when a smaller button showed whole).
      const top = cands.filter((c) => { const r = bcr(c.e); return r.top < H - 1 && r.bottom > 1; }).sort((a, b) => b.score - a.score);
      // One clear button (alone, or twice the next one's weight) is the main action; a close call is a guess, so it only WARNs (round 3).
      prim = top[0]?.e || null; unsure = top.length > 1 && top[0].score < top[1].score * 2;
    }
    const how = unsure ? `; "${clip(txtOf(prim))}" is a guess between buttons of like weight: mark the main action data-primary` : marked || !prim ? '' : `; "${clip(txtOf(prim))}" is the guessed main action: mark the real one data-primary if it is not`;
    const VAGUE = /^(click here|click|here|learn more|read more|find out more|discover more|see more|more|submit|go|ok)$/i;
    if (prim && VAGUE.test(clip(txtOf(prim) || prim.getAttribute('aria-label') || '').replace(/[.!→›>]+$/, '').trim())) add(unsure ? 'WARN' : 'FAIL', 'vague-action', `the main action says "${clip(txtOf(prim) || prim.getAttribute('aria-label'))}", which names no action; say what happens ("Book a court", "Send the invoice")${how}`);
    if (prim) {
      const { r, inView, cover } = place(prim), trap = pinned(prim) && trapOf(pinned(prim));
      const meets = r.top < H - 1 && r.bottom > 1 && r.left < W - 1 && r.right > 1, sideways = r.top < H - 1 && r.bottom > 1 && !!moving(prim) && (r.left >= W - 1 || r.right <= 1), cutOff = (meets && !inView) || sideways, name = clip(txtOf(prim) || prim.getAttribute('aria-label') || sel(prim));
      if (cutOff || cover) add(unsure ? 'WARN' : 'FAIL', 'primary-offscreen', `the main action "${name}" ${cutOff ? `is cut off by the ${r.bottom > H + 1 ? 'bottom' : r.top < -1 ? 'top' : 'side'} edge of the ${scr} (it sits ${Math.round(r.top)} to ${Math.round(r.bottom)}px down and ${Math.round(r.left)} to ${Math.round(r.right)}px across, in ${W}x${H})${moving(prim) ? ` in a sideways scroller ${sel(moving(prim))}` : ''}` : `is covered by ${sel(pinned(cover) || cover)}`}${trap ? `; its position: fixed is trapped by ${trap}` : ''}; show it whole and uncovered, or move it clear of the edge (at 390 a sticky bottom bar works)${how}`);
    }
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
  const leak = [...qda('[hidden]:not([hidden=until-found])')].filter((e) => gcs(e).display !== 'none' && vis(e) && opac(e) >= 0.1 && !e.closest('.gb-switch') && !e.parentElement?.closest('[hidden]:not([hidden=until-found])'));
  if (leak.length) add('FAIL', 'hidden-shown', `${leak.length} element(s) carry the hidden attribute but still show, a display rule beats [hidden]: ${leak.slice(0, 3).map((e) => `${sel(e)} "${clip(txtOf(e))}"`).join(', ')}; add [hidden]{display:none!important}`);
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
  // 9. copy tells and GoBanana copy rules
  const txt = document.body.innerText;
  // Content honesty (owner 2026-10-28): stock copy, a vague main action, emoji and placeholder pictures FAIL.
  if (/lorem ipsum|dolor sit|John Doe|Jane Doe|\bAcme\b|\bItem \d\b|User name/i.test(txt)) add('FAIL', 'placeholder', 'placeholder copy on the page (lorem, John Doe, Acme, Item 1)');
  // Marketing phrases, never single words: "seamless gutters" is a product (final re-check 2026-10-28). The user's own copy in [data-user-text] is theirs.
  const ownTxt = shown.filter((e) => !e.el.closest('[data-user-text]')).map((e) => e.text).join(' ');
  const STOCK = /\b(?:unlock(?:s|ing)? (?:your|their|the|its) (?:full |true )?potential|unleash(?:es|ing)? (?:your|the) (?:full )?(?:power|potential)|supercharge(?:s)? your \w+|seamless(?:ly)? (?:experience|integration|workflow|solution)s?|elevate(?:s)? your (?:experience|game|brand|business|workflow)|empower(?:s|ing)? (?:you|your (?:team|business)|teams|businesses) to|effortless(?:ly)? (?:experience|solution)s?|cutting[- ]edge (?:technology|solutions?|platform)|next[- ]gen(?:eration)? (?:platform|solutions?|experience)|world[- ]class (?:experience|solutions?|platform|service)|all[- ]in[- ]one (?:solution|platform|hub)|revolutioni[sz]e(?:s)? (?:the way|how) you|takes? (?:it|your \w+|things) to the next level|reimagined for the modern|streamline(?:s)? your workflow|game[- ]chang(?:er|ing))\b/gi;
  const filler = [...new Set((ownTxt.match(STOCK) || []).map((x) => x.toLowerCase()))];
  if (filler.length) add('FAIL', 'stock-copy', `stock phrases on the page: ${filler.slice(0, 6).join(', ')}; write the product's own words (a real name, a real number, what it does), or mark what is not known "to confirm"; quote the user's own copy in [data-user-text]`);
  const EMOJI = /\p{Emoji_Presentation}|\p{Extended_Pictographic}\uFE0F/u, emo = shown.filter((e) => EMOJI.test(e.text) && !e.el.closest('code,pre,kbd,samp,[data-user-text]'));
  if (emo.length) add('FAIL', 'emoji', `${emo.length} text block(s) with emoji in the interface ("${clip(emo[0].text)}"); use a drawn icon (inline SVG) or a word; a user's own message keeps its emoji in [data-user-text]`);
  const artOf = (x) => { const st = gcs(x); return st.backgroundImage !== 'none' || (st.maskImage && st.maskImage !== 'none') || ['::before', '::after'].some((ps) => !/^(none|normal|""|)$/.test(gcs(x, ps).content)); };
  const phBox = [...qsa('div,span,figure,picture,i,b,a')].filter((e) => { if (e.closest('[data-viz],svg,.gb-switch,[data-shape],button,[role=button],[role=progressbar],[aria-busy=true],[role=img][aria-label],[role=img][aria-labelledby]') || e.matches(CTL)) return false; const r = bcr(e), k = r.width / r.height;
    if (r.width < 80 || r.height < 60 || k < 0.5 || k > 2.5 || r.width * r.height > W * H * 0.4 || !vis(e) || opac(e) < 0.1 || srOnly(e)) return false; const cs = gcs(e), bg = rgba(cs.backgroundColor), pb = bgOf(e.parentElement);
    if (bg[3] <= 0.5 || artOf(e) || cs.filter !== 'none' || cs.clipPath !== 'none' || (/%/.test(cs.borderTopLeftRadius) ? parseFloat(cs.borderTopLeftRadius) * Math.min(r.width, r.height) / 100 : parseFloat(cs.borderTopLeftRadius)) >= Math.min(r.width, r.height) / 2 - 1 || (pb && Math.hypot(...over(bg, pb).slice(0, 3).map((v, i) => v - pb[i])) <= 4)) return false;
    return !txtOf(e).trim() && !e.querySelector('img,svg,canvas,video,picture,iframe,object,embed,input,select,textarea') && ![...e.querySelectorAll('*')].some((k) => vis(k) && (artOf(k) || rgba(gcs(k).backgroundColor)[3] > 0.3)); });
  const phImg = [...qda('img')].filter((e) => !e.closest('.gb-switch') && vis(e) && ((e.complete && !e.naturalWidth) || /placehold|placeholder|dummyimage|placekitten|fakeimg|\/via\.placeholder/i.test(e.currentSrc || e.src || '')));
  const ph = [...phBox.filter((e) => !phBox.some((o) => o !== e && o.contains(e))).map((e) => [e, 'a flat colour box']), ...phImg.map((e) => [e, e.complete && !e.naturalWidth ? 'an image that did not load' : 'a placeholder image service'])];
  if (ph.length) add('FAIL', 'placeholder-media', `${ph.length} placeholder picture(s): ${ph.slice(0, 3).map(([e, why]) => { const r = bcr(e); return `${sel(e)} ${Math.round(r.width)}x${Math.round(r.height)} (${why})`; }).join(', ')}; show the real picture (the pictures ladder in gobanana-draft/pictures), draw the thing with type and shapes, or cut the box (a drawn shape on purpose: data-shape)`);
  if (ar && /[\u064B-\u065F\u0670]/.test(txt)) add('FAIL', 'ar-diacritics', 'Arabic diacritics on the page');
  if (ar && /[\u0660-\u0669\u06F0-\u06F9]/.test(txt)) add('FAIL', 'eastern-digits', 'Eastern Arabic digits; use Western digits 0 to 9');
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
  // The Arabic copy rules apply on an Arabic page only (one language, owner 2026-10-28).
  if (ar) for (const [id, list, what] of [['ar-register', AR_SLANG, 'dialect words; write Gulf MSA'], ['ar-loanword', AR_LOAN, 'English spelled in Arabic letters; use the Arabic word']]) {
    const re = arWord(list), hits = shown.filter((e) => re.test(e.text)); if (hits.length) add('FAIL', id, `${hits.length} text block(s) with ${what}: ${[...new Set(hits.map((e) => e.text.match(re)[1]))].slice(0, 6).join('، ')} ("${clip(hits[0].text)}")`);
  }
  const raw = prose.filter((e) => RAW.test(e.text)); if (raw.length) add('FAIL', 'raw-telemetry', `${raw.length} text block(s) show a command, flag or hash as copy ("${clip(raw[0].text)}"); say what happened in product words, keep IDs quiet in mono, a real log only in a labelled <pre data-log>`);
  if (ar) {
    const nameW = (w) => /[A-Z\d]/.test(w) || /^(of|and|the|for|de|al|x|by|on|in|at|to|&)$/.test(w);
    const uiW = /^(review|approve|waiting|queue|settings|overview|marketing|product|products|sales|today|yesterday|more|less|all|open|done|new|save|cancel|send|edit|delete|view|search|home|profile|account|next|back|continue|submit|close|add|remove|details|status|pending|draft|posts|changes|request|menu|help|sign|login|update|filter|total|order|orders|checkout|now|week|month|items|tasks|team|users|report|reports|messages|inbox|dashboard|loading|error|retry|again|buy|start|see|show|hide|your|you|social|unread)$/;
    const enRun = (p) => { const ws = p.split(/[\s,:;]+/).filter(Boolean); if (ws.every(nameW) || (ws.length <= 4 && ws.some((w) => /^v\d|^\d+(\.\d+)+$/i.test(w)))) return false;
      return !(ws.length <= 3 && !/[A-Z]/.test(p) && !ws.some((w) => uiW.test(w.toLowerCase().replace(/[^a-z]/g, '')))); };
    const en = prose.filter((e) => !e.el.closest('[lang^="en"],[translate="no"]') && (e.text.match(/[A-Za-z][\w'’&.-]*(?:[\s,:;]+[A-Za-z\d&][\w'’&.-]*)+/g) || []).some(enRun));
    if (en.length) add('FAIL', 'untranslated', `${en.length} English label(s) or phrase(s) on the Arabic page ("${clip(en[0].text)}"); write it in Arabic, or mark a brand or product name translate="no" and a quoted original lang="en"`);
    const wid = (f, t) => { cx.font = `40px ${f}`; return cx.measureText(t).width; }, gen = ['serif', 'sans-serif', 'monospace'], faceMemo = new Map();
    const digitFace = (e) => { const k = e.cs.fontFamily; if (!faceMemo.has(k)) faceMemo.set(k, k.split(',').map((f) => f.replace(/["']/g, '').trim()).find((f) => /^(serif|sans-serif|monospace|system-ui|ui-\w+|cursive|fantasy)$/.test(f) || gen.some((g) => Math.abs(wid(`"${f}", ${g}`, '0123456789') - wid(g, '0123456789')) > 0.5)) || null); return faceMemo.get(k); };
    const latD = shown.filter((e) => /\d/.test(e.text) && !e.el.closest('[lang^="en"],code,pre,kbd,samp') && ((f) => f && !/^(serif|sans-serif|monospace|system-ui|ui-\w+|cursive|fantasy)$/.test(f) && gen.every((g) => Math.abs(wid(`"${f}", ${g}`, 'ابتثجحخ') - wid(g, 'ابتثجحخ')) < 0.5))(digitFace(e)));
    if (latD.length) add('WARN', 'latin-digits-in-arabic', `${latD.length} block(s) of figures on the Arabic page are set in ${digitFace(latD[0])}, a face with no Arabic ("${clip(latD[0].text)}"); set them in the Arabic face (Western digits), never a Latin mono`);
    const bidi = shown.filter((e) => !e.el.closest('bdi,[dir="ltr"],[dir="auto"]') && [...e.el.childNodes].some((n) => n.nodeType === 3 && /[؀-ۿ]/.test(n.nodeValue) && /[A-Za-z]{2,}[\s:.,()-]*\d|\d[\s:.,()-]*[A-Za-z]{2,}|\d\s*(?:\u00b0\s*[CF]\b|%)|(?:\u00b0\s*[CF]|%)\s*\d/.test(n.nodeValue)));
    if (bidi.length) add('WARN', 'ar-bidi', `${bidi.length} Arabic text block(s) with a Latin word or a unit (°C, °F, %) next to digits and no <bdi> ("${clip(bidi[0].text)}"); wrap the Latin run or the number with its unit in <bdi>`);
  }
  const scripts = { latin: T.some((e) => /[A-Za-z]/.test(e.text)), arabic: T.some((e) => /[؀-ۿ]/.test(e.text)) };
  // font-not-loaded (final re-check 2026-10-28): a face the page requests (an @font-face, or a font link such as Google Fonts)
  // that never loaded for its text; a face it never requests FAILs unless it is a known system face, which passes even where
  // this machine lacks it (Georgia on Linux).
  const loadedFonts = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family.replace(/["']/g, '').trim());
  const GENERIC = /^(serif|sans-serif|monospace|cursive|fantasy|math|emoji|fangsong|system-ui|ui-[\w-]+|-apple-system|blinkmacsystemfont|inherit|initial|unset)$/i;
  const SYSTEM = /^(arial|arial black|helvetica|helvetica neue|georgia|times|times new roman|verdana|tahoma|trebuchet ms|courier|courier new|impact|segoe ui|segoe ui variable|roboto|sf pro( text| display| rounded)?|sf mono|new york|menlo|monaco|consolas|lucida grande|lucida console|palatino|palatino linotype|book antiqua|garamond|baskerville|didot|optima|futura|gill sans|avenir|avenir next|charter|iowan old style|hoefler text|american typewriter|calibri|cambria|candara|constantia|corbel|aptos|ubuntu|cantarell|geeza pro|al nile|damascus|baghdad|sakkal majalla|simplified arabic|traditional arabic|arabic typesetting|dubai|(noto|dejavu|liberation) [\w ]+)$/i;
  const famKey = (f) => f.replace(/["']/g, '').trim().toLowerCase(), faces = [...document.fonts];
  const linked = new Set([...qda('link[href]')].flatMap((l) => { try { const u = new URL(l.href); return /fonts\.(googleapis|bunny)\.net|typekit|fontshare|cdnfonts/.test(u.host) ? u.searchParams.getAll('family').flatMap((v) => v.split('|')).map((v) => famKey(v.split(':')[0])) : []; } catch { return []; } }));
  const covers = (f, t) => { if (!f.unicodeRange || /^U\+0-10FFFF$/i.test(f.unicodeRange)) return true; const rs = f.unicodeRange.split(',').map((x) => x.trim().replace(/^U\+/i, '').split('-').map((h) => parseInt(h.replace(/\?/g, '0'), 16))); return [...t].some((ch) => { const c = ch.codePointAt(0); return c > 32 && rs.some(([lo, hi]) => c >= lo && c <= (hi ?? lo)); }); };
  const unloaded = (f, t) => { const k = famKey(f), own = faces.filter((x) => famKey(x.family) === k); if (own.length || linked.has(k)) return !own.some((x) => x.status === 'loaded') && (!own.length || own.some((x) => covers(x, t))); return !SYSTEM.test(k); };
  const declared = [...new Set(shown.filter((e) => e.text.length >= 2).map((e) => e.cs.fontFamily.split(',')[0].replace(/["']/g, '').trim()).filter((f) => f && !GENERIC.test(f)))];
  const missingFonts = declared.filter((f) => unloaded(f, shown.filter((e) => e.cs.fontFamily.split(',')[0].replace(/["']/g, '').trim() === f).map((e) => e.text).join(' ')));
  const measured = { lang: html.lang, dir: rtl ? 'rtl' : 'ltr', textElements: textUnits, controls: ctlUnits, bodyPx: body, smallText: tiny.length, arabicChars: arChars, largest: Math.round(big), sizes, families: fams.map(([f]) => f), scripts, loadedFonts, declaredFonts: declared, missingFonts };
  // mechanic-missing, mechanic-value: the widest default view only (1440 unless --viewport says otherwise).
  const kinds = [...qda('[data-mechanic]')].map((e) => [e.dataset.mechanic.trim().toLowerCase(), e]), bad = kinds.find(([k]) => !['scroll', 'tap', 'swipe'].includes(k));
  if (main && !matchMedia('(prefers-reduced-motion: reduce)').matches && !/[?&](state|data)=/.test(location.search) && !allow.includes('mechanic-missing')) {
    // A landing page may have no mechanic (owner 2026-10-28); a box it marks still has to move (mechanic-still).
    if (!kinds.length && landing) {}
    else if (!kinds.length) add('FAIL', 'mechanic-missing', `no [data-mechanic] box at ${W}: mark the box its one action changes with data-mechanic="scroll", "tap" or "swipe" (none on purpose: only Calm or Stretch pages, restyles it does not reach, or the user's word: --taste-allows mechanic-missing)`);
    else if (bad) add('FAIL', 'mechanic-value', `${sel(bad[1])} has data-mechanic${bad[0] ? `="${bad[0]}"` : ' with no value'}; it takes scroll, tap or swipe, the one action that changes the box`);
  }
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
const pageUrl = (src) => { const [fp, q] = src.split('?'); return new URL(/^https?:|^file:/.test(src) ? src : pathToFileURL(resolve(fp)).href + (q ? '?' + q : '')); };
const LAYOUT = ['overflow', 'text-overlap', 'clipped-text', 'text-spill', 'covered-content', 'hidden-shown', 'small-text'];
// A rough gets the floor only (round 3 contract): contrast, body and text size, targets, no sideways scroll, text overlap, alt.
const ROUGH = ['overflow', 'body-size', 'small-text', 'contrast', 'contrast-ground', 'target-size', 'text-overlap', 'alt-missing'];
const settle = async (page, ms) => { await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(ms); };
async function measureRun(r, src) {
  const page = await browser.newPage({ viewport: { width: r.w, height: r.h }, reducedMotion: r.reduce ? 'reduce' : 'no-preference' });
  const u = pageUrl(urlFor[r.lang] || src); if (r.lang && !urlFor[r.lang]) u.searchParams.set('lang', r.lang); if (r.state) u.searchParams.set('state', r.state);
  const wait = r.rough ? 800 : 1500;
  await page.goto(u.href, { waitUntil: 'load' }); await settle(page, wait);
  const res = await page.evaluate(MEASURE, { want: r.lang, allow, landing, main: r.w === mainW && !r.rough });
  if (r.state) { res.findings = res.findings.filter((f) => LAYOUT.includes(f.id)); res.ground = []; }
  // mechanic-still: shots before and after the action, then a reload.
  const kinds = r.rough ? [] : await page.$$eval('[data-mechanic]', (es) => es.map((e) => [e.dataset.mechanic.trim().toLowerCase()]));
  if (!r.reduce && !r.state && !allow.includes('mechanic-still')) for (const [i, [kind]] of kinds.entries()) {
    const act = { scroll: 'a scroll of one screen', tap: 'a tap on its control', swipe: 'a 200px drag toward the start edge' }[kind], el = page.locator('[data-mechanic]').nth(i); if (!act) continue;
    // A tap presses [data-mechanic-target], else the first control in the box that is not already selected, the main action or a link away (round 3: it hit Start free, or the selected item).
    const box = () => el.evaluate((e) => { const { x, y, width, height } = e.getBoundingClientRect(), mx = x + width / 2, my = y + height / 2;
      const on = (k) => k.matches('[aria-selected=true],[aria-pressed=true],[aria-checked=true],[aria-current]:not([aria-current=false]),:checked,[data-primary],[disabled],[aria-disabled=true]') || /(^|[\s_-])(is-)?(active|selected|current)($|[\s_-])/.test(k.getAttribute('class') || '') || (k.matches('a[href]') && !/^(#|javascript:)/.test(k.getAttribute('href')));
      const ok = (k) => { const r = k.getBoundingClientRect(), cs = getComputedStyle(k); return r.width >= 4 && r.height >= 4 && cs.visibility !== 'hidden' && cs.pointerEvents !== 'none'; };
      const kids = [...e.querySelectorAll('button,a[href],input,select,textarea,summary,label,[role=button],[role=tab],[role=switch],[role=checkbox],[role=option],[role=radio],[role=slider],[tabindex]:not([tabindex="-1"]),[onclick]')].filter((k) => ok(k) && !on(k));
      const t = [e.querySelector('[data-mechanic-target]'), ...kids, e.matches('button,a[href],[role=button],[onclick],[tabindex]') && !on(e) ? e : null].find((k) => k && ok(k)), tr = t?.getBoundingClientRect();
      let sc = null; for (let a = e; a && a !== document.body && a !== document.documentElement && !sc; a = a.parentElement) { const cs = getComputedStyle(a); if (/auto|scroll/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1) sc = 'box'; }
      return { x: x + scrollX, y: y + scrollY, width, height, cx: Math.min(Math.max(mx, 1), innerWidth - 1), cy: Math.min(Math.max(my, 1), innerHeight - 1), tx: tr ? tr.left + tr.width / 2 : null, ty: tr ? tr.top + tr.height / 2 : null, scrolls: sc || ((document.scrollingElement || document.documentElement).scrollHeight > innerHeight + 1 ? 'page' : null), rtl: getComputedStyle(e).direction === 'rtl', name: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') }; });
    if (kind !== 'scroll') await el.scrollIntoViewIfNeeded().catch(() => {});
    const b = await box(), shot = ({ x, y, width, height }) => page.screenshot({ fullPage: true, clip: { x, y, width, height } }); if (b.width < 1 || b.height < 1) continue;
    const before = await shot(b), m = page.mouse;
    // scroll: the page by one screen; a box that scrolls itself, or a page with nothing to scroll, gets a wheel over the box.
    if (kind === 'scroll' && b.scrolls === 'page') await page.evaluate(() => scrollBy(0, innerHeight)); else if (kind === 'scroll') { await m.move(b.cx, b.cy); await m.wheel(0, r.h); }
    else if (kind === 'tap') await m.click(b.tx ?? b.cx, b.ty ?? b.cy); else { await m.move(b.cx, b.cy); await m.down(); await m.move(b.cx + (b.rtl ? 200 : -200), b.cy, { steps: 10 }); await m.up(); }
    await page.waitForTimeout(400); const same = before.equals(await shot(await box()));
    // A one-screen page has nothing to scroll: said, never FAILed (round 3).
    if (same && kind === 'scroll' && !b.scrolls) res.findings.push({ level: 'WARN', id: 'mechanic-unchecked', msg: `the [data-mechanic="scroll"] box ${b.name} sits on a page with nothing to scroll at ${r.w}, so the scroll was not tested; check it by hand` });
    else if (same) res.findings.push({ level: 'FAIL', id: 'mechanic-still', msg: `the [data-mechanic="${kind}"] box ${b.name} did not change after ${act} at ${r.w}; wire the mechanic so its one action changes the box${kind === 'tap' ? ' (the tap pressed its first control not already selected: mark the one to press data-mechanic-target)' : ''}` });
    await page.evaluate(() => scrollTo(0, 0)); await page.reload({ waitUntil: 'load' }); await settle(page, 1500);
  }
  // contrast-ground: shots with and without text, 5th and 95th percentile of the ground.
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
  // focus-visible: Tab through the first controls; each focused one must look different from unfocused (outline, ring, border, fill or underline).
  if (!r.reduce && !r.state && !r.rough && r.w === mainW) try {
    await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
    await page.evaluate(() => { const sig = (e) => { const s = getComputedStyle(e); return [s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 ? s.outlineStyle + s.outlineWidth + s.outlineColor : '', s.boxShadow, s.borderColor, s.borderWidth, s.backgroundColor, s.color, s.textDecorationLine, s.transform].join('|'); };
      const near = (e) => [e, e.parentElement, e.closest('label'), ...[...e.querySelectorAll('*')].slice(0, 40)].filter((n, i, a) => n && n !== document.body && a.indexOf(n) === i); // a ring may be drawn on a part (an SVG tile, the active option)
      window.__gbSig = sig; window.__gbNear = near; window.__gbRest = new Map([...document.querySelectorAll('a[href],button,input,select,textarea,summary,[tabindex]')].flatMap((e) => near(e)).map((n) => [n, sig(n)])); if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur(); });
    const bare = [];
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const t = await page.evaluate(() => { const e = document.activeElement; if (!e || e === document.body || e.closest('.gb-switch')) return null; const r = e.getBoundingClientRect(), shows = window.__gbNear(e).some((n) => !window.__gbRest.has(n) || window.__gbRest.get(n) !== window.__gbSig(n)); return { name: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ' ' + (e.getAttribute('aria-label') || e.innerText || '').trim().slice(0, 24), shows, onScreen: r.width > 0 && r.height > 0 }; });
      if (!t) break; if (t.onScreen && !t.shows) bare.push(t.name);
    }
    if (bare.length) res.findings.push({ level: 'FAIL', id: 'focus-visible', msg: `${bare.length} control(s) show no visible focus when tabbed to: ${bare.slice(0, 3).join(', ')}; give :focus-visible an outline or ring of 3:1 or more` });
  } catch {}
  if (r.reduce) res.findings = res.findings.filter((f) => f.id === 'hidden-first-screen').map((f) => ({ ...f, id: 'reduced-motion-hidden', msg: 'with reduced motion: ' + f.msg }));
  if (r.rough) res.findings = res.findings.filter((f) => ROUGH.includes(f.id));
  if (r.lang && !r.reduce && !String(res.measured.lang).toLowerCase().startsWith(r.lang)) res.findings.push({ level: 'FAIL', id: 'lang-switch', msg: `asked for ?lang=${r.lang} but html lang is "${res.measured.lang}"; set <html lang> and dir from ?lang= (or pass --${r.lang} <url>)` });
  await page.close();
  const vw = viewports.length > 1 || r.w === 390 || r.w === 1440 ? `${r.w}` : `${r.w}x${r.h}`;
  return { run: `${r.lang || res.measured.lang || 'page'}-${vw}${r.reduce ? '-reduced' : ''}${r.state ? '-state-' + r.state : ''}`, lang: r.lang || String(res.measured.lang || '').toLowerCase().split(/[-_]/)[0], width: r.w, height: r.h, reduced: r.reduce, ...(r.state ? { state: r.state } : {}), ...res };
}
/** measure.json from one file's runs. Keeps round 1 (and a gb-lint count for the same file) from an earlier run in the same folder. */
function summarize(report, src, langs, jsonPath, isRough) {
  // font-not-loaded: a face the page sets on its text that loaded in no run. The tokens' faces are suggestions: an unused one never FAILs.
  const loaded = new Set(report.flatMap((x) => x.measured.loadedFonts.map((f) => f.toLowerCase())));
  if (!isRough) for (const f of [...new Set(report.flatMap((x) => x.measured.missingFonts || []))].filter((f) => !loaded.has(f.toLowerCase()))) report[0].findings.push({ level: 'FAIL', id: 'font-not-loaded', msg: `${f} is set on the page's text but never loaded (no font link, a wrong name, or a blocked file); screenshots show a fallback: link it, or set a face that loads` });
  const ids = (lvl) => [...new Set(report.flatMap((x) => x.findings.filter((f) => f.level === lvl).map((f) => f.id)))];
  const failIds = ids('FAIL'), warnIds = ids('WARN'), fails = failIds.length, views = report.filter((x) => !x.reduced && !x.state), wide = views.filter((x) => x.width === mainW);
  // The server's numbers: the widest default view (1440 unless --viewport says otherwise), the smallest body. No budgets (owner 2026-10-28).
  const defaultView = ![src, urlFor.ar, urlFor.en].filter(Boolean).some((u) => /[?&](state|data)=/.test(String(u)));
  const bodies = views.map((x) => x.measured.bodyPx).filter((n) => typeof n === 'number' && n > 0);
  const languages = langs.length ? langs : [...new Set(views.map((x) => x.lang).filter(Boolean))];
  const measure = defaultView && wide.length && bodies.length ? { fails, textElements: Math.max(0, ...wide.map((x) => x.measured.textElements)), bodyPx: Math.min(...bodies), languages } : null;
  // A rough says so inside the measure object too (add_to_canvas reads only that object), with its FAILs named.
  if (measure && isRough) { measure.rough = true; if (fails) measure.openFails = failIds; }
  // One entry per FAIL or WARN id: its message per run (a check that fails at 390 and 1440 is one check).
  const by = new Map(); for (const x of report) for (const f of x.findings) { const k = f.level + ' ' + f.id, e = by.get(k) || { level: f.level, id: f.id, msgs: new Map() }; e.msgs.set(f.msg, [...(e.msgs.get(f.msg) || []), x.run]); by.set(k, e); }
  const findings = [...by.values()].sort((a, b) => (a.level === b.level ? 0 : a.level === 'FAIL' ? -1 : 1)).map((e) => ({ level: e.level, id: e.id, msgs: [...e.msgs].map(([msg, runs]) => ({ msg, runs })) }));
  const summary = { tool: 'gb-measure', version: 3, ...(isRough ? { rough: true } : {}), target: src || urlFor, at: new Date().toISOString(), viewports: viewports.map(([w, h]) => `${w}x${h}`), languages, fails, warns: warnIds.length, failIds, warnIds, measure,
    floor: { bodyPx: { default: 16, ar: 17 }, smallestPx: 14, tapPx: { 390: 44, 1440: 24 }, contrast: { text: 4.5, large: 3 } },
    states: stateIds, runs: report.map((x) => ({ run: x.run, lang: x.lang, width: x.width, ...(x.reduced || x.state ? { ...(x.reduced ? { reduced: true } : { state: x.state }) } : { textElements: x.measured.textElements, bodyPx: x.measured.bodyPx, smallText: x.measured.smallText, sizes: x.measured.sizes, arabicChars: x.measured.arabicChars, dir: x.measured.dir }), fails: [...new Set(x.findings.filter((f) => f.level === 'FAIL').map((f) => f.id))], warns: [...new Set(x.findings.filter((f) => f.level === 'WARN').map((f) => f.id))] })),
    findings: findings.map((e) => ({ level: e.level, id: e.id, msg: e.msgs[0].msg, runs: e.msgs.flatMap((m) => m.runs) })) };
  let prev = null; try { prev = JSON.parse(readFileSync(jsonPath, 'utf8')); } catch {}
  const fp = fileOf(src), mtimeMs = fp ? (() => { try { return statSync(fp).mtimeMs; } catch { return null; } })() : null;
  // Round 1 stays for add_to_canvas checks (F25): a later run on the same page in the same folder never overwrites it.
  const same = prev?.tool === 'gb-measure' && JSON.stringify(prev.target) === JSON.stringify(summary.target);
  summary.round = same ? (prev.round || 1) + 1 : 1;
  summary.round1 = same ? prev.round1 || { fails: prev.fails, warns: prev.warns, failIds: prev.failIds, at: prev.at } : { fails, warns: warnIds.length, failIds, at: summary.at };
  // gb-lint --measure-dir wrote its count for this file as it is now: carry it.
  if (prev?.lint && fp && prev.lint.file === fp && prev.lint.mtimeMs === mtimeMs) { summary.lint = prev.lint; summary.lintFails = prev.lint.fails; if (measure) measure.lintFails = prev.lint.fails; if (summary.round === 1) summary.round1.lintFails = prev.lint.fails; if (measure && isRough && prev.lint.rules?.length) measure.openFails = [...new Set([...failIds, ...prev.lint.rules])]; }
  summary.checks = { fails: summary.round1.fails, warns: summary.warns };
  try { mkdirSync(dirname(jsonPath), { recursive: true }); writeFileSync(jsonPath, JSON.stringify(summary, null, 1)); } catch (e) { console.error('could not write ' + jsonPath + ': ' + e.message); }
  // The publish gate's stamp, per file.
  if (fp) try {
    const dir = join(process.env.TMPDIR || '/tmp', 'gb'), sp = join(dir, 'checked.json'); mkdirSync(dir, { recursive: true }); let st = {}; try { st = JSON.parse(readFileSync(sp, 'utf8')); } catch {}
    const was = st[fp]; // same mtime: the worse run counts
    st[fp] = { mtimeMs, fails: was?.mtimeMs === mtimeMs ? Math.max(was.fails, fails) : fails, at: Date.now(), summary: jsonPath, ...(isRough ? { rough: true } : {}) }; writeFileSync(sp, JSON.stringify(st));
  } catch {}
  return { summary, findings, measure, fails };
}
const fileOf = (src) => { try { return src && !/^https?:/.test(src) ? (src.startsWith('file:') ? fileURLToPath(src.split('?')[0]) : resolve(src.split('?')[0])) : null; } catch { return null; } };
const firstLang = async (src) => { try { const p = await browser.newPage({ viewport: { width: mainW, height: mainH } }); await p.goto(pageUrl(src).href, { waitUntil: 'load' }); const l = (await p.evaluate(() => document.documentElement.lang || '')).trim().toLowerCase().split(/[-_]/)[0]; await p.close(); return /^[a-z]{2,3}$/.test(l) ? l : null; } catch { return null; } };
const pool = async (items, k, fn) => { const out = []; let next = 0; await Promise.all(Array.from({ length: k }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i]); } })); return out; };

if (rough) {
  // Roughs: every file in one browser, 4 pages at a time, the brief's viewports, the floor only; one pass, no fix rounds.
  const files = args, t0 = Date.now(), jobs = files.flatMap((f) => viewports.map(([w, h]) => ({ f, w, h })));
  const done = await pool(jobs, 4, async (j) => { try { return await measureRun({ lang: langArg[0] || '', w: j.w, h: j.h, reduce: false, rough: true }, j.f); } catch (e) { return { error: String(e.message || e).split('\n')[0] }; } });
  await browser.close(); let bad = 0;
  for (const f of files) {
    const reps = done.filter((x, i) => jobs[i].f === f), name = basename(f.split('?')[0]).replace(/\.html?$/i, '').replace(/[^\w.-]+/g, '-') || 'page', jsonPath = join(resolve(roughDir), name, 'measure.json');
    const err = reps.find((x) => x.error); if (err) { bad++; console.log(`rough ${f}: not measured (${err.error})`); continue; }
    const { measure: m, fails: n, summary: s } = summarize(reps, f, langArg, jsonPath, true);
    console.log(`rough ${f}: ${n ? `${n} FAIL (${s.failIds.join(', ')})` : 'PASS'}, body ${m?.bodyPx ?? 'n/a'}px, ${m?.textElements ?? 0} text at ${viewports.map(([w, h]) => `${w}x${h}`).join(' and ')}; ${jsonPath}`);
  }
  console.log(`${files.length - bad} rough(s) measured in ${Math.round((Date.now() - t0) / 100) / 10}s, floor checks only. One pass, no fix rounds: place each with the measure object from its measure.json (its open FAILs are already in measure.openFails).`);
  process.exit(bad ? 1 : 0);
}

// No --languages and no tokens: the page's own <html lang> is the one language.
if (!langGiven && target) { const l = await firstLang(target); if (l) languages = [l]; }
for (const lang of languages) for (const [w, h] of viewports) runs.push({ lang, w, h, reduce: false });
runs.push({ lang: languages[0], w: mainW, h: mainH, reduce: true });
for (const state of stateIds) for (const [w, h] of viewports) runs.push({ lang: languages[0], w, h, reduce: false, state });
for (const r of runs) report.push(await measureRun(r, target));
await browser.close();
// measure.json goes next to the shots.
const extra = (() => { try { const q = String(target || '').split('?')[1]; return q ? [...new URLSearchParams(q)].filter(([k]) => !/^(lang|shot)$/.test(k)).map(([k, v]) => `-${k}-${v}`).join('').replace(/[^\w-]/g, '') : ''; } catch { return ''; } })();
const jsonPath = join(resolve(outDir || join(process.env.TMPDIR || '/tmp', 'gb', 'shots')), `measure${extra}.json`);
const { findings, measure, fails } = summarize(report, target, languages, jsonPath, false);
if (asJson) console.log(JSON.stringify(report, null, 1));
else {
  for (const x of report) { if (x.reduced || x.state) continue; const m = x.measured; console.log(`${x.run}: body ${m.bodyPx ?? 'n/a'}px, under 14px ${m.smallText}, text ${m.textElements}, sizes [${m.sizes}], largest ${m.largest}px, faces [${m.families}]`); }
  // One line per failing check, so the count below equals the FAIL lines (round 3); its wording at another size follows on the line.
  for (const e of findings) console.log(`${e.level} ${e.id}: ${e.msgs.map(({ msg, runs: at }) => `${msg}  [${at.join(', ')}]`).join('; also ')}`);
}
const at = `${mainW}`;
if (measure) console.log(`${fails} failing check(s), body ${measure.bodyPx}px, ${measure.textElements} text elements read at ${at}. Summary: ${jsonPath}`);
else console.log(`${fails} failing check(s). No measure for add_to_canvas: ${![target, urlFor.ar, urlFor.en].filter(Boolean).some((u) => /[?&](state|data)=/.test(String(u))) ? `no ${at} run found body text` : 'this run was a ?state or ?data view'}; measure the rendered default view (no ?state or ?data) for it. Summary: ${jsonPath}`);
console.log(fails ? `Fix before placing a full draft, then measure again; a rough may be placed with ${fails === 1 ? 'this FAIL' : 'these FAILs'} in measure.openFails.` : 'Numbers are evidence for the craft check; they never replace looking side by side.');
process.exit(fails ? 1 : 0);
