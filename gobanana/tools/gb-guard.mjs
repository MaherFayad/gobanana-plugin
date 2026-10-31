// gb-tools v8: bump it in every script and the fetch line on any change.
// gb-guard: a page the render scripts open loads file:// only inside the working folder, $TMPDIR or /tmp.
import { realpathSync } from 'node:fs'; import { tmpdir } from 'node:os'; import { sep } from 'node:path'; import { fileURLToPath } from 'node:url';
const real = (p) => { try { return realpathSync(p); } catch { return ''; } };
export const fileOk = (url) => { const roots = [real(process.cwd()), real(tmpdir()), real('/tmp')].filter(Boolean); let f = ''; try { f = real(fileURLToPath(url)); } catch {} return !!f && roots.some((d) => f === d || f.startsWith(d + sep)); };
export const guard = (browser) => { const open = browser.newPage.bind(browser); browser.newPage = async (o) => { const page = await open(o); await page.route(/^file:/i, (r) => (fileOk(r.request().url()) ? r.continue() : r.abort())); return page; }; return browser; };
