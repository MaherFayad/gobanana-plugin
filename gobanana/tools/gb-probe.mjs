// gb-tools v3: a fetch line refetches a cached copy without this tag. Bump it in every script and fetch line when any script changes.
// node gb-probe.mjs <url> <outdir>   (the .gb-switch dev chrome is skipped, as gb-measure does)
// Tabs through the page at 390 and records each stop: ring (focus shows on it, its label, a box around it or a part of it), covered.
// page.under44: controls under 44x44px at 390 (tap targets), links inside a sentence aside.
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process'; import { join } from 'node:path';
const req = createRequire(import.meta.url); let pw; try { pw = req('playwright'); } catch { pw = createRequire(join(execSync('npm root -g').toString().trim(), '_'))('playwright'); }
const { chromium } = pw;
const [url, out = '.'] = process.argv.slice(2); const tag = new URL(url).searchParams.get('lang') || 'page';
const b = await chromium.launch(), r = {};
let p = await b.newPage({ viewport: { width: 320, height: 568 } });
await p.goto(url); await p.waitForTimeout(800);
r.reflow320 = await p.evaluate(() => {
  const W = document.documentElement.clientWidth, root = [document.documentElement, document.body];
  const inScroller = e => { for (let a = e.parentElement; a && !root.includes(a); a = a.parentElement)
    if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(a).overflowX)) return true; return false; };
  const wide = [...document.querySelectorAll('body *')].filter(e => { const x = e.getBoundingClientRect(); return x.width && (x.right > W + 1 || x.left < -1) && !inScroller(e) && !e.closest('table,pre,.gb-switch'); });
  return { scrollsX: document.documentElement.scrollWidth > W, masked: root.some(e => /(hidden|clip)/.test(getComputedStyle(e).overflowX)),
    wide: wide.slice(0, 6).map(e => e.tagName.toLowerCase() + (e.getAttribute('class') ? '.' + e.getAttribute('class') : '')) };
});
await p.screenshot({ path: `${out}/probe-320-${tag}.png`, fullPage: true }); await p.close();
p = await b.newPage({ viewport: { width: 390, height: 844 } });
await p.goto(url); await p.waitForTimeout(800);
r.page = await p.evaluate(() => {
  const q = s => [...document.querySelectorAll(s)].filter(e => !e.closest('.gb-switch'));
  const named = e => e.getAttribute('aria-label') || e.getAttribute('aria-labelledby') || e.closest('label') || (e.id && document.querySelector(`label[for="${e.id}"]`));
  const lv = q('h1,h2,h3,h4,h5,h6').map(h => +h.tagName[1]);
  return { main: q('main,[role=main]').length, nav: q('nav,[role=navigation]').length, h1: q('h1').length,
    headingSkips: lv.filter((l, i) => i && l > lv[i - 1] + 1).length,
    unlabelled: q('input:not([type=hidden]),select,textarea').filter(e => !named(e)).map(e => e.name || e.type),
    noAutocomplete: q('input[type=email],input[type=tel],input[type=password],input[name*=name i],input[name*=phone i],input[name*=card i]').filter(e => !e.getAttribute('autocomplete')).map(e => e.name || e.type),
    // Tap targets on the phone are 44px (the floor at 390), not WCAG's 24px desktop minimum.
    under44: q('a,button,input,select,textarea,[role=button],[tabindex="0"]').filter(e => { const x = e.getBoundingClientRect(); return x.width && (x.width < 44 || x.height < 44) && !e.closest('p'); }).map(e => e.tagName.toLowerCase() + ' ' + (e.textContent || e.name || '').trim().slice(0, 20)),
    liveRegions: q('[aria-live],[role=status],[role=alert]').length,
    unnamedDialogs: q('dialog,[role=dialog],[role=alertdialog]').filter(d => !d.getAttribute('aria-labelledby') && !d.getAttribute('aria-label')).length };
});
r.tabs = [];
for (let i = 0; i < 80; i++) {
  await p.keyboard.press('Tab');
  const t = await p.evaluate(() => {
    const e = document.activeElement; if (!e || e === document.body || e.dataset.gbSeen) return null; e.dataset.gbSeen = 1;
    if (e.closest('.gb-switch')) return { skip: true };
    const x = e.getBoundingClientRect(), s = getComputedStyle(e);
    // :focus rules that paint the stop, a box around it or a part of it.
    const PAINT = /outline|box-shadow|border|background|stroke|fill|opacity|transform|filter|text-decoration|color|visibility|display/;
    const parts = (sel) => { const out = []; let d = 0, cur = ''; for (const ch of sel) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && !d) { out.push(cur); cur = ''; } else cur += ch; } return [...out, cur].map((p) => p.trim()).filter((p) => /:focus/.test(p)); };
    const rules = (list) => { const o = []; for (const r of list) { if (r.cssRules && (!r.media || matchMedia(r.media.mediaText).matches) && !(r instanceof CSSStyleRule)) o.push(...rules(r.cssRules)); if (r instanceof CSSStyleRule && /:focus/.test(r.selectorText)) o.push(r); } return o; };
    const near = (n) => n === e || e.contains(n) || (n.contains(e) && [e.parentElement, e.parentElement?.parentElement].includes(n)) || (e.getAttribute('aria-activedescendant') && n.id === e.getAttribute('aria-activedescendant'));
    const styled = [...document.styleSheets].some((sh) => { let l; try { l = sh.cssRules; } catch { return false; } return rules(l).some((r) => [...r.style].some((p) => PAINT.test(p) && !/^(none|0px|0|transparent|initial)$/.test(r.style.getPropertyValue(p).trim()) && !(/^outline/.test(p) && /none|0px/.test(r.style.getPropertyValue(p)))) && parts(r.selectorText).some((p) => { try { return [...document.querySelectorAll(p)].some(near); } catch { return false; } })); });
    const hit = document.elementFromPoint(Math.min(Math.max(x.left + x.width / 2, 0), innerWidth - 1), Math.min(Math.max(x.top + x.height / 2, 0), innerHeight - 1));
    return { el: e.tagName.toLowerCase(), name: (e.getAttribute('aria-label') || e.innerText || e.textContent || e.name || '').trim().slice(0, 24),
      size: `${Math.round(x.width)}x${Math.round(x.height)}`, ring: [e, e.closest('label')].some((n) => n && getComputedStyle(n).outlineStyle !== 'none') || s.boxShadow !== 'none' || styled, covered: !!hit && !e.contains(hit) && !hit.contains(e) };
  });
  if (!t) break; if (!t.skip) r.tabs.push(t);
}
await p.addStyleTag({ content: '*{line-height:1.5!important;word-spacing:.16em!important}p{margin-bottom:2em!important}*{letter-spacing:.12em!important}' });
r.spacingClipped = await p.evaluate(() => [...document.querySelectorAll('body *')].filter(e => { const s = getComputedStyle(e);
  return /(hidden|clip)/.test(s.overflowX + s.overflowY) && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1) && !e.matches('.sr-only,.visually-hidden') && e.getBoundingClientRect().height > 1 && !e.closest('[inert],[hidden],[aria-hidden="true"],.gb-switch'); })
  .slice(0, 6).map(e => e.tagName.toLowerCase() + (e.getAttribute('class') ? '.' + e.getAttribute('class') : '')));
await p.screenshot({ path: `${out}/probe-spacing-${tag}.png`, fullPage: true });
console.log(JSON.stringify(r, null, 1)); await b.close();
