// The GoBanana gate for UI drafts. It acts only in a session where a GoBanana flow is active (the route hook fired on
// a GoBanana ask, a get_playbook call finished or a GoBanana canvas was opened); elsewhere it stays silent.
//   pre:  before Write of an HTML screen in a design session, GoBanana's playbooks must be loaded (blocked at most twice);
//         before Artifact or SendUserFile publishes an HTML screen, open gb-measure FAILs or a missing measure are a
//         warning line the user sees, never a block (owner 2026-10-28: checks report, they never force a loop). gb-measure's stamps and its
//         .gb-norender mark are read from $TMPDIR/gb, /tmp/gb and os.tmpdir()/gb.
//   post: after Write, Edit or MultiEdit of an HTML file, static copy checks (the Arabic ones on an Arabic page only),
//         plus the 14px floor on a UI draft (3 or more rules under 14px); all lines go to Claude as context, never a block. No style rule (owner 2026-10-28: no font family cap, no budgets).
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
/** A rough screen lives under design/gobanana/roughs/ (playbook gobanana-explore); nowhere else does a rough stamp count. */
const isRoughPath = (f) => /(^|[\\/])design[\\/]gobanana[\\/]roughs[\\/]/.test(f);

if (mode === "loaded") {
  if (/get_playbook$/.test(tool)) { writeSession(input.session_id, { ...session, playbook: true }); installTools(); }
  else writeSession(input.session_id, { ...session, canvas: true });
}
// Owner 2026-10-26: the gate acts only in a session where a GoBanana flow is active (it blocked an unrelated publish).
if (!flowActive(session)) process.exit(0);

if (mode === "pre" && tool === "Write" && isHtml(ti.file_path)) {
  const text = String(ti.content || "");
  if (isUiDraft(ti.file_path, text, session.design) && !playbookLoaded(session) && strike("playbook")) {
    deny("GoBanana gate: this HTML screen is being written before any GoBanana playbook was loaded, so the hero's look and the accessibility floor are not in hand. Call get_playbook { name: 'gobanana-draft', more: ['gobanana-draft/core'] } (or the gobanana-explore skill when there is no picked direction), build from it, then write the file. GoBanana tools may carry any prefix. If none are there, tell the user to connect the GoBanana connector at claude.ai or run /mcp, then write again.");
  }
}

if (mode === "pre" && tool !== "Write") {
  const files = [ti.file_path, ...(ti.files || []), ...(ti.file_paths || [])].filter(isHtml).map(abs).filter((f) => existsSync(f));
  const checked = readChecked(), warnings = [];
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    if (!isUiDraft(f, text, session.design)) continue;
    const mtimeMs = statSync(f).mtimeMs, st = checked[f], fresh = st && st.mtimeMs === mtimeMs;
    if (fresh && st.fails === 0) continue;
    // Round 3 (F24): a rough screen goes out with its FAILs named in measure.openFails, never fixed first. Only a file
    // under design/gobanana/roughs/ is a rough (review round 3: a rough stamp elsewhere is a normal FAIL); its open
    // FAILs go to the user in a line.
    if (fresh && st.rough && isRoughPath(f)) {
      const ids = failIds(st.summary);
      if (st.fails > 0) warnings.push(`GoBanana gate: ${f} is a rough screen with ${st.fails} open FAIL(s)${ids.length ? ` (${ids.join(", ")})` : ""}, not a checked draft.`);
      continue;
    }
    // Owner 2026-10-28 (speed: "with every rule it becomes super slow"): checks report, they never block a publish.
    if (fresh) {
      const ids = failIds(st.summary), named = ids.length ? ` (${ids.join(", ")})` : "";
      warnings.push(`GoBanana gate: ${f} has ${st.fails} open gb-measure FAIL(s)${named}; it is shown with them open.`);
      continue;
    }
    warnings.push(`GoBanana gate: ${f} was not measured since its last edit: not a checked draft.${cannotRender() ? " This machine is marked as unable to render." : ""}`);
  }
  if (warnings.length) process.stdout.write(JSON.stringify({ systemMessage: warnings.join("\n") }));
}

if (mode === "post" && isHtml(ti.file_path)) {
  const f = abs(ti.file_path);
  if (existsSync(f)) {
    const text = readFileSync(f, "utf8"), ui = isUiDraft(f, text, session.design), lines = [...copyFindings(text, ui), ...(ui ? layoutFindings(text) : [])];
    if (lines.length) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: `GoBanana check on ${f} (reported, never blocking):\n${lines.join("\n")}` } }));
  }
}
process.exit(0);
