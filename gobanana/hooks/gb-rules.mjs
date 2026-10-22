// GoBanana rules shared by the plugin hooks. Node built-ins only. The two Arabic word lists are the same text as
// gb-measure's (playbook gobanana-draft/check-scripts); a server test keeps them equal.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const AR_SLANG = 'عشان|علشان|دلوقتي|دلوقت|كده|كدا|ازاي|إزاي|مش|عايز|عايزة|عاوز|بتاع|بتاعت|بتاعك|ده|دي|برا|جوا|قايمة|مستني|مستنية|مستنيك|مستنياك|لسه|لسة|اتعمل|اتضاف|يتضاف|بيستعمل|بيسأل|بيشتغل|بيعمل|بتعمل|الحين|ايش|إيش|وش|ليش|شلون|وايد|يبغى|تبغى|هيك|شو|بدي|بدك|منيح|كتير';
export const AR_LOAN = 'كونسبت|كونسبتس|كونسيبت|ديزاين|يوزر|يوزرز|فيدباك|تاسك|تاسكات|أبديت|ابديت|سيتنج|سيتنجز|بروجكت|بروجيكت|ريفيو|أبروف|ابروف|كوميت|ستيتس';
export const arWord = (list) => new RegExp('(?:^|[^\\u0600-\\u06FF])[وف]?(' + list + ')(?![\\u0600-\\u06FF])', 'g');

/** A request to design, redesign or show concepts of a page or screen, in English or Arabic. */
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

const stateDir = () => join(process.env.TMPDIR || "/tmp", "gb");
const sessionFile = (id) => join(stateDir(), `session-${String(id || "none").replace(/[^\w-]/g, "")}.json`);
export function readSession(id) { try { return JSON.parse(readFileSync(sessionFile(id), "utf8")); } catch { return {}; } }
export function writeSession(id, s) { try { mkdirSync(stateDir(), { recursive: true }); writeFileSync(sessionFile(id), JSON.stringify(s)); } catch {} }
/** gb-measure writes this after each run: { [absPath]: { mtimeMs, fails, at } }. */
export function readChecked() { try { return JSON.parse(readFileSync(join(stateDir(), "checked.json"), "utf8")); } catch { return {}; } }

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

export async function readStdin() {
  let s = ""; for await (const c of process.stdin) s += c;
  try { return JSON.parse(s || "{}"); } catch { return {}; }
}
