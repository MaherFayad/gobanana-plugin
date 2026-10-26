// The GoBanana gate for UI drafts. It acts only in a session where a GoBanana flow is active (the route hook fired on
// a GoBanana ask, a get_playbook call finished or a GoBanana canvas was opened); elsewhere it stays silent.
//   pre:  before Write of an HTML screen in a design session, GoBanana's playbooks must be loaded (blocked at most twice);
//         before Artifact or SendUserFile publishes an HTML screen, gb-measure must have run on it since its last edit
//         with no FAIL. A measure FAIL blocks twice; the third try passes with a warning line the user sees, so one
//         false FAIL never traps the run. An unmeasured draft (gb-measure ran under another TMPDIR, against a URL, or not
//         at all) also blocks twice, then passes with a warning line the user sees. gb-measure's stamps and its
//         .gb-norender mark are read from $TMPDIR/gb, /tmp/gb and os.tmpdir()/gb.
//   post: after Write, Edit or MultiEdit of an HTML file, static copy checks, plus layout checks on a UI draft (3 or
//         more rules under 14px, more than 2 font families per script); FAIL lines go back to Claude to fix now, WARN
//         lines go to Claude as context.
//   loaded: after a GoBanana new_canvas, open_canvas or get_canvas call, mark the session; after get_playbook, also
//           copy the plugin's check scripts (tools/) into the gb temp folders, so the render loop never has to fetch
//           code. The hooks never read the transcript (Anthropic Software Directory Policy 1.F: no querying chat history).
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { cannotRender, copyFindings, failIds, flowActive, installTools, isHtml, isUiDraft, layoutFindings, playbookLoaded, readChecked, readSession, readStdin, writeSession } from "./gb-rules.mjs";

const mode = process.argv[2], input = await readStdin(), ti = input.tool_input || {}, tool = String(input.tool_name || "");
const session = readSession(input.session_id), abs = (p) => resolve(input.cwd || process.cwd(), String(p));
const deny = (reason) => { process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } })); process.exit(0); };
/** Counts the blocks per key; the third try passes, so a missing browser, a connector or a false FAIL never traps the run. */
const strikes = (key) => { const s = readSession(input.session_id), n = (s.strikes?.[key] || 0) + 1; writeSession(input.session_id, { ...s, strikes: { ...s.strikes, [key]: n } }); return n; };
const strike = (key) => strikes(key) <= 2;

if (mode === "loaded") {
  if (/get_playbook$/.test(tool)) { writeSession(input.session_id, { ...session, playbook: true }); installTools(); }
  else writeSession(input.session_id, { ...session, canvas: true });
}
// Owner 2026-10-26: the gate acts only in a session where a GoBanana flow is active (it blocked an unrelated publish).
if (!flowActive(session)) process.exit(0);

if (mode === "pre" && tool === "Write" && isHtml(ti.file_path)) {
  const text = String(ti.content || "");
  if (isUiDraft(ti.file_path, text, session.design) && !playbookLoaded(session) && strike("playbook")) {
    deny("GoBanana gate: this HTML screen is being written before any GoBanana playbook was loaded, so none of the taste, craft or Arabic rules apply. Call get_playbook { name: 'gobanana-draft', more: ['gobanana-draft/core'] } (or the gobanana-explore skill when there is no picked direction), build from it, then write the file. GoBanana tools may carry any prefix. If none are there, tell the user to connect the GoBanana connector at claude.ai or run /mcp, then write again.");
  }
}

if (mode === "pre" && tool !== "Write") {
  const files = [ti.file_path, ...(ti.files || []), ...(ti.file_paths || [])].filter(isHtml).map(abs).filter((f) => existsSync(f));
  const checked = readChecked(), warnings = [];
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    if (!isUiDraft(f, text, session.design)) continue;
    const mtimeMs = statSync(f).mtimeMs, st = checked[f], fresh = st && st.mtimeMs === mtimeMs, key = `publish:${f}:${mtimeMs}`;
    if (fresh && st.fails === 0) continue;
    if (fresh) {
      // A measured FAIL blocks twice: the draft is fixed and measured again. The third try passes with a warning the
      // user sees, so a false FAIL (a misread page) never traps the run.
      const ids = failIds(st.summary), named = ids.length ? ` (${ids.join(", ")})` : "", n = strikes(`fail:${f}:${mtimeMs}`);
      if (n > 2) { warnings.push(`GoBanana gate: ${f} was published with ${st.fails} failing gb-measure check(s)${named} after two blocks. It is not a checked draft.`); continue; }
      deny(`GoBanana gate: gb-measure found ${st.fails} failing check(s)${named} on ${f} in its last run${st.summary ? ` (${st.summary})` : ""}. A draft with a FAIL is never shown or placed. Fix every FAIL (cut what the first screen holds, raise small type to 14px and body to 16px), run the render loop's one command again (playbook gobanana-draft/render-loop), then publish.${n === 2 ? " If a FAIL is a false reading (the page is right and the measure misread it), tell the user which FAIL id and why; a third publish goes through with a warning the user sees." : ""}`);
    }
    // Unmeasured: blocks twice, then passes with a warning the user sees. gb-measure may have run under another TMPDIR
    // (a sandboxed Bash) or against a URL, so its stamp is out of reach; the run is never trapped.
    const n = strikes(key), noRender = cannotRender();
    if (n > 2) { warnings.push(`GoBanana gate: ${f} was published unmeasured after two blocks: not a checked draft.${noRender ? " This machine is marked as unable to render." : ""}`); continue; }
    deny(`GoBanana gate: ${f} has not been rendered and measured since its last edit, and an unchecked draft is never shown. Run the render loop's one command (gb-shoot and gb-measure, playbook gobanana-draft/render-loop; for several concepts also gb-spread, playbook gobanana-draft/concept-sheet), fix every FAIL, then publish.${noRender ? ' This machine is marked as unable to render: say so, and mark every visual item "not checked".' : ""}${n === 2 ? ' If gb-measure did run clean (under another TMPDIR or against a URL) or cannot run here, tell the user so; a third publish goes through with a warning the user sees, and every visual item not measured is "not checked".' : ""}`);
  }
  if (warnings.length) process.stdout.write(JSON.stringify({ systemMessage: warnings.join("\n") }));
}

if (mode === "post" && isHtml(ti.file_path)) {
  const f = abs(ti.file_path);
  if (existsSync(f)) {
    const text = readFileSync(f, "utf8"), ui = isUiDraft(f, text, session.design), lines = [...copyFindings(text, ui), ...(ui ? layoutFindings(text) : [])];
    const fails = lines.filter((l) => l.startsWith("FAIL")), warns = lines.filter((l) => !l.startsWith("FAIL"));
    if (fails.length) process.stdout.write(JSON.stringify({ decision: "block", reason: `GoBanana check on ${f}:\n${lines.join("\n")}\nFix the FAIL lines in the file now (playbook gobanana-draft/content-and-arabic has the words to use; type sizes and families in gobanana-draft/core).` }));
    else if (warns.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: `GoBanana check on ${f}:\n${warns.join("\n")}` } }));
  }
}
process.exit(0);
