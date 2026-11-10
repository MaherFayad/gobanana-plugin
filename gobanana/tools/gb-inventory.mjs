// gb-tools v13: the fetch tag.
// gb-inventory: the colours, sizes, spacings and radii a live page uses, near duplicates, and a tidy set. No AI.
//   node gb-inventory.mjs <url|file.html> [more] [--viewport 390x844] [--out dir] [--json]
//   Writes <out>/inventory.json and inventory.md. Exit 0 done, 1 a page failed, 2 usage, 3 cannot render.
import { guard } from './gb-guard.mjs';
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process'; import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';

export function oklab(r, g, b) {
	const f = (x) => ((x /= 255) <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4), R = f(r), G = f(g), B = f(b);
	const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
	return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
const labOf = (hex) => oklab(parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16));
const R1 = (x) => Math.round(x * 10) / 10;

export const NEAR = { colors: 0.02, fontSizes: 1, spacing: 2, radii: 2, lineHeights: 0.1, letterSpacing: 0.2, fontFamilies: 0, fontWeights: 0, shadows: 0 };
export const BUDGET = { colors: 12, fontSizes: 7, fontFamilies: 2, fontWeights: 3, lineHeights: 4, letterSpacing: 3, spacing: 8, radii: 3, shadows: 3 };
export const WEIGHT = { colors: 3, fontSizes: 2, spacing: 2, radii: 1, fontFamilies: 1, fontWeights: 1, lineHeights: 1, letterSpacing: 1, shadows: 1 };
export const CATEGORIES = Object.keys(NEAR);

function COLLECT() {
	const R1 = (x) => Math.round(x * 10) / 10;
	const cx = Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
	const hexOf = (c) => {
		let v = null, m = /^rgba?\(([^)]+)\)/.exec(c);
		if (m) v = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
		else { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#0000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; v = [d[0], d[1], d[2], d[3] / 255]; }
		const a = v.length > 3 ? v[3] : 1; if (a < 0.05) return null;
		const h = '#' + v.slice(0, 3).map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
		return a < 0.98 ? h + '@' + Math.round(a * 100) : h;
	};
	const T = { elements: 0, colors: {}, fontSizes: {}, fontFamilies: {}, fontWeights: {}, lineHeights: {}, letterSpacing: {}, spacing: {}, radii: {}, shadows: {} };
	const add = (cat, k, n = 1) => { T[cat][k] = (T[cat][k] || 0) + n; };
	const col = (c, role, area, ui) => { const h = hexOf(c); if (!h) return; const o = (T.colors[h] ||= { text: 0, surface: 0, border: 0, ui: 0, area: 0 }); o[role]++; o.area += area; if (ui) o.ui++; };
	const UI = 'a[href],button,input,select,textarea,summary,[role=button],[role=link],[role=tab],[role=menuitem]';
	for (const e of document.querySelectorAll('body, body *')) {
		if (/^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|META|LINK)$/.test(e.tagName) || e.closest('svg') && e.tagName.toLowerCase() !== 'svg') continue;
		if (e.checkVisibility && !e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
		const r = e.getBoundingClientRect(); if (r.width < 2 && r.height < 2) continue;
		const cs = getComputedStyle(e), area = Math.round(r.width * r.height), ui = !!e.closest(UI); T.elements++;
		const own = [...e.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim()) || (/^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(e.tagName) && !/^(hidden|checkbox|radio|range|color|file|image)$/.test(e.type || ''));
		if (own) {
			col(cs.color, 'text', area, ui);
			const fs = parseFloat(cs.fontSize); add('fontSizes', R1(fs)); add('fontFamilies', cs.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '')); add('fontWeights', cs.fontWeight);
			add('lineHeights', cs.lineHeight === 'normal' ? 'normal' : String(Math.round(parseFloat(cs.lineHeight) / fs * 20) / 20));
			add('letterSpacing', cs.letterSpacing === 'normal' ? '0' : String(R1(parseFloat(cs.letterSpacing))));
		}
		col(cs.backgroundColor, 'surface', area, ui);
		const bc = new Set(); for (const s of ['Top', 'Right', 'Bottom', 'Left']) if (parseFloat(cs['border' + s + 'Width']) > 0 && !/none|hidden/.test(cs['border' + s + 'Style'])) bc.add(cs['border' + s + 'Color']);
		for (const c of bc) col(c, 'border', area, ui);
		const pad = ['Top', 'Right', 'Bottom', 'Left'].map((s) => parseFloat(cs['padding' + s])), mar = ['Top', 'Right', 'Bottom', 'Left'].map((s) => parseFloat(cs['margin' + s]));
		const spacing = [...new Set([...pad, ...mar.filter((v, i) => v > 0 && !(i % 2 && mar[1] === mar[3] && v > 32))])];
		if (/flex|grid/.test(cs.display)) for (const g of [cs.rowGap, cs.columnGap]) if (g !== 'normal') spacing.push(parseFloat(g));
		for (const v of new Set(spacing.map(Math.round))) if (v >= 1 && v <= 128) add('spacing', String(v));
		const small = Math.min(r.width, r.height), rad = new Set();
		for (const c of ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft']) {
			const raw = cs['border' + c + 'Radius'], v = raw.endsWith('%') ? parseFloat(raw) / 100 * small : parseFloat(raw);
			if (v > 0) rad.add(v >= small / 2 - 0.5 ? 'pill' : String(R1(v)));
		}
		for (const v of rad) add('radii', v);
		if (cs.boxShadow !== 'none') add('shadows', cs.boxShadow);
	}
	return T;
}

/** Sum tallies of several pages. */
export function mergeTallies(list) {
	const out = { elements: 0 };
	for (const c of CATEGORIES) out[c] = {};
	for (const t of list) {
		out.elements += t.elements;
		for (const c of CATEGORIES) for (const [k, v] of Object.entries(t[c])) {
			if (c !== 'colors') { out[c][k] = (out[c][k] || 0) + v; continue; }
			const o = (out.colors[k] ||= { text: 0, surface: 0, border: 0, ui: 0, area: 0 }); for (const f in v) o[f] += v[f];
		}
	}
	return out;
}

/** Greedy groups: most used first, each value joins the first group whose lead is within tol; a value that is not a number never joins. */
export function cluster(items, dist, tol) {
	const sorted = [...items].sort((a, b) => b.count - a.count || (b.area || 0) - (a.area || 0) || (String(a.value) < String(b.value) ? -1 : 1)), groups = [];
	for (const it of sorted) {
		const g = it.solo ? null : groups.find((x) => !x.keep.solo && dist(x.keep, it) <= tol);
		if (g) g.members.push(it); else groups.push({ keep: it, members: [it] });
	}
	return groups;
}
const colorDist = (a, b) => Math.hypot(a.lab[0] - b.lab[0], a.lab[1] - b.lab[1], a.lab[2] - b.lab[2]);
const numDist = (a, b) => Math.abs(a.value - b.value);
const itemsOf = (cat, tally) => Object.entries(tally).map(([k, v]) => {
	if (cat === 'colors') return { value: k, count: v.text + v.surface + v.border, area: v.area, roles: { text: v.text, surface: v.surface, border: v.border, interactive: v.ui }, solo: k.includes('@'), lab: labOf(k) };
	const num = !isNaN(Number(k)) && k !== '' && !['fontFamilies', 'shadows', 'fontWeights'].includes(cat);
	return { value: num ? Number(k) : k, count: v, solo: !num };
}).sort((a, b) => b.count - a.count || (String(a.value) < String(b.value) ? -1 : 1));

/** The role a merged colour plays: accent when it is saturated and sits on something you can press, else where it is used most. */
export function roleOf(lab, roles) {
	if (Math.hypot(lab[1], lab[2]) >= 0.07 && roles.interactive > 0) return 'accent';
	return roles.text >= roles.surface && roles.text >= roles.border ? 'text' : roles.surface >= roles.border ? 'surface' : 'border';
}
const nearest = (steps, v, log) => steps.reduce((b, s) => ((log ? Math.abs(Math.log(s / v)) < Math.abs(Math.log(b / v)) : Math.abs(s - v) < Math.abs(b - v)) ? s : b), steps[0]);
/** Drop the less used of the closest two steps until at most max remain. steps: [{value, count}] sorted by value. */
function thin(steps, max, log) {
	const s = steps.map((x) => ({ ...x }));
	while (s.length > max) {
		let k = 0, best = Infinity;
		for (let i = 0; i + 1 < s.length; i++) { const d = log ? Math.log(s[i + 1].value / s[i].value) : s[i + 1].value - s[i].value; if (d < best) { best = d; k = i; } }
		const [a, b] = [s[k], s[k + 1]], keep = a.count >= b.count ? a : b; keep.count = a.count + b.count; s.splice(a === keep ? k + 1 : k, 1);
	}
	return s;
}
const mapTo = (items, steps, snap) => Object.fromEntries(items.map((i) => [String(i.value), snap(i.value, steps)]).filter(([k, v]) => Number(k) !== v));

/** One category: counts, near-duplicate groups, the tidy set, and the score with the numbers behind it. */
export function analyseCategory(cat, tally) {
	const items = itemsOf(cat, tally), groups = cluster(items, cat === 'colors' ? colorDist : numDist, NEAR[cat]), used = items.length, merged = groups.length, near = used - merged;
	const out = { used, near, merged, items: items.map(({ lab, solo, ...i }) => i), groups: groups.filter((g) => g.members.length > 1).map((g) => ({ keep: g.keep.value, members: g.members.map((m) => ({ value: m.value, count: m.count })) })) };
	const reps = groups.map((g) => ({ value: g.keep.value, count: g.members.reduce((n, m) => n + m.count, 0) }));
	if (cat === 'colors') {
		const sum = (g, f) => g.members.reduce((n, m) => n + m.roles[f], 0);
		out.byRole = Object.fromEntries(['text', 'surface', 'border'].map((f) => [f, items.filter((i) => i.roles[f] > 0).length]));
		out.proposed = groups.map((g) => ({ value: g.keep.value, role: roleOf(g.keep.lab, { text: sum(g, 'text'), surface: sum(g, 'surface'), border: sum(g, 'border'), interactive: sum(g, 'interactive') }), count: reps.find((r) => r.value === g.keep.value).count, replaces: g.members.slice(1).map((m) => m.value) })).sort((a, b) => b.count - a.count || (a.value < b.value ? -1 : 1));
	} else if (cat === 'fontSizes') {
		const steps = thin([...new Map(reps.map((r) => [Math.round(r.value), { value: Math.round(r.value), count: r.count }])).values()].sort((a, b) => a.value - b.value), 7, true).map((s) => s.value);
		out.proposed = { steps, map: mapTo(items, steps, (v, s) => nearest(s, v, true)) };
	} else if (cat === 'spacing') {
		const snap = (v) => Math.max(4, Math.round(v / 4) * 4), steps = [...new Set(items.map((i) => snap(i.value)))].sort((a, b) => a - b);
		out.proposed = { steps, map: mapTo(items, steps, (v) => snap(v)) };
	} else if (cat === 'radii') {
		const pill = items.some((i) => i.value === 'pill'), steps = thin(reps.filter((r) => typeof r.value === 'number').sort((a, b) => a.value - b.value), 3 - (pill ? 1 : 0), false).map((s) => s.value);
		out.proposed = { steps, pill, map: mapTo(items.filter((i) => typeof i.value === 'number'), steps, (v, s) => nearest(s, v, false)) };
	} else if (cat === 'shadows') out.proposed = reps.slice(0, 3).map((r) => r.value);
	else out.proposed = reps.map((r) => r.value);
	const dupScore = used ? 100 * (1 - near / used) : null, sprawlScore = used ? 100 * Math.min(1, BUDGET[cat] / merged) : null;
	out.score = used ? { value: Math.round(0.5 * dupScore + 0.5 * sprawlScore), dupScore: Math.round(dupScore), sprawlScore: Math.round(sprawlScore), used, near, merged, budget: BUDGET[cat] } : { value: null, used: 0 };
	return out;
}
export const proposedCount = (c) => (Array.isArray(c.proposed) ? c.proposed.length : c.proposed.steps.length + (c.proposed.pill ? 1 : 0));

/** Every category from one tally, and the overall score (weighted mean of the categories in use). */
export function analyse(tally) {
	const categories = Object.fromEntries(CATEGORIES.map((c) => [c, analyseCategory(c, tally[c])]));
	const on = CATEGORIES.filter((c) => categories[c].score.value != null), w = on.reduce((n, c) => n + WEIGHT[c], 0);
	return { elements: tally.elements, categories, score: { overall: w ? Math.round(on.reduce((n, c) => n + WEIGHT[c] * categories[c].score.value, 0) / w) : null, byCategory: Object.fromEntries(CATEGORIES.map((c) => [c, categories[c].score.value])) } };
}

const LABEL = { colors: 'Colours', fontSizes: 'Font sizes', fontFamilies: 'Font families', fontWeights: 'Font weights', lineHeights: 'Line heights', letterSpacing: 'Letter spacing', spacing: 'Spacing', radii: 'Corner radii', shadows: 'Shadows' };
const U = { fontSizes: 'px', spacing: 'px', radii: 'px', letterSpacing: 'px' };
export function markdown(res) {
	const L = [`# Style inventory`, '', `${res.pages.map((p) => p.name).join(', ')} at ${res.viewport.join('x')}: ${res.elements} visible elements. Overall consistency ${res.score.overall ?? 'n/a'} of 100.`, '', '| Category | Used | Near duplicates | Proposed | Score |', '| --- | --- | --- | --- | --- |'];
	for (const c of CATEGORIES) { const x = res.categories[c]; L.push(`| ${LABEL[c]} | ${x.used} | ${x.near} | ${x.used ? proposedCount(x) : 0} | ${x.score.value ?? 'n/a'} |`); }
	const cc = res.categories.colors;
	if (cc.groups.length) { L.push('', '## Colours that are near duplicates', ''); for (const g of cc.groups) L.push(`- ${g.members.map((m) => `${m.value} (${m.count})`).join(', ')}: keep ${g.keep}`); }
	if (cc.used) { L.push('', '## Proposed colours', ''); for (const p of cc.proposed) L.push(`- ${p.value} ${p.role}, used ${p.count} ${p.count === 1 ? 'time' : 'times'}${p.replaces.length ? `, replaces ${p.replaces.join(', ')}` : ''}`); }
	for (const c of ['fontSizes', 'spacing', 'radii']) {
		const x = res.categories[c]; if (!x.used) continue;
		L.push('', `## Proposed ${LABEL[c].toLowerCase()}`, '', `${x.proposed.steps.map((s) => s + U[c]).join(', ')}${x.proposed.pill ? ', full round' : ''}`);
		const m = Object.entries(x.proposed.map); if (m.length) L.push('', `Change: ${m.map(([a, b]) => `${a}${U[c]} to ${b}${U[c]}`).join(', ')}`);
	}
	if (res.pages.length > 1) { L.push('', '## Pages', ''); for (const p of res.pages) L.push(`- ${p.name}: ${p.elements} elements, score ${p.score.overall ?? 'n/a'}`); }
	return L.join('\n') + '\n';
}

async function main() {
	const args = process.argv.slice(2), usage = () => { console.error('usage: node gb-inventory.mjs <url|file.html> [more] [--viewport 390x844] [--out dir] [--json]'); process.exit(2); };
	const opt = (n) => { const i = args.indexOf('--' + n); return i < 0 ? null : args.splice(i, 2)[1]; };
	const flag = (n) => { const i = args.indexOf('--' + n); return i < 0 ? false : (args.splice(i, 1), true); };
	const given = { viewport: opt('viewport'), out: opt('out') }, asJson = flag('json'), targets = args;
	if (!targets.length || Object.values(given).some((v) => v === undefined || /^--/.test(v ?? '')) || targets.some((t) => t.startsWith('--'))) usage();
	const vp = String(given.viewport || '390x844').split('x').map(Number); if (!(vp.length === 2 && vp[0] > 0 && vp[1] > 0)) usage();
	const gbDir = join(process.env.TMPDIR || '/tmp', 'gb'), noRender = join(gbDir, '.gb-norender'), out = resolve(given.out || join(gbDir, 'inventory'));
	const cannot = (e) => { try { mkdirSync(gbDir, { recursive: true }); writeFileSync(noRender, `${new Date().toISOString()} ${String(e?.message || e).split('\n')[0]}\n`); } catch {} console.error(`This machine cannot render: ${String(e?.message || e).split('\n')[0]}\nMarked ${noRender}.`); process.exit(3); };
	const req = createRequire(import.meta.url);
	let pw; try { try { pw = req('playwright'); } catch { pw = createRequire(join(execSync('npm root -g').toString().trim(), '_'))('playwright'); } } catch (e) { cannot(e); }
	const browser = guard(await pw.chromium.launch().catch(cannot)), pages = [], tallies = [], failed = [];
	for (const t of targets) {
		const [p, q] = t.split('?'), u = new URL(/^https?:|^file:/.test(p) ? t : pathToFileURL(resolve(p)).href + (q ? '?' + q : '')), name = basename(u.pathname) || u.hostname;
		if (u.protocol === 'file:' && !existsSync(fileURLToPath(u))) { failed.push(t); console.error(`FAIL ${t}: no such file`); continue; }
		const page = await browser.newPage({ viewport: { width: vp[0], height: vp[1] } });
		try {
			const r = await page.goto(u.href, { waitUntil: 'load' }); if (/^https?:$/.test(u.protocol) && (!r || !r.ok())) throw new Error(`HTTP ${r ? r.status() : 'no response'}`);
			await page.evaluate(() => document.fonts?.ready).catch(() => {}); await page.waitForTimeout(400);
			const tally = await page.evaluate(COLLECT); tallies.push(tally); pages.push({ name, input: t, ...analyse(tally) });
		} catch (e) { failed.push(t); console.error(`FAIL ${t}: ${String(e.message || e).split('\n')[0]}`); } finally { await page.close(); }
	}
	await browser.close();
	if (!pages.length) process.exit(1);
	const all = analyse(mergeTallies(tallies)), res = { tool: 'gb-inventory', viewport: vp, pages: pages.map(({ name, input, elements, score }) => ({ name, input, elements, score })), ...all };
	mkdirSync(out, { recursive: true }); writeFileSync(join(out, 'inventory.json'), JSON.stringify(res, null, 1)); writeFileSync(join(out, 'inventory.md'), markdown(res));
	if (asJson) console.log(JSON.stringify(res, null, 1));
	else {
		console.log(`${pages.length} page(s) at ${vp.join('x')}, ${res.elements} elements. Consistency ${res.score.overall ?? 'n/a'} of 100.`);
		for (const k of CATEGORIES) { const c = res.categories[k]; if (c.used) console.log(`  ${LABEL[k]}: ${c.used} used, ${c.near} near duplicates, ${proposedCount(c)} proposed, score ${c.score.value}`); }
		console.log(`Wrote ${join(out, 'inventory.md')} and inventory.json.`);
	}
	process.exit(failed.length ? 1 : 0);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
