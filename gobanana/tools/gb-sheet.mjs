// gb-tools v8: bump it in every script and the fetch line on any change.
// gb-sheet: sketches (or one view) as one labelled contact sheet for a crit.
//   node gb-sheet.mjs <a.html[?query]> [b.html ...] [--size 1440x900] [--scale 1] [--out <dir>] [--name sheet] [--jpeg]
import { guard } from './gb-guard.mjs';
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process'; import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path'; import { fileURLToPath, pathToFileURL } from 'node:url';

const USAGE = 'usage: node gb-sheet.mjs <a.html> [b.html ...] [--size 1440x900] [--scale 1] [--out dir] [--name sheet] [--jpeg]';
const args = process.argv.slice(2), usage = () => { console.error(USAGE); process.exit(2); };
const opt = (n) => { const i = args.indexOf('--' + n); return i < 0 ? null : args.splice(i, 2)[1]; };
const flag = (n) => { const i = args.indexOf('--' + n); return i < 0 ? false : (args.splice(i, 1), true); };
const given = { size: opt('size'), scale: opt('scale'), out: opt('out'), name: opt('name') }, jpeg = flag('jpeg'), files = args;
if (!files.length || Object.values(given).some((v) => v === undefined || /^--/.test(v ?? '')) || files.some((f) => f.startsWith('--'))) usage();
const [w, h] = String(given.size || '1440x900').split('x').map(Number), scale = Number(given.scale || 1);
if (!(w > 0 && h > 0 && scale > 0)) usage();
const gbDir = join(process.env.TMPDIR || '/tmp', 'gb'), noRender = join(gbDir, '.gb-norender');
const nameOpt = given.name, out = resolve(given.out || join(gbDir, 'sheet')), name = nameOpt || 'sheet';
const cannot = (e) => { try { mkdirSync(gbDir, { recursive: true }); writeFileSync(noRender, `${new Date().toISOString()} ${String(e?.message || e).split('\n')[0]}\n`); } catch {} console.error(`This machine cannot render: ${String(e?.message || e).split('\n')[0]}\nMarked ${noRender}.`); process.exit(3); };
const req = createRequire(import.meta.url);
let pw; try { try { pw = req('playwright'); } catch { pw = createRequire(join(execSync('npm root -g').toString().trim(), '_'))('playwright'); } } catch (e) { cannot(e); }
mkdirSync(out, { recursive: true });
const href = (f) => { const [p, q] = f.split('?'); const u = new URL(/^https?:|^file:/.test(p) ? f : pathToFileURL(resolve(p)).href + (q ? '?' + q : '')); u.searchParams.set('shot', '1'); return u; };
// A repeated base name takes its folder's name, then the index
const clean = (s) => s.replace(/[^\p{L}\p{N}._-]+/gu, '-').replace(/^-+|-+$/g, '') || 'page';
const parts = files.map((f) => { const [p, q] = f.split('?'), path = /^https?:/.test(p) ? new URL(p).pathname : /^file:/.test(p) ? fileURLToPath(p) : resolve(p); return { base: clean(basename(path, '.html')), dir: clean(basename(dirname(path))), q: q ? '-' + clean(q) : '' }; });
const count = (l) => l.reduce((m, x) => m.set(x, (m.get(x) || 0) + 1), new Map());
let labels = parts.map((x) => x.base + x.q); const seen = count(labels);
labels = labels.map((l, i) => (seen.get(l) > 1 ? `${parts[i].dir}-${l}` : l)); const again = count(labels);
labels = labels.map((l, i) => (again.get(l) > 1 ? `${l}-${i + 1}` : l));
if (files.length === 1 && nameOpt) labels = [clean(nameOpt)];
const browser = guard(await pw.chromium.launch().catch(cannot)), shots = [], failed = [];
try { rmSync(noRender, { force: true }); } catch {}
for (const [i, f] of files.entries()) {
  const u = href(f), label = labels[i];
  if (u.protocol === 'file:' && !existsSync(fileURLToPath(u))) { failed.push(f); console.error(`FAIL ${f}: no such file`); continue; }
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: scale });
  const errs = []; page.on('pageerror', (e) => errs.push(String(e.message).split('\n')[0]));
  let bad = null;
  try { const r = await page.goto(u.href, { waitUntil: 'networkidle' }); if (/^https?:$/.test(u.protocol) && (!r || !r.ok())) bad = `HTTP ${r ? r.status() : 'no response'}`; } catch (e) { bad = String(e.message).split('\n')[0]; }
  if (bad) { failed.push(f); console.error(`FAIL ${f}: ${bad}`); await page.close(); continue; }
  await page.evaluate(() => document.fonts?.ready).catch(() => {}); await page.waitForTimeout(400);
  const file = join(out, label + '.png'); await page.screenshot({ path: file }); await page.close();
  shots.push({ label, file }); console.log(`${file}${errs.length ? '  page errors: ' + errs.join(' | ') : ''}`);
}
if (jpeg && shots.length) {
  // Each shot at 1x, JPEG 0.9
  const page = await browser.newPage({ viewport: { width: 400, height: 300 } });
  for (const s of shots) {
    const url = await page.evaluate(async ({ src, w, h }) => { const img = new Image(); img.src = src; await img.decode(); const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h); return c.toDataURL('image/jpeg', 0.9); }, { src: `data:image/png;base64,${readFileSync(s.file).toString('base64')}`, w, h });
    const file = s.file.replace(/\.png$/, '.jpg'); writeFileSync(file, Buffer.from(url.split(',')[1], 'base64')); console.log(file);
  }
  await page.close();
}
if (shots.length > 1) {
  const cols = shots.length <= 4 ? 2 : 3, tw = 720, th = Math.round(tw * h / w);
  const cells = shots.map((s) => `<figure><img src="data:image/png;base64,${readFileSync(s.file).toString('base64')}"><figcaption>${s.label}</figcaption></figure>`).join('');
  const page = await browser.newPage({ viewport: { width: cols * (tw + 32) + 32, height: 400 } });
  await page.setContent(`<style>body{margin:0;padding:32px;background:#d9dadc;font:600 18px/1 system-ui,sans-serif;display:grid;grid-template-columns:repeat(${cols},${tw}px);gap:32px}figure{margin:0}img{width:${tw}px;height:${th}px;display:block;border-radius:6px;box-shadow:0 2px 12px #0002}figcaption{margin-top:10px;color:#222}</style>${cells}`);
  const file = join(out, name + '.png'); await page.screenshot({ path: file, fullPage: true }); console.log('sheet: ' + file);
}
await browser.close();
if (failed.length) { console.error(`${failed.length} of ${files.length} page(s) did not load: ${failed.join(', ')}`); process.exit(1); }
