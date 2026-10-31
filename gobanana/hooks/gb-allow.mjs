// GoBanana check scripts, rung 1 (round 11, 2026-10-31): a PreToolUse hook on Bash. Claude Code's auto mode refused
// `node "$T/gb-shoot.mjs"` as "[Code from External]" (round 10). This hook returns permissionDecision "allow" ONLY for
//   node <this plugin's own tools folder>/gb-<name>.mjs <args>   [2>&1] [| tail -N | tail -n N]
// written literally: the script path as written is its own real path, inside the real path of this hook's ../tools
// (never $CLAUDE_PLUGIN_ROOT: a planted root could hold byte-identical copies beside a planted node_modules), and its
// sha256 equals its pin in gb-pins.mjs (generated from the shipped tools). No variable, assignment, glob character,
// backslash, newline, non-ASCII, redirect to a file or chained command. Each arg (and each comma item and name=value
// value) is checked for a URL scheme first: only https: passes; file:, http:, data:, javascript: and drive letters do
// not. Then it is a flag (--name or --name=<safe value>), a number or WxH, or a path (absolute, or relative without ..
// or %) whose real path lies under the working folder or the OS temp folder, so --out and gb-lint's input stay there.
// Anything else gets no decision: the host's normal check applies, and deny and ask rules still win over this allow
// (Claude Code docs).
// Trade-offs of rendering drafts, accepted: an allowed run may fetch the https URLs it is given (a hero image, a part),
// and the rendered page may load network resources (fonts, images). The render scripts' pages load file:// only inside
// the working folder, $TMPDIR and /tmp (gb-guard.mjs). Left open: node resolves `playwright` from this plugin folder's parents
// and the global npm root; the hook does not vet those. Node built-ins only.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { PINS } from "./gb-pins.mjs";

const NO = (why) => ({ allow: false, why });
const SCRIPT = /^gb-[a-z0-9-]+\.mjs$/;
const HERE = dirname(fileURLToPath(import.meta.url));

/** The real path of p, or of its nearest existing parent with the rest appended; null when nothing resolves. */
function real(p) {
  let cur = p, rest = [];
  for (;;) {
    try { return join(realpathSync(cur), ...rest.reverse()); } catch {}
    const up = dirname(cur);
    if (up === cur) return null;
    rest.push(basename(cur)); cur = up;
  }
}
const inside = (p, dir) => !!p && !!dir && (p === dir || p.startsWith(dir.endsWith(sep) ? dir : dir + sep));

/** True when the file is a shipped check script: gb-tools tag on line 1 and the pinned sha256. */
export function pinned(path, pins = PINS) {
  const name = basename(path), want = pins.sha256[name];
  if (!want || !SCRIPT.test(name)) return false;
  try {
    const buf = readFileSync(path);
    if (!buf.toString("utf8", 0, 40).startsWith(`// gb-tools ${pins.tag}:`)) return false;
    return createHash("sha256").update(buf).digest("hex") === want;
  } catch { return false; }
}

/**
 * Words of a literal command: plain characters and '...' or "..." runs, split on spaces. Null on anything else
 * ($, backtick, backslash, newline, operators, glob characters). Inside quotes `?`, `&`, `=`, `%`, `#` and `,` are
 * plain text (an https URL's query); `*[]{}~` are refused even there.
 */
function words(cmd) {
  if (/[$`\\\n\r\t*[\]{}~]/.test(cmd)) return null;
  const out = [];
  let cur = null, i = 0;
  while (i < cmd.length) {
    const c = cmd[i];
    if (c === " ") { if (cur !== null) out.push(cur); cur = null; i++; continue; }
    if (c === "'" || c === '"') {
      const j = cmd.indexOf(c, i + 1);
      if (j < 0) return null;
      const text = cmd.slice(i + 1, j);
      if (/['"]/.test(text)) return null;
      cur = (cur ?? "") + text; i = j + 1; continue;
    }
    if (/[;&|<>()!#?]/.test(c)) return null;
    cur = (cur ?? "") + c; i++;
  }
  if (cur !== null) out.push(cur);
  return out;
}

/** Any URL scheme or drive letter (file:, http:, data:, javascript:, C:). */
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** One arg's verdict: scheme first (https only), then a flag, a number or WxH, a name=value item, or a path under the roots. */
function safeArg(a, roots, cwd) {
  if (!a) return false;
  if (SCHEME.test(a)) return /^https:\/\/[A-Za-z0-9.-]+(?::\d+)?(\/[^\s'"]*)?$/.test(a);
  if (/^-?\d+(\.\d+)?%?$/.test(a) || /^\d{2,5}x\d{2,5}$/.test(a)) return true;
  if (/^--?[a-z][a-z0-9-]*$/i.test(a)) return true;
  const kv = /^(--?[a-z][a-z0-9-]*)=(.*)$/i.exec(a);
  if (kv) return safeArg(kv[2], roots, cwd);
  if (a.startsWith("-")) return false;
  // A list such as --refs "hero=https://...,seats=https://..." is checked item by item.
  if (a.includes(",")) return a.split(",").every((x) => safeArg(x, roots, cwd));
  // A name=value item (a part and its reference) is checked by its value.
  const nv = /^([A-Za-z0-9 _.-]+)=(.*)$/.exec(a);
  if (nv) return safeArg(nv[2], roots, cwd);
  if (/[?&#%=]/.test(a) || a.split(/[\\/]/).includes("..")) return false;
  const p = real(isAbsolute(a) ? a : resolve(cwd, a));
  return roots.some((r) => inside(p, r));
}

/**
 * The decision for one Bash command: { allow, why }. The tools folder is always this hook's own ../tools; `cwd` (the
 * session's working folder) and `tmp` (the OS temp folder) are injectable for tests. Only an allow is ever returned to
 * the host; a refusal here means "no decision".
 */
export function decideBash(command, { cwd = process.cwd(), tmp = tmpdir() } = {}) {
  let cmd = String(command || "");
  if (cmd.length > 4000 || !cmd.includes("gb-")) return NO("not a check script run");
  if (/[^\x20-\x7e]/.test(cmd)) return NO("a character outside plain ASCII");
  const t = / \| tail (?:-n \d{1,4}|-\d{1,4})$/.exec(cmd);
  if (t) cmd = cmd.slice(0, t.index);
  if (cmd.endsWith(" 2>&1")) cmd = cmd.slice(0, -5);
  const w = words(cmd.trim());
  if (!w || w.length < 2) return NO("not a literal command");
  if (w[0] !== "node") return NO("not node");
  const tools = real(join(HERE, "..", "tools"));
  if (!tools || !isAbsolute(w[1])) return NO("not an absolute script path");
  let script;
  try { script = realpathSync(w[1]); } catch { return NO("no such script"); }
  if (script !== w[1]) return NO("the script path is not written as its real path");
  if (dirname(script) !== tools || !SCRIPT.test(basename(script))) return NO("not in the plugin's tools folder");
  if (!existsSync(script) || !pinned(script)) return NO("not a pinned GoBanana check script");
  const roots = [real(cwd), real(tmp)].filter(Boolean);
  for (const a of w.slice(2)) if (!safeArg(a, roots, cwd)) return NO(`arg ${a} is outside the work and temp folders or not plain`);
  return { allow: true, why: `GoBanana check script ${basename(script)} (pinned sha256, gb-tools ${PINS.tag})` };
}

async function main() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  let input = {};
  try { input = JSON.parse(raw || "{}"); } catch { return; }
  if (input.tool_name !== "Bash") return;
  const d = decideBash(input.tool_input?.command, input.cwd ? { cwd: input.cwd } : {});
  if (d.allow) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "allow", permissionDecisionReason: d.why } }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main().catch(() => {});
