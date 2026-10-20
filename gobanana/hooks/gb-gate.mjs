// The GoBanana gate for UI drafts.
//   pre:  before Write of an HTML screen in a design session, GoBanana's playbooks must be loaded; before Artifact or
//         SendUserFile publishes an HTML screen, gb-measure must have run on it since its last edit with no FAIL.
//         Each block happens at most twice per file version, so a machine that cannot render is never stuck.
//   post: after Write, Edit or MultiEdit of an HTML file, static copy checks; FAIL lines go back to Claude to fix now.
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { copyFindings, isHtml, isUiDraft, playbookLoaded, readChecked, readSession, readStdin, writeSession } from "./gb-rules.mjs";

const mode = process.argv[2], input = await readStdin(), ti = input.tool_input || {}, tool = String(input.tool_name || "");
const session = readSession(input.session_id), abs = (p) => resolve(input.cwd || process.cwd(), String(p));
const deny = (reason) => { process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } })); process.exit(0); };
/** At most two blocks per key; the third try passes, so a missing browser or connector never traps the run. */
const strike = (key) => { const s = readSession(input.session_id), n = (s.strikes?.[key] || 0) + 1; writeSession(input.session_id, { ...s, strikes: { ...s.strikes, [key]: n } }); return n <= 2; };

if (mode === "pre" && tool === "Write" && isHtml(ti.file_path)) {
  const text = String(ti.content || "");
  if (isUiDraft(ti.file_path, text, session.design) && !playbookLoaded(input.transcript_path) && strike("playbook")) {
    deny("GoBanana gate: this HTML screen is being written before any GoBanana playbook was loaded, so none of the taste, craft or Arabic rules apply. Call get_playbook { name: 'gobanana-draft', more: ['gobanana-draft/content-and-arabic', 'gobanana-draft/type-color-layout', 'gobanana-draft/slop-tells', 'gobanana-draft/render-loop'] } (or the gobanana-explore skill when there is no picked direction), build from it, then write the file. If the GoBanana tools are missing, tell the user to connect GoBanana and write again.");
  }
}

if (mode === "pre" && tool !== "Write") {
  const files = [ti.file_path, ...(ti.files || []), ...(ti.file_paths || [])].filter(isHtml).map(abs).filter((f) => existsSync(f));
  const checked = readChecked();
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    if (!isUiDraft(f, text, session.design)) continue;
    const mtimeMs = statSync(f).mtimeMs, st = checked[f], fresh = st && st.mtimeMs === mtimeMs, key = `publish:${f}:${mtimeMs}`;
    if (fresh && st.fails === 0) continue;
    if (!strike(key)) continue;
    deny(fresh
      ? `GoBanana gate: gb-measure found ${st.fails} failing check(s) on ${f} in its last run. Fix them and run the render loop's one command again (playbook gobanana-draft/render-loop), then publish. If a FAIL must stay, publish again and name it with its reason in the report.`
      : `GoBanana gate: ${f} has not been rendered and measured since its last edit, and an unchecked draft is never shown. Run the render loop's one command (gb-shoot and gb-measure, playbook gobanana-draft/render-loop; for several concepts also gb-spread, playbook gobanana-draft/concept-sheet), fix every FAIL, then publish. If this machine cannot render, publish again and mark every visual item "not checked".`);
  }
}

if (mode === "post" && isHtml(ti.file_path)) {
  const f = abs(ti.file_path);
  if (existsSync(f)) {
    const text = readFileSync(f, "utf8"), ui = isUiDraft(f, text, session.design), fails = copyFindings(text, ui);
    if (fails.length) process.stdout.write(JSON.stringify({ decision: "block", reason: `GoBanana copy check on ${f}:\n${fails.join("\n")}\nFix these in the file now (playbook gobanana-draft/content-and-arabic has the words to use).` }));
  }
}
process.exit(0);
