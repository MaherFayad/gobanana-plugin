// gb-tools v5: a fetch line refetches a cached copy without this tag. Bump it in every script and fetch line when any script changes.
// gb-frames: a video or GIF reference as one sheet of time-labelled frames, made here.
//   node gb-frames.mjs <post or page url | video file> [--frames 12] [--max 20] [--out <dir>] [--name <file>]
// X, Dribbble, Pinterest, og:video or <video> pages; YouTube, Vimeo, Instagram, TikTok via yt-dlp. Temp video, deleted.
// Exit 0 sheet, 1 no video, 2 usage, 3 no ffmpeg or network blocked.
import { spawnSync } from 'node:child_process'; import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path'; import { pathToFileURL } from 'node:url';

export const LIMITS = { frames: 12, maxSeconds: 20, minGap: 0.08, sheetPx: 1600, sheetBytes: 900_000, videoBytes: 80_000_000 };
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

// Where a URL's video comes from; a file path is read as it is.
export function sourceOf(input) {
  let u; try { u = new URL(input); } catch { return existsSync(String(input)) ? { kind: 'file', path: resolve(input) } : null; }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase().replace(/^(www|m|mobile)\./, '');
  const x = /^(x|twitter|fxtwitter|vxtwitter|fixupx)\.com$/.test(host) && /\/status(?:es)?\/(\d{1,25})/.exec(u.pathname);
  if (x) return { kind: 'x', id: x[1], host, url: u.href };
  if (/\.(mp4|webm|mov|m4v|m3u8)$/i.test(u.pathname)) return { kind: 'direct', host, url: u.href };
  if (/(^|\.)(youtube\.com|youtu\.be|vimeo\.com|instagram\.com|tiktok\.com)$/.test(host)) return { kind: 'ytdlp', host, url: u.href };
  if (/(^|\.)dribbble\.com$/.test(host)) return { kind: 'dribbble', host, url: u.href };
  if (/(^|\.)pinterest\.[a-z.]+$|^pin\.it$/.test(host)) return { kind: 'pinterest', host, url: u.href };
  return { kind: 'page', host, url: u.href };
}

// The tweet's mp4: the smallest 480 wide or more, else the smallest.
const widthOf = (url) => +(/\/(\d{2,5})x\d{2,5}\//.exec(url)?.[1] || 0);
export function pickVariant(tweet) {
  const media = [...(tweet?.mediaDetails || []), ...(tweet?.quoted_tweet?.mediaDetails || [])].filter((m) => /^(video|animated_gif)$/.test(m?.type));
  const m = media[0], mp4 = (m?.video_info?.variants || []).filter((v) => v?.content_type === 'video/mp4' && v.url);
  if (!mp4.length) return null;
  const by = (a, b) => (a.bitrate ?? 0) - (b.bitrate ?? 0) || widthOf(a.url) - widthOf(b.url);
  const v = mp4.filter((x) => widthOf(x.url) >= 480).sort(by)[0] || [...mp4].sort(by)[0];
  return { url: v.url, media: m.type === 'animated_gif' ? 'GIF' : 'video', width: widthOf(v.url) || null, duration: m.video_info.duration_millis ? m.video_info.duration_millis / 1000 : null, count: media.length };
}

// N frame times over the first maxSeconds, minGap apart, mid slice.
export function frameTimes(duration, count = LIMITS.frames, maxSeconds = LIMITS.maxSeconds) {
  const d = Number(duration) > 0 ? Number(duration) : 0, window = Math.min(d, maxSeconds);
  const n = Math.max(1, Math.min(count, Math.floor(window / LIMITS.minGap) || 1));
  return { times: Array.from({ length: n }, (_, i) => Math.round((window * (i + 0.5)) / n * 100) / 100), window, capped: d > maxSeconds };
}

// Columns, rows and tile size within sheetPx (aspect: height over width).
export function grid(n, aspect = 1) {
  const cols = n <= 3 ? n : n === 4 ? 2 : n <= 6 ? 3 : 4, rows = Math.ceil(n / cols), pad = 6, a = aspect > 0 ? aspect : 1;
  const fit = (k) => (LIMITS.sheetPx - pad * (k + 1)) / k, w = Math.floor(Math.min(360, fit(cols), fit(rows) / a) / 2) * 2;
  return { cols, rows, pad, w, h: Math.max(2, Math.round((w * a) / 2) * 2) };
}

export function probeInfo(text) {
  const d = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text), s = /Video: [^\n]*?[ ,](\d{2,5})x(\d{2,5})[ ,\n]/.exec(text + '\n');
  const turned = /rotat(?:e|ion)[^\n]*?-?\b90\b|rotat(?:e|ion)[^\n]*?270/i.test(text);
  const [w, h] = s ? [+s[1], +s[2]] : [null, null];
  return { duration: d ? +d[1] * 3600 + +d[2] * 60 + +d[3] : null, width: turned ? h : w, height: turned ? w : h };
}

// og:video, twitter:player:stream, <video> src, any mp4 or m3u8 link.
export function videoInPage(html, base) {
  const abs = (s) => { try { return new URL(s.replace(/&amp;/g, '&').replace(/\\u002F/gi, '/').replace(/\\\//g, '/'), base).href; } catch { return null; } };
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]).filter((t) => /(?:property|name)=["'](?:og:video(?::secure_url|:url)?|twitter:player:stream)["']/i.test(t)).map((t) => /content=["']([^"']+)/i.exec(t)?.[1]);
  const tags = [...html.matchAll(/<(?:video|source)\b[^>]*?\bsrc=["']([^"']+)["']/gi)].map((m) => m[1]);
  const raw = [...html.matchAll(/https?:(?:\/|\\\/|\\u002F){2}[^"'\s<>]+?\.(?:mp4|m3u8)(?:\?[^"'\s<>\\]*)?/gi)].map((m) => m[0]);
  const rank = (u) => (/\.m3u8/i.test(u) ? 2 : 0) - (/720p/i.test(u) ? 1 : 0);
  return [...new Set([...metas, ...tags, ...raw].filter(Boolean).map(abs).filter((u) => u && /^https?:/.test(u) && /\.(mp4|webm|mov|m4v|m3u8)(\?|$)/i.test(u)))].sort((a, b) => rank(a) - rank(b));
}

class Stop extends Error { constructor(code, msg) { super(msg); this.code = code; } }
const run = (bin, args, o = {}) => spawnSync(bin, args, { encoding: 'utf8', maxBuffer: 64 << 20, ...o });
const python = () => ['python3', 'python'].find((p) => run(p, ['--version']).status === 0) || null;
const pipInstall = (py, pkg) => { console.error(`Installing the ${pkg} Python package (pip, user install)...`); const a = ['-m', 'pip', 'install', '--user', '-q', pkg]; return run(py, a, { timeout: 180_000 }).status === 0 || run(py, [...a, '--break-system-packages'], { timeout: 180_000 }).status === 0; };

// ffmpeg on PATH, else imageio-ffmpeg's binary.
function findFfmpeg() {
  const ok = (b) => !!b && run(b, ['-version'], { stdio: 'ignore' }).status === 0;
  for (const b of [process.env.FFMPEG, 'ffmpeg']) if (ok(b)) return b;
  const py = python(); if (!py) return null;
  const get = () => run(py, ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())']).stdout?.trim();
  let b = get(); if (!ok(b) && pipInstall(py, 'imageio-ffmpeg')) b = get();
  return ok(b) ? b : null;
}

// curl (it follows the proxy), else fetch.
async function get(url, file, max = LIMITS.videoBytes) {
  const r = run('curl', ['-sSL', '--max-time', '90', '--max-filesize', String(max), '-A', UA, '-w', '\n%{http_code}', '-o', file || '-', url]);
  if (!r.error) {
    const out = r.stdout || '', status = +out.slice(out.lastIndexOf('\n') + 1) || 0, body = file ? (existsSync(file) && statSync(file).size < 20_000 ? readFileSync(file, 'utf8') : '') : out.slice(0, out.lastIndexOf('\n'));
    return { status, body, err: (r.stderr || '').trim() };
  }
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow' }), buf = Buffer.from(await res.arrayBuffer());
    if (file && res.ok) { if (buf.length > max) return { status: 0, body: '', err: 'file larger than the limit' }; (await import('node:fs')).writeFileSync(file, buf); }
    return { status: res.status, body: file && res.ok ? '' : buf.toString('utf8'), err: '' };
  } catch (e) { return { status: 0, body: '', err: String(e?.cause?.message || e.message) }; }
}
// A proxy that denies the host: a 403 naming its allowlist, or a refused CONNECT.
const blocked = (r) => /blocked-by-allowlist|allowlist/i.test(r.body) || /CONNECT tunnel failed, response 40[37]/i.test(r.err);
function check(r, url, what, src) {
  if (blocked(r)) {
    const hosts = [...new Set([...(src.kind === 'x' ? ['video.twimg.com', 'cdn.syndication.twimg.com'] : []), src.host, new URL(url).hostname].filter(Boolean))];
    throw new Stop(3, `Network blocked here for ${new URL(url).hostname}: allow ${hosts.join(', ')} in this environment's network settings, then run again. Until then judge the still frame only.`);
  }
  if (r.status < 200 || r.status > 299) throw new Stop(1, `Cannot read this source: ${what} gave ${r.status ? 'HTTP ' + r.status : r.err || 'no answer'} (${url}).`);
}

async function fetchVideo(src, file, ff, maxS) {
  if (src.kind === 'file') return { path: src.path, label: src.path, media: 'video', name: src.path.split(/[\\/]/).pop().replace(/\.[^.]+$/, '') };
  if (src.kind === 'x') {
    let r, tweet = null;
    for (const token of ['a', ((Number(src.id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '')]) {
      r = await get(`https://cdn.syndication.twimg.com/tweet-result?id=${src.id}&lang=en&token=${token}`);
      if (blocked(r) || r.status === 404) break;
      try { tweet = JSON.parse(r.body); if (tweet?.mediaDetails || tweet?.__typename === 'TweetTombstone') break; } catch { tweet = null; }
    }
    if (r.status === 404 || tweet?.__typename === 'TweetTombstone') throw new Stop(1, `Cannot read this source: X post ${src.id} is deleted, private or age gated.`);
    check(r, `https://cdn.syndication.twimg.com/tweet-result?id=${src.id}`, 'the X post', src);
    const v = pickVariant(tweet);
    if (!v) throw new Stop(1, `Cannot read this source: X post ${src.id} has no video or GIF${tweet?.photos?.length ? ' (photos only)' : ''}.`);
    check(await get(v.url, file), v.url, 'the video file', src);
    return { label: `x.com post ${src.id}, ${v.media} (mp4${v.width ? ' ' + v.width + ' wide' : ''})${v.count > 1 ? `, the first of ${v.count} in the post` : ''}`, media: v.media, text: tweet.text, duration: v.duration };
  }
  if (src.kind === 'ytdlp') {
    const py = python(), ok = (c) => run(c[0], [...c.slice(1), '--version']).status === 0;
    let cmd = [['yt-dlp'], ...(py ? [[py, '-m', 'yt_dlp']] : [])].find(ok);
    if (!cmd && py && pipInstall(py, 'yt-dlp') && ok([py, '-m', 'yt_dlp'])) cmd = [py, '-m', 'yt_dlp'];
    if (!cmd) throw new Stop(1, `Cannot read this source: ${src.host} needs yt-dlp, which is not installed and pip could not install it.`);
    const r = run(cmd[0], [...cmd.slice(1), '-q', '--no-warnings', '--no-playlist', '--no-simulate', '--print', 'title', '-f', 'worst[ext=mp4][height>=360]/worst[ext=mp4]/worst', '--max-filesize', '80M', '--ffmpeg-location', ff, '-o', file, src.url], { timeout: 300_000 });
    if (r.status !== 0 || !existsSync(file)) { const why = (r.stderr || '').trim().split('\n').pop() || 'no video'; if (/allowlist|tunnel connection failed: 40[37]/i.test(r.stderr || '')) throw new Stop(3, `Network blocked here for ${src.host}: allow it in this environment's network settings, then run again. Until then judge the still frame only.`); throw new Stop(1, `Cannot read this source: yt-dlp said ${why.slice(0, 200)}`); }
    return { label: `${src.host} video (yt-dlp)`, media: 'video', text: (r.stdout || '').trim().split('\n')[0] };
  }
  let list = [src.url], text = '';
  if (src.kind !== 'direct') {
    const page = await get(src.url, null, 8_000_000);
    check(page, src.url, 'the page', src);
    list = videoInPage(page.body, src.url);
    text = (/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)/i.exec(page.body) || /<title>([^<]+)/i.exec(page.body))?.[1]?.trim() || '';
    if (!list.length) throw new Stop(1, `Cannot read this source: no video found on ${src.host} (no og:video, <video src> or mp4 link; the page may load it with script or show a still image).`);
  }
  const url = list[0];
  if (/\.m3u8(\?|$)/i.test(url)) {
    const r = run(ff, ['-loglevel', 'error', '-y', '-user_agent', UA, '-i', url, '-t', String(maxS), '-c', 'copy', file], { timeout: 180_000 });
    if (r.status !== 0) throw new Stop(1, `Cannot read this source: ffmpeg could not read the stream (${(r.stderr || '').trim().split('\n').pop()}).`);
  } else check(await get(url, file), url, 'the video file', src);
  return { label: `${src.host} ${src.kind === 'direct' ? 'video file' : 'page video'}`, media: 'video', text };
}

const FONTS = ['/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf', '/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf', '/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/System/Library/Fonts/Supplemental/Arial.ttf', '/Library/Fonts/Arial.ttf', 'C:/Windows/Fonts/arialbd.ttf', 'C:/Windows/Fonts/arial.ttf'];
function fontFile() {
  const hit = FONTS.find((f) => existsSync(f)); if (hit) return hit;
  const walk = (d, depth) => { try { for (const n of readdirSync(d, { withFileTypes: true })) { const p = join(d, n.name); if (n.isFile() && /\.ttf$/i.test(n.name)) return p; if (n.isDirectory() && depth < 3) { const f = walk(p, depth + 1); if (f) return f; } } } catch {} return null; };
  return walk('/usr/share/fonts', 0);
}

async function main() {
  const args = process.argv.slice(2), USAGE = 'usage: node gb-frames.mjs <post or page url | video file> [--frames 12] [--max 20] [--out dir] [--name file]';
  const usage = () => { console.error(USAGE); process.exit(2); };
  const opt = (n) => { const i = args.indexOf('--' + n); return i < 0 ? null : args.splice(i, 2)[1]; };
  const given = { frames: opt('frames'), max: opt('max'), out: opt('out'), name: opt('name') };
  if (args.length !== 1 || args[0].startsWith('--') || Object.values(given).some((v) => v === undefined || /^--/.test(v ?? ''))) usage();
  const count = Math.min(24, Math.max(1, Math.round(Number(given.frames || LIMITS.frames)))), maxS = Number(given.max || LIMITS.maxSeconds), src = sourceOf(args[0]);
  if (!src || !(count > 0) || !(maxS > 0)) usage();
  const gbDir = join(process.env.TMPDIR || '/tmp', 'gb'), out = resolve(given.out || join(gbDir, 'frames'));
  const ff = findFfmpeg();
  if (!ff) { console.error('This machine cannot make frames: no ffmpeg on PATH, and pip could not install imageio-ffmpeg (allow pypi.org and files.pythonhosted.org, or install ffmpeg). Until then judge the still frame only.'); process.exit(3); }
  mkdirSync(out, { recursive: true }); mkdirSync(gbDir, { recursive: true });
  const work = mkdtempSync(join(gbDir, 'frames-tmp-'));
  try {
    const got = await fetchVideo(src, join(work, 'v.mp4'), ff, maxS), video = got.path || join(work, 'v.mp4');
    const info = probeInfo(run(ff, ['-hide_banner', '-i', video]).stderr || ''), duration = info.duration || got.duration;
    if (!duration) throw new Stop(1, `Cannot read this source: ffmpeg could not read the downloaded file as a video.`);
    const { times, window, capped } = frameTimes(duration, count, maxS), g = grid(times.length, info.width && info.height ? info.height / info.width : 1);
    const font = fontFile(), size = Math.max(14, Math.round(g.w / 16));
    const label = (t) => `,drawtext=${font ? `fontfile='${font.replace(/\\/g, '/').replace(/:/g, '\\:')}':` : ''}text='${t.toFixed(2)} s':x=6:y=6:fontsize=${size}:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=4`;
    let labelled = true;
    for (let [i, t] of times.entries()) {
      const frame = (lab) => run(ff, ['-loglevel', 'error', '-y', '-ss', String(t), '-i', video, '-frames:v', '1', '-vf', `scale=${g.w}:${g.h}${lab ? label(t) : ''}`, join(work, `f${String(i).padStart(3, '0')}.png`)]);
      let r = frame(labelled);
      if (r.status !== 0 && labelled) { labelled = false; r = frame(false); }
      // Past the last frame nothing is written: take one a little earlier.
      if (r.status === 0 && !existsSync(join(work, `f${String(i).padStart(3, '0')}.png`)) && t > 0.3) { times[i] = t = Math.round((t - 0.3) * 100) / 100; r = frame(labelled); }
      if (r.status !== 0 || !existsSync(join(work, `f${String(i).padStart(3, '0')}.png`))) throw new Stop(1, `Cannot read this source: ffmpeg could not take the frame at ${t} s (${(r.stderr || 'no frame there').trim().split('\n').pop()}).`);
    }
    const name = (given.name || (src.kind === 'x' ? `x-${src.id}` : got.name || src.host + '-' + Date.now().toString(36))).replace(/[^\w.-]+/g, '-').replace(/\.jpe?g$/i, '') + '.jpg', sheet = join(out, name);
    let q = 3, r;
    do { r = run(ff, ['-loglevel', 'error', '-y', '-framerate', '1', '-i', join(work, 'f%03d.png'), '-vf', `tile=${g.cols}x${g.rows}:padding=${g.pad}:margin=${g.pad}:color=white`, '-frames:v', '1', '-q:v', String(q), sheet]); q += 3; }
    while (r.status === 0 && statSync(sheet).size > LIMITS.sheetBytes && q <= 31);
    if (r.status !== 0) throw new Stop(1, `Could not tile the frames: ${(r.stderr || '').trim().split('\n').pop()}`);
    const W = g.cols * g.w + (g.cols + 1) * g.pad, H = g.rows * g.h + (g.rows + 1) * g.pad;
    console.log(`sheet: ${sheet} (${W}x${H}, ${Math.round(statSync(sheet).size / 1000)} KB)`);
    console.log(`source: ${got.label}`);
    console.log(`duration: ${duration.toFixed(2)} s; ${times.length} frames at ${times.map((t) => t.toFixed(2)).join(', ')} s, left to right, top to bottom${labelled ? ', each labelled with its time' : ' (times not drawn: ffmpeg has no font here)'}`);
    if (capped) console.log(`window: only the first ${window} s of ${duration.toFixed(1)} s; nothing after ${window} s was seen`);
    if (got.text) console.log(`text: ${got.text.replace(/\s+/g, ' ').trim().slice(0, 300)}`);
    console.log(`Read the sheet with your image tool and describe only what the frames show${got.path ? '' : '; the downloaded video was deleted'}.`);
  } catch (e) {
    if (!(e instanceof Stop)) throw e;
    console.error(e.message); process.exitCode = e.code;
  } finally { rmSync(work, { recursive: true, force: true }); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
