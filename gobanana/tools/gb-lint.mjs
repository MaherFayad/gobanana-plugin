// gb-tools v4: a fetch line refetches a cached copy without this tag. Bump it in every script and fetch line when any script changes.
// gb-lint: technical checks (motion, phone, the 14px floor). node gb-lint.mjs drafts/<slug>.html [--tokens tokens.json] [--fix] [--measure-dir <dir>]
// --fix: 100vh, tap highlight, viewport-fit=cover and a missing <head> only, a FIXED line each, then the lint.
// --measure-dir: writes the FAIL count into <dir>/measure.json (lintFails, measure.lintFails), so the board sees it.
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs"; import { join, resolve } from "node:path";
const argv = process.argv.slice(2), ti = argv.indexOf("--tokens"), mi = argv.indexOf("--measure-dir"), file = argv.find((a, i) => !a.startsWith("--") && (ti < 0 || i !== ti + 1) && (mi < 0 || i !== mi + 1));
if (!file || (mi >= 0 && !argv[mi + 1])) { console.error("usage: node gb-lint.mjs <file.html> [--tokens tokens.json] [--fix] [--measure-dir <dir>]"); process.exit(2); }
let src = readFileSync(file, "utf8");
const styleText = (s) => (/<style/i.test(s) ? [...s.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n") : s);
if (argv.includes("--fix")) {
  const fixed = [], was = src, TAP = "html{-webkit-tap-highlight-color:transparent}", styled = /<style/i.test(src);
  let n = 0, t = src; const dvh = (c) => c.replace(/\b100vh\b/g, () => (n++, "100dvh"));
  if (/<[a-z!]/i.test(src) && !/<head(?=[\s>])/i.test(src)) { const h = (src.match(/<html(?=[\s>])[^>]*>/i) || [])[0]; src = h ? src.replace(h, (m) => m + "<head></head>") : src.replace(/^(\s*<!doctype[^>]*>\s*)?/i, (d) => (d || "") + "<head></head>\n"); fixed.push(h ? "head: no <head>, added one after <html>" : "head: no <head> or <html>, added <head> at the top"); }
  src = styled ? src.replace(/(<style[^>]*>)([\s\S]*?<\/style>)/gi, (_, a, c) => a + dvh(c)) : dvh(src);
  if (n) fixed.push(`100vh: ${n} now 100dvh`);
  if (!/-webkit-tap-highlight-color\s*:\s*transparent/.test(styleText(src))) { t = src; src = styled ? src.replace(/<\/style>(?![\s\S]*<\/style>)/i, TAP + "\n</style>") : /<\/head>/i.test(src) ? src.replace(/<\/head>/i, `<style>${TAP}</style>\n</head>`) : /<html/i.test(src) ? src : TAP + "\n" + src; if (src !== t) fixed.push(`tap highlight: ${TAP} added`); }
  const vp = (src.match(/<meta[^>]+name=["']viewport["'][^>]*>/i) || [""])[0]; t = src;
  if (/<html/i.test(src) && !/viewport-fit=cover/.test(vp)) src = vp ? src.replace(vp, () => vp.replace(/content=(["'])([^"']*)\1/i, (_, q, v) => `content=${q}${v.replace(/[\s,;]+$/, "")}, viewport-fit=cover${q}`)) : src.replace(/<head(?=[\s>])[^>]*>/i, (h) => `${h}<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n`);
  if (src !== t) fixed.push(`viewport: viewport-fit=cover added${vp ? "" : " in a new viewport line"}`);
  if (src !== was) { writeFileSync(file, src); for (const f of fixed) console.log(`FIXED ${f}`); }
}
// --tokens is accepted for older calls; no rule reads it (owner 2026-10-28: no font family cap).
const css = styleText(src);
// The right to left checks apply only to an Arabic or right to left page (one language, owner 2026-10-28).
const rtlPage = /<html[^>]*\b(?:dir=["']?rtl|lang=["']?(?:ar|he|fa|ur))\b|\[dir=["']?rtl|:dir\(rtl\)|:lang\(ar\)/i.test(src);
const out = [];
// Each finding has a kebab id starting lint- (printed on its line, listed in measure.json lint.rules and openFails).
const failRules = new Set();
const add = (id, rule, at, lvl = "FAIL") => { if (lvl === "FAIL") failRules.add(id); out.push(`${lvl} ${id}: ${rule}: ${at.trim().slice(0, 90)}`); };
// Type: the 14px floor. 3 or more rules under 14px FAIL (fewer WARN: a rule may be unused), fine print and svg aside.
const vars = new Map([...css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)].map((m) => [m[1], m[2].trim()]).reverse());
const rv = (v, d = 0) => (d > 4 ? v : v.replace(/var\(\s*(--[\w-]+)\s*(?:,([^)]*))?\)/g, (_, n, fb) => rv(vars.get(n) ?? fb ?? "", d + 1)));
const px = (v) => { const m = String(v).trim().match(/^([\d.]+)(px|rem)$/i); return m ? +m[1] * (/rem/i.test(m[2]) ? 16 : 1) : null; };
const low = (v) => { v = rv(v).trim().toLowerCase(); const k = { "xx-small": 9, "x-small": 10, small: 13 }[v]; if (k) return k; const f = v.match(/^(clamp|min)\((.*)\)$/); if (f) { const n = f[2].split(",").map(px).filter((x) => x !== null); return n.length ? (f[1] === "clamp" ? px(f[2].split(",")[0]) : Math.min(...n)) : null; } return px(v); };
const small = [];
const FINE_PRINT = /^(?:.*[\s>+~])?(?:small|svg|tspan|text)(?:[.:#[].*)?$|\.(?:legal|fine)(?![\w-])|(?:^|[\s>+~])svg(?![\w-])/i;
const finePrint = (sel) => sel.split(",").every((part) => FINE_PRINT.test(part.trim()));
// Walk blocks with the stack of at-rules around each; @import, @charset, @namespace out first.
const stack = []; let buf = "";
for (const ch of css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/@(?:import|charset|namespace)\b(?:"[^"]*"|'[^']*'|\([^)]*\)|[^;"'(])*;/gi, "")) {
  if (ch === ";" && !stack.length) { buf = ""; continue; }
  if (ch === "{") { stack.push(buf.trim()); buf = ""; continue; }
  if (ch === "}") {
    const sel = stack.pop() ?? ""; const body = buf; buf = "";
    if (sel.startsWith("@")) continue; // an at-rule prelude, not a selector
    const media = stack.join(" ");
    if (/gb-switch/.test(sel)) continue; // the variant switcher is dev chrome
    if (!/\bprint\b/.test(media)) {
      let under = "";
      for (const m of body.matchAll(/(?:^|[;\s])font-size\s*:\s*([^;]+)/g)) { const n = low(m[1].replace(/!important/, "")); if (n !== null && n > 0 && n < 14) under ||= `${sel} { font-size: ${m[1].trim()} }`; }
      for (const m of body.matchAll(/(?:^|[;\s])font\s*:\s*([^;]+)/g)) { const v = rv(m[1]), n = low((v.match(/([\d.]+(?:px|rem))(?:\s*\/\s*[\w.%]+)?\s+\S/) || [])[1] || ""); if (n !== null && n > 0 && n < 14) under ||= `${sel} { font: ${m[1].trim()} }`; }
      if (under && !finePrint(sel)) small.push(under);
    }
    if (/:hover/.test(sel) && !/hover:\s*hover|prefers-reduced-motion:\s*reduce/.test(media)) add("lint-ungated-hover", "ungated :hover", sel);
    for (const m of body.matchAll(/(?:^|;)\s*transition(?:-property)?\s*:([^;]+)/g)) {
      const v = m[1];
      if (/\ball\b/.test(v) || v.split(",").some((p) => /^\s*[\d.]+m?s/.test(p))) add("lint-transition-all", "transition: all", `${sel} { ${v} }`);
      if (/(^|[\s,])(width|top|left|right|bottom|inset|margin[\w-]*|padding[\w-]*)\b/.test(v)) add("lint-layout-animated", "layout property animated", `${sel} { ${v} }`);
      if (/(^|[\s,])((?:max-|min-)?height|grid-template-rows)\b/.test(v)) add("lint-height-animated", "height animated: only an accordion or a leaving row, 200ms", sel, "CHECK");
      if (/box-shadow/.test(v)) add("lint-shadow-animated", "box-shadow animated (use opacity on a shadow layer or drop-shadow)", sel);
    }
    if (!/infinite/.test(body) && !/^:root$|data-direction/.test(sel)) for (const d of body.matchAll(/(?:^|;)\s*(?:transition|animation)(?:-duration)?\s*:([^;]+)/g)) for (const m of d[1].matchAll(/(\d+)ms|([\d.]+)s\b/g)) { const ms = m[1] ? +m[1] : +m[2] * 1000; if (ms > 300) add("lint-slow-motion", `${ms}ms is over 300: only a sheet, toast, hold or once-only moment may`, sel, "CHECK"); }
    if (rtlPage && /(^|;)\s*(margin|padding)-(left|right)\s*:|(^|;)\s*(left|right)\s*:/.test(body)) add("lint-physical-side", "physical left/right: logical property, or measured on purpose?", sel, "CHECK");
    if (rtlPage && /transform-origin\s*:\s*[^;]*\b(left|right)\b/.test(body)) add("lint-physical-origin", "physical transform-origin: use --origin-start unless measured", sel, "CHECK");
    if (rtlPage && /translateX\((?![^)]*var\(--x-dir\))[^)]*\)/.test(body) && !/translateX\(0\)/.test(body)) add("lint-translate-dir", "translateX without --x-dir: does it flip in RTL?", sel, "CHECK");
    continue;
  }
  buf += ch;
}
if (small.length) add("lint-small-type", `${small.length} rule(s) set type under 14px: nothing read goes under 14px, body 16px (17px Arabic)`, small.slice(0, 3).join("; ").slice(0, 200), small.length >= 3 ? "FAIL" : "WARN");
if (/\b100vh\b/.test(css)) add("lint-100vh", "100vh", "use 100dvh (app shell) or 100svh (hero)");
if (/(transition|animation)\s*:/.test(css) && !/prefers-reduced-motion/.test(css)) add("lint-no-reduced-motion", "no prefers-reduced-motion block", "add the still version");
if (!/-webkit-tap-highlight-color\s*:\s*transparent/.test(css)) add("lint-tap-highlight", "tap highlight not removed", "html { -webkit-tap-highlight-color: transparent }");
const vp = (src.match(/<meta[^>]+name=["']viewport["'][^>]*>/i) || [""])[0];
if (/<html/i.test(src)) {
  if (!/<head(?=[\s>])/i.test(src)) add("lint-no-head", "no <head>", "the viewport and tap highlight need one; add it after <html>, or run --fix");
  if (!/viewport-fit=cover/.test(vp)) add("lint-viewport-fit", "viewport", "add viewport-fit=cover");
  if (/maximum-scale|user-scalable\s*=\s*no/.test(vp)) add("lint-zoom-blocked", "zoom blocked", "remove maximum-scale and user-scalable=no (SC 1.4.4)");
}
console.log(out.length ? out.join("\n") : "PASS: no motion, phone or type floor findings");
// One count per rule id, as gb-measure counts its checks: a rule that fails on 5 selectors is one FAIL.
const rules = [...failRules], lintFails = rules.length;
if (mi >= 0) {
  // gb-measure keeps this count while the file is unchanged; round 1 keeps the first count.
  const p = join(resolve(argv[mi + 1]), "measure.json"); let m = {}; try { m = JSON.parse(readFileSync(p, "utf8")); } catch {}
  m.lint = { file: resolve(file), mtimeMs: statSync(file).mtimeMs, fails: lintFails, rules, at: new Date().toISOString() };
  m.lintFails = lintFails; if (m.measure) m.measure.lintFails = lintFails;
  // A rough names every open FAIL (round 3 contract): its lint ids join gb-measure's in measure.openFails.
  if (m.measure?.rough) { const open = [...new Set([...(m.failIds || []), ...rules])]; if (open.length) m.measure.openFails = open; else delete m.measure.openFails; } if (m.round1 && m.round === 1 && m.round1.lintFails === undefined) m.round1.lintFails = lintFails;
  try { mkdirSync(resolve(argv[mi + 1]), { recursive: true }); writeFileSync(p, JSON.stringify(m, null, 1)); console.log(`${lintFails} lint FAIL(s) written to ${p}`); } catch (e) { console.error(`could not write ${p}: ${e.message}`); }
}
process.exit(lintFails ? 1 : 0);
