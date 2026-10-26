// GoBanana rules shared by the plugin hooks. Node built-ins only. The two Arabic word lists are the same text as
// gb-measure's (playbook gobanana-draft/check-scripts); a server test keeps them equal.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const AR_SLANG = 'عشان|علشان|دلوقتي|دلوقت|كده|كدا|ازاي|إزاي|مش|عايز|عايزة|عاوز|بتاع|بتاعت|بتاعك|ده|دي|برا|جوا|قايمة|مستني|مستنية|مستنيك|مستنياك|لسه|لسة|اتعمل|اتضاف|يتضاف|بيستعمل|بيسأل|بيشتغل|بيعمل|بتعمل|الحين|ايش|إيش|وش|ليش|شلون|وايد|يبغى|تبغى|هيك|شو|بدي|بدك|منيح|كتير';
export const AR_LOAN = 'كونسبت|كونسبتس|كونسيبت|ديزاين|يوزر|يوزرز|فيدباك|تاسك|تاسكات|أبديت|ابديت|سيتنج|سيتنجز|بروجكت|بروجيكت|ريفيو|أبروف|ابروف|كوميت|ستيتس';
export const arWord = (list) => new RegExp('(?:^|[^\\u0600-\\u06FF])[وف]?(' + list + ')(?![\\u0600-\\u06FF])', 'g');

/** A request to design, redesign or show concepts of a page or screen, in English or Arabic (a continuation test inside a GoBanana flow). */
const STRONG = /\b(concepts?|variants?|variations?|mock-?ups?|wireframes?|redesign|re-design|prototypes?|moodboards?|art direction|design directions?|ui ideas|design ideas|go wild|make it (?:cool|wild|weird|pop|beautiful|pretty|nicer|look (?:good|better|amazing))|bananas)\b/i;
const VERB = /\b(design|build|make|draft|create|show|mock|style|restyle|rethink|explore)\b/i;
const THING = /\b(page|screen|dashboard|landing|homepage|website|site|ui|ux|app|view|flow|onboarding|checkout|paywall|overview|layout|hero|component|interface)s?\b/i;
const AR = /(كونسبت|تصميم|تصاميم|صمم|صمّم|اتجاهات|واجهة|واجهات|موك ?اب|ماكيت|نموذج أولي|إعادة تصميم|ريديزاين|شكل الصفحة|شكل الشاشة)/;
/** Messages the harness delivers on the user's turn that a person did not type: agent reports, task and system notices. */
const NOT_TYPED = /^\s*(?:<agent-message\b|<task-notification\b|\[SYSTEM NOTIFICATION|Another Claude session sent a message|\[Subagent hand-back\])/i;
export function isDesignRequest(prompt) {
  const p = String(prompt || "");
  if (NOT_TYPED.test(p)) return false;
  return STRONG.test(p) || (VERB.test(p) && THING.test(p)) || AR.test(p);
}
/** The user asks for GoBanana by name (any casing or spacing, a gobanana.fun link) or for wildness ("go wild", "make it bananas"). */
const ASKED = /\bgo[\s_-]*bananas?\b|\bmake\s+it\s+bananas\b|\bgo\s+wild\b/i;
export function asksForGoBanana(prompt) {
  const p = String(prompt || "");
  return !NOT_TYPED.test(p) && ASKED.test(p);
}
/**
 * A GoBanana flow already ran in this session: the route hook fired on a GoBanana ask, a get_playbook call finished,
 * or a GoBanana canvas was opened. Owner 2026-10-26: outside such a session the hooks stay silent on every design task.
 */
export const flowActive = (session) => !!(session.design || session.playbook || session.canvas);

const stateDir = () => join(process.env.TMPDIR || "/tmp", "gb");
const sessionFile = (id) => join(stateDir(), `session-${String(id || "none").replace(/[^\w-]/g, "")}.json`);
export function readSession(id) { try { return JSON.parse(readFileSync(sessionFile(id), "utf8")); } catch { return {}; } }
export function writeSession(id, s) { try { mkdirSync(stateDir(), { recursive: true }); writeFileSync(sessionFile(id), JSON.stringify(s)); } catch {} }
/**
 * Every gb folder gb-measure may have written to: $TMPDIR/gb, /tmp/gb and os.tmpdir()/gb. A sandboxed Bash (macOS)
 * can run gb-measure under a different TMPDIR than the hooks see, so the gate looks in all of them.
 */
export function gbDirs() {
  const dirs = [process.env.TMPDIR ? join(process.env.TMPDIR, "gb") : "", join("/tmp", "gb"), join(tmpdir(), "gb")].filter(Boolean);
  return [...new Set(dirs)];
}
/**
 * Copies the check scripts the plugin ships (tools/gb-*.mjs) into every gb folder, so the playbooks'
 * `[ -f "$T/gb-measure.mjs" ] || curl ...` finds them and never fetches code (some hosts block that).
 * Writes only a file that differs. Returns how many files it wrote; never throws.
 */
export function installTools(root = process.env.CLAUDE_PLUGIN_ROOT || join(dirname(fileURLToPath(import.meta.url)), "..")) {
  let wrote = 0;
  const src = join(root, "tools");
  let files = [];
  try { files = readdirSync(src).filter((f) => /^gb-[a-z0-9-]+\.mjs$/.test(f)); } catch { return 0; }
  for (const dir of gbDirs()) {
    for (const f of files) {
      try {
        const code = readFileSync(join(src, f), "utf8"), dest = join(dir, f);
        if (existsSync(dest) && readFileSync(dest, "utf8") === code) continue;
        mkdirSync(dir, { recursive: true });
        writeFileSync(dest, code);
        wrote++;
      } catch {}
    }
  }
  return wrote;
}

/** gb-measure writes this after each run: { [absPath]: { mtimeMs, fails, at, summary } }. The newest stamp per file wins. */
export function readChecked() {
  const out = {};
  for (const dir of gbDirs()) {
    let data;
    try { data = JSON.parse(readFileSync(join(dir, "checked.json"), "utf8")); } catch { continue; }
    if (!data || typeof data !== "object") continue;
    for (const [f, st] of Object.entries(data)) if (st && typeof st === "object" && (!out[f] || (Number(st.at) || 0) > (Number(out[f].at) || 0))) out[f] = st;
  }
  return out;
}
/**
 * True only when this machine was marked as unable to render: GB_NORENDER=1, or the .gb-norender file gb-measure
 * itself writes in a gb temp folder ($TMPDIR/gb, /tmp/gb or os.tmpdir()/gb) when Playwright cannot start (and removes
 * when a browser starts). A file in the project does not count: anything could write it. The gate then tells Claude
 * to mark every visual item "not checked".
 */
export function cannotRender() {
  if (/^(1|true|yes)$/i.test(String(process.env.GB_NORENDER || ""))) return true;
  return gbDirs().some((d) => existsSync(join(d, ".gb-norender")));
}

/** The FAIL ids of gb-measure's last run on a file, from the measure.json its checked stamp names; [] when unknown. */
export function failIds(summaryPath) {
  try { const ids = JSON.parse(readFileSync(String(summaryPath), "utf8")).failIds; return Array.isArray(ids) ? ids.map(String).slice(0, 12) : []; } catch { return []; }
}

/** True when a GoBanana get_playbook call finished in this session (the "loaded" hook marks it; no transcript is read). */
export const playbookLoaded = (session) => session.playbook === true;

export const isHtml = (p) => /\.html?$/i.test(String(p || ""));
/** A UI draft: a GoBanana draft path, the draft markers, or any HTML screen written in a design session. */
export function isUiDraft(path, text, designSession) {
  if (/(^|\/)(drafts|design\/gobanana|design\/explorations)\//.test(String(path))) return true;
  if (/data-region=|class="gb-switch|data-signature/.test(text)) return true;
  return !!designSession && /<(button|input|nav|main)\b/i.test(text);
}

/** Static copy checks on an HTML file's source (its markup and script strings both hold copy). Returns FAIL lines. */
export function copyFindings(text, ui) {
  const out = [], src = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  for (const [id, list, what] of [["ar-register", AR_SLANG, "dialect words; GoBanana copy is Gulf MSA"], ["ar-loanword", AR_LOAN, "English spelled in Arabic letters; use the Arabic word"]]) {
    const hits = [...new Set([...src.matchAll(arWord(list))].map((m) => m[1]))];
    if (hits.length) out.push(`FAIL ${id}: ${what}: ${hits.slice(0, 8).join("، ")}`);
  }
  if (/[ً-ٰٟ]/.test(src)) out.push("FAIL ar-diacritics: Arabic diacritics in the copy; write without them");
  if (/[٠-٩۰-۹]/.test(src)) out.push("FAIL eastern-digits: Eastern Arabic digits; use 0 to 9");
  if (!ui) return out;
  if (/[–—]/.test(src)) out.push("FAIL dash: an em or en dash in the copy; use a comma, a colon, a full stop or \"to\"");
  if (/lorem ipsum|dolor sit amet|John Doe|Jane Doe|\bAcme\b/i.test(src)) out.push("FAIL placeholder: lorem ipsum, John Doe or Acme; use the product's real content");
  const raw = src.match(/\bgit\s+(?:log|status|diff|commit|push|pull|checkout|branch)\b[^<"'`]{0,30}/i);
  if (raw) out.push(`FAIL raw-telemetry: a shell command as copy ("${raw[0].trim()}"); say what happened in product words (playbook gobanana-draft/content-and-arabic)`);
  if (/<meta[^>]+name=["']viewport["'][^>]*(maximum-scale|user-scalable\s*=\s*no)/i.test(text)) out.push("FAIL zoom-blocked: remove maximum-scale and user-scalable=no (WCAG 2.2 SC 1.4.4)");
  return out;
}

/** Families that set Arabic; they count apart from the Latin ones (at most 2 families per script). */
export const ARABIC_FAMILY = /arab|naskh|kufi|ruqaa|tajawal|cairo|almarai|amiri|lateef|harmattan|reem|readex|changa(?!\s*one)|messiri|markazi|scheherazade|vazir|lalezar|mirza|rakkas|aref|jomhuria|blaka|bhaijaan|thmanyah|alexandria|marhey|\bmada\b|zain\b/i;
const GENERIC_FAMILY = /^(serif|sans-serif|monospace|cursive|fantasy|system-ui|ui-serif|ui-sans-serif|ui-monospace|ui-rounded|math|emoji|fangsong|inherit|initial|unset|revert|revert-layer|-apple-system|blinkmacsystemfont|segoe ui|roboto|helvetica neue|helvetica|arial)$/i;
const KEYWORD_PX = { "xx-small": 9, "x-small": 10, small: 13 };

/** The CSS of an HTML file: its style blocks and inline style attributes, each as [selector, declarations, media]. */
function cssRules(text) {
  // @import, @charset and @namespace end at ";" with no block: left in, they swallowed the next rule's selector. A ";"
  // inside a quoted or url() import (Google Fonts "wght@400;700") does not end it.
  const rules = [], css = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join("\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/@(?:import|charset|namespace)\b(?:"[^"]*"|'[^']*'|\([^)]*\)|[^;"'(])*;/gi, "");
  const stack = []; let buf = "";
  for (const ch of css) {
    if (ch === "{") { stack.push(buf.trim()); buf = ""; continue; }
    if (ch === "}") { const sel = stack.pop() ?? ""; if (!sel.startsWith("@") && buf.trim()) rules.push([sel, buf, stack.join(" ")]); buf = ""; continue; }
    buf += ch;
  }
  for (const m of text.matchAll(/\sstyle\s*=\s*("([^"]*)"|'([^']*)')/gi)) rules.push(["[style]", m[2] ?? m[3] ?? "", ""]);
  return rules;
}

/** Every declaration of one property ("font-size") in a block. */
const decls = (body, prop) => [...body.matchAll(new RegExp(`(?:^|[;{\\s])${prop}\\s*:\\s*([^;}]+)`, "gi"))].map((m) => m[1].replace(/!important/i, "").trim());

/** Fine print and drawings may sit under 14px (the 10% small-share allowance): small, .legal, .fine, footer small, svg. */
const FINE_PRINT = /^(?:.*[\s>+~])?(?:small|svg|tspan|text)(?:[.:#[].*)?$|\.(?:legal|fine)(?![\w-])|(?:^|[\s>+~])svg(?![\w-])/i;
const finePrint = (sel) => sel.split(",").every((part) => FINE_PRINT.test(part.trim()));
/** Rules under 14px that make a FAIL; fewer is a WARN (the page may set up to 10% of its characters small). */
export const SMALL_RULES_FAIL = 3;

/**
 * Static layout checks on an HTML draft's CSS: rules with a font-size under 14px (px, rem at a 16px root, or a small
 * keyword, custom properties resolved; fine print and svg aside), 3 or more FAIL and fewer WARN, and more than
 * 2 font families per script. Returns FAIL and WARN lines.
 */
export function layoutFindings(text) {
  const out = [], rules = cssRules(String(text || "")).filter(([sel, , media]) => !/gb-switch/.test(sel) && !/\bprint\b/.test(media));
  const vars = new Map();
  for (const [, body] of rules) for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)) if (!vars.has(m[1])) vars.set(m[1], m[2].trim());
  const resolveVar = (v, depth = 0) => depth > 4 ? v : v.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*(?:\([^()]*\))?[^()]*))?\)/g, (_, name, fb) => resolveVar(vars.get(name) ?? fb ?? "", depth + 1));
  const px = (v) => { const m = String(v).trim().match(/^(-?[\d.]+)(px|rem)$/i); return m ? (m[2].toLowerCase() === "rem" ? +m[1] * 16 : +m[1]) : null; };
  const lowest = (raw) => {
    const v = resolveVar(raw).trim().toLowerCase();
    if (v in KEYWORD_PX) return KEYWORD_PX[v];
    const fn = v.match(/^(clamp|min|max)\((.*)\)$/);
    if (fn) { const parts = fn[2].split(",").map((p) => px(p)), known = parts.filter((n) => n !== null); if (!known.length) return null; return fn[1] === "clamp" ? parts[0] : fn[1] === "min" ? Math.min(...known) : (known.length === parts.length ? Math.max(...known) : null); }
    return px(v);
  };
  const small = [];
  for (const [sel, body] of rules) {
    if (finePrint(sel)) continue;
    const sizes = [...decls(body, "font-size"), ...decls(body, "font").map((f) => (resolveVar(f).match(/(?:^|\s)([\d.]+(?:px|rem))(?:\s*\/\s*[\w.%]+)?\s+\S/i) || [])[1]).filter(Boolean)];
    const under = sizes.find((s) => { const n = lowest(s); return n !== null && n > 0 && n < 14; });
    if (under) small.push(`${sel.replace(/\s+/g, " ").slice(0, 40)} ${under.trim().slice(0, 30)}`);
  }
  if (small.length) out.push(`${small.length >= SMALL_RULES_FAIL ? "FAIL" : "WARN"} small-font: ${small.length} rule(s) set type under 14px (16px root): ${small.slice(0, 4).join("; ")}; data and labels are 14px or more, body 16px (17px Arabic); only fine print (small, .legal, .fine) goes smaller`);
  const families = new Set();
  for (const [, body] of rules) {
    const stacks = [...decls(body, "font-family"), ...decls(body, "font").map((f) => (resolveVar(f).match(/[\d.]+(?:px|rem|em|%)(?:\s*\/\s*[\w.%]+)?\s+(.+)$/i) || [])[1]).filter(Boolean)];
    for (const st of stacks) {
      const first = resolveVar(st).split(",")[0].replace(/["']/g, "").trim();
      if (first && !GENERIC_FAMILY.test(first) && !/^var\(/.test(first)) families.add(first);
    }
  }
  const arabic = [...families].filter((f) => ARABIC_FAMILY.test(f)), latin = [...families].filter((f) => !ARABIC_FAMILY.test(f));
  for (const [what, list] of [["Latin", latin], ["Arabic", arabic]]) if (list.length > 2) out.push(`FAIL font-families: ${list.length} ${what} font families (${list.join(", ")}); 2 at most per script: one for display, one for text`);
  return out;
}

export async function readStdin() {
  let s = ""; for await (const c of process.stdin) s += c;
  try { return JSON.parse(s || "{}"); } catch { return {}; }
}
